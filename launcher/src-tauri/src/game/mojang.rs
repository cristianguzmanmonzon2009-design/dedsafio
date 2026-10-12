use std::collections::HashMap;
use std::path::PathBuf;

use futures_util::StreamExt;
use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::game::net::{download_file, HashAlgo};
use crate::game::paths::Paths;

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Debug, Deserialize)]
struct VersionManifest {
    versions: Vec<VersionRef>,
}

#[derive(Debug, Deserialize)]
struct VersionRef {
    id: String,
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    pub main_class: String,
    #[serde(default)]
    pub libraries: Vec<Library>,
    #[serde(default)]
    pub arguments: Option<Arguments>,
    #[serde(default)]
    pub asset_index: Option<AssetIndex>,
    pub downloads: Downloads,
    #[serde(default)]
    pub java_version: Option<JavaVersion>,
    #[serde(default)]
    pub logging: Option<Logging>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Downloads {
    pub client: Option<Artifact>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndex {
    pub id: String,
    pub url: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    pub major_version: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Logging {
    pub client: Option<LoggingClient>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingClient {
    pub argument: String,
    pub file: Artifact,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Artifact {
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibDownloads>,
    #[serde(default)]
    pub rules: Option<Vec<Rule>>,
    #[serde(default)]
    pub natives: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibDownloads {
    #[serde(default)]
    pub artifact: Option<Artifact>,
    #[serde(default)]
    pub classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: Option<String>,
}

/// Resultado de la instalación vanilla lista para lanzar.
pub struct InstalledVersion {
    pub json: VersionJson,
    pub client_jar: PathBuf,
    pub libraries: Vec<PathBuf>,
    pub assets_index_id: String,
    pub logging_arg: Option<(String, PathBuf)>,
}

fn windows_allowed(rules: &Option<Vec<Rule>>) -> bool {
    let Some(rules) = rules else {
        return true;
    };
    let mut allowed = false;
    for rule in rules {
        let applies = match &rule.os {
            None => true,
            Some(os) => os.name.as_deref().map(|n| n == "windows").unwrap_or(true),
        };
        if applies {
            allowed = rule.action == "allow";
        }
    }
    allowed
}

/// Convierte `group:artifact:version` en la ruta Maven relativa del artefacto.
pub fn maven_path(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() >= 3 {
        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];
        format!("{group}/{artifact}/{version}/{artifact}-{version}.jar")
    } else {
        name.to_string()
    }
}

pub async fn fetch_version_json(
    client: &reqwest::Client,
    mc_version: &str,
) -> AppResult<VersionJson> {
    let manifest: VersionManifest = client.get(VERSION_MANIFEST_URL).send().await?.json().await?;
    let entry = manifest
        .versions
        .into_iter()
        .find(|v| v.id == mc_version)
        .ok_or_else(|| AppError::msg(format!("Versión de Minecraft no encontrada: {mc_version}")))?;
    let json: VersionJson = client.get(&entry.url).send().await?.json().await?;
    Ok(json)
}

/// Descarga cliente, librerías, nativos y assets de una versión. `on_phase` recibe
/// (archivos_listos, archivos_totales) para el progreso.
pub async fn install_version<F>(
    client: &reqwest::Client,
    paths: &Paths,
    version: &VersionJson,
    mut on_phase: F,
) -> AppResult<InstalledVersion>
where
    F: FnMut(u64, Option<u64>),
{
    paths.ensure_root()?;
    let mut total: u64 = 0;
    let mut done: u64 = 0;

    // 2) Cliente (jar principal).
    let client_jar = paths.version_jar(&version.id);
    let client_art = version
        .downloads
        .client
        .as_ref()
        .ok_or_else(|| AppError::msg("La versión no define client.jar"))?;
    total += 1;
    download_file(
        client,
        &client_art.url,
        &client_jar,
        client_art.sha1.as_deref().map(|s| (s, HashAlgo::Sha1)),
        |_, _| {},
    )
    .await?;
    done += 1;
    on_phase(done, Some(total));

    // 3) Librerías.
    let mut libraries: Vec<PathBuf> = Vec::new();
    let mut natives_jobs: Vec<(PathBuf, PathBuf)> = Vec::new();
    for lib in &version.libraries {
        if !windows_allowed(&lib.rules) {
            continue;
        }
        let Some(dl) = &lib.downloads else { continue };
        if let Some(art) = &dl.artifact {
            let rel = art.path.clone().unwrap_or_else(|| maven_path(&lib.name));
            let dest = paths.libraries().join(&rel);
            let url = if art.url.is_empty() {
                // Algunas librerías solo traen path; construimos la URL de Mojang.
                format!("https://libraries.minecraft.net/{rel}")
            } else {
                art.url.clone()
            };
            libraries.push(dest.clone());
            total += 1;
            download_file(
                client,
                &url,
                &dest,
                art.sha1.as_deref().map(|s| (s, HashAlgo::Sha1)),
                |_, _| {},
            )
            .await?;
            done += 1;
            on_phase(done, Some(total));
        }
        if let (Some(natives), Some(classifiers)) = (&lib.natives, &dl.classifiers) {
            if let Some(key) = natives.get("windows") {
                if let Some(art) = classifiers.get(key) {
                    let dest = paths
                        .libraries()
                        .join(art.path.clone().unwrap_or_else(|| format!("natives/{}.jar", lib.name)));
                    total += 1;
                    download_file(
                        client,
                        &art.url,
                        &dest,
                        art.sha1.as_deref().map(|s| (s, HashAlgo::Sha1)),
                        |_, _| {},
                    )
                    .await?;
                    done += 1;
                    on_phase(done, Some(total));
                    natives_jobs.push((dest, paths.natives(&version.id)));
                }
            }
        }
    }

    // 4) Extraer nativos (.dll) al directorio de nativos.
    if !natives_jobs.is_empty() {
        tokio::fs::create_dir_all(paths.natives(&version.id)).await?;
        for (jar, dest) in natives_jobs {
            extract_natives(&jar, &dest)?;
        }
    }

    // 5) Assets.
    let mut assets_index_id = String::from("legacy");
    if let Some(index) = &version.asset_index {
        assets_index_id = index.id.clone();
        let index_path = paths.assets_indexes().join(format!("{}.json", index.id));
        download_file(
            client,
            &index.url,
            &index_path,
            index.sha1.as_deref().map(|s| (s, HashAlgo::Sha1)),
            |_, _| {},
        )
        .await?;

        let raw = tokio::fs::read(&index_path).await?;
        let parsed: AssetsIndex = serde_json::from_slice(&raw)?;
        let objects: Vec<(String, String)> = parsed
            .objects
            .into_iter()
            .map(|(_, v)| (v.hash.clone(), v.hash))
            .collect();
        let total_assets = objects.len() as u64;
        let counter = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let objects_root = paths.assets_objects();

        let tasks = futures_util::stream::iter(objects.into_iter().map(|(hash, _)| {
            let client = client.clone();
            let objects_root = objects_root.clone();
            let counter = counter.clone();
            async move {
                let prefix = &hash[0..2];
                let dest = objects_root.join(prefix).join(&hash);
                let url = format!("https://resources.download.minecraft.net/{prefix}/{hash}");
                let res = download_file(&client, &url, &dest, Some((&hash, HashAlgo::Sha1)), |_, _| {}).await;
                counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                res
            }
        }))
        .buffer_unordered(16);

        futures_util::pin_mut!(tasks);
        while let Some(res) = tasks.next().await {
            res?;
            let n = counter.load(std::sync::atomic::Ordering::Relaxed);
            on_phase(n, Some(total_assets));
        }
        total += total_assets;
        done += total_assets;
        on_phase(done, Some(total));
    }

    // 6) Config de logging (opcional).
    let mut logging_arg = None;
    if let Some(log) = &version.logging {
        if let Some(lc) = &log.client {
            let dest = paths.root.join("logging").join(
                lc.file
                    .path
                    .clone()
                    .unwrap_or_else(|| "client-1.12.xml".to_string()),
            );
            download_file(
                client,
                &lc.file.url,
                &dest,
                lc.file.sha1.as_deref().map(|s| (s, HashAlgo::Sha1)),
                |_, _| {},
            )
            .await?;
            logging_arg = Some((lc.argument.clone(), dest));
        }
    }

    Ok(InstalledVersion {
        json: version.clone(),
        client_jar,
        libraries,
        assets_index_id,
        logging_arg,
    })
}

#[derive(Debug, Deserialize)]
struct AssetsIndex {
    objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
struct AssetObject {
    hash: String,
}

fn extract_natives(jar: &std::path::Path, dest: &std::path::Path) -> AppResult<()> {
    let file = std::fs::File::open(jar)?;
    let mut zip = zip::ZipArchive::new(file)?;
    std::fs::create_dir_all(dest)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if name.ends_with(".dll") {
            let Some(file_name) = std::path::Path::new(&name).file_name() else {
                continue;
            };
            // No sobrescribir: la primera coincidencia gana (comportamiento estándar).
            let out = dest.join(file_name);
            if out.exists() {
                continue;
            }
            let mut w = std::fs::File::create(&out)?;
            std::io::copy(&mut entry, &mut w)?;
        }
    }
    Ok(())
}
