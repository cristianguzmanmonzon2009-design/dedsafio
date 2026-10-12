use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::game::net::download_file;
use crate::game::paths::Paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaInfo {
    pub path: String,
    pub version: String,
    pub major: u32,
    pub vendor: String,
}

/// Comprueba un ejecutable `java` concreto ejecutando `-version`.
pub async fn probe_java(exe: &Path) -> Option<JavaInfo> {
    if !exe.exists() {
        return None;
    }
    let output = tokio::process::Command::new(exe)
        .arg("-version")
        .output()
        .await
        .ok()?;
    let text = String::from_utf8_lossy(&output.stderr).to_string()
        + &String::from_utf8_lossy(&output.stdout);
    let version = extract_quoted_version(&text)?;
    let major = parse_major(&version)?;
    let vendor = if text.to_lowercase().contains("temurin")
        || text.to_lowercase().contains("adoptium")
    {
        "Eclipse Temurin"
    } else if text.to_lowercase().contains("zulu") {
        "Azul Zulu"
    } else if text.to_lowercase().contains("microsoft") {
        "Microsoft"
    } else if text.to_lowercase().contains("oracle") {
        "Oracle"
    } else {
        "OpenJDK"
    };
    Some(JavaInfo {
        path: exe.to_string_lossy().to_string(),
        version,
        major,
        vendor: vendor.to_string(),
    })
}

fn extract_quoted_version(text: &str) -> Option<String> {
    let start = text.find('"')?;
    let rest = &text[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn parse_major(version: &str) -> Option<u32> {
    let cleaned = version.trim();
    let first = cleaned.split(['.', '_', '-']).next()?;
    if first == "1" {
        // Formato antiguo 1.8.0_x -> 8
        cleaned.split('.').nth(1)?.parse().ok()
    } else {
        first.parse().ok()
    }
}

/// Busca una JVM en el sistema (bundled, JAVA_HOME, PATH y rutas típicas).
pub async fn detect(paths: &Paths) -> Option<JavaInfo> {
    if let Some(info) = probe_java(&paths.java_exe()).await {
        return Some(info);
    }

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(home) = std::env::var("JAVA_HOME") {
        candidates.push(PathBuf::from(home).join("bin").join("java.exe"));
    }

    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            candidates.push(dir.join("java.exe"));
        }
    }

    for base in [
        r"C:\Program Files\Eclipse Adoptium",
        r"C:\Program Files\Java",
        r"C:\Program Files\Microsoft",
        r"C:\Program Files\Zulu",
        r"C:\Program Files\BellSoft",
    ] {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("bin").join("java.exe");
                candidates.push(candidate);
            }
        }
    }

    for exe in candidates {
        if let Some(info) = probe_java(&exe).await {
            return Some(info);
        }
    }
    None
}

/// Garantiza una JVM con la versión mayor requerida, descargando Temurin si hace falta.
pub async fn ensure_java<F>(
    client: &reqwest::Client,
    paths: &Paths,
    required_major: u32,
    mut on_progress: F,
) -> AppResult<JavaInfo>
where
    F: FnMut(u64, Option<u64>),
{
    if let Some(info) = detect(paths).await {
        if info.major >= required_major {
            on_progress(1, Some(1));
            return Ok(info);
        }
    }

    let root = paths.java_dir();
    let url = format!(
        "https://api.adoptium.net/v3/binary/latest/{required_major}/ga/windows/x64/jdk/hotspot/normal/eclipse"
    );
    let archive = paths.runtime().join("jdk.zip");
    download_file(client, &url, &archive, None, |d, t| on_progress(d, t)).await?;

    extract_zip(&archive, &root)?;
    let _ = tokio::fs::remove_file(&archive).await;

    let exe = find_java_exe(&root)?;
    probe_java(&exe)
        .await
        .ok_or_else(|| AppError::msg("No se pudo validar el Java descargado"))
}

fn find_java_exe(root: &Path) -> AppResult<PathBuf> {
    // El zip de Adoptium contiene una carpeta raíz jdk-XX/...
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)?.flatten() {
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.file_name().and_then(|n| n.to_str()) == Some("java.exe")
                && p.parent()
                    .and_then(|p| p.file_name())
                    .and_then(|n| n.to_str())
                    == Some("bin")
            {
                return Ok(p);
            }
        }
    }
    Err(AppError::msg("java.exe no encontrado tras extraer"))
}

fn extract_zip(archive: &Path, dest: &Path) -> AppResult<()> {
    let file = std::fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(file)?;
    std::fs::create_dir_all(dest)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        // Elimina el primer componente de ruta (jdk-XX/...).
        let rel: PathBuf = name.components().skip(1).collect();
        if rel.as_os_str().is_empty() {
            continue;
        }
        let out = dest.join(rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&out)?;
        } else {
            if let Some(parent) = out.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut w = std::fs::File::create(&out)?;
            std::io::copy(&mut entry, &mut w)?;
        }
    }
    Ok(())
}
