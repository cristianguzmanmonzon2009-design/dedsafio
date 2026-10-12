use std::path::Path;
use std::time::Duration;

use futures_util::StreamExt;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;

use crate::error::{AppError, AppResult};
use crate::game::paths::ensure_parent;

const DOWNLOAD_ATTEMPTS: u32 = 4;
const DOWNLOAD_TIMEOUT_SECS: u64 = 600;

#[derive(Debug, Clone, Copy)]
pub enum HashAlgo {
    Sha256,
    Sha1,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub async fn sha256_file(path: &Path) -> AppResult<String> {
    let data = tokio::fs::read(path).await?;
    Ok(sha256_hex(&data))
}

pub async fn sha1_file(path: &Path) -> AppResult<String> {
    let data = tokio::fs::read(path).await?;
    Ok(hex::encode(Sha1::digest(&data)))
}

async fn verify(path: &Path, expected: &str, algo: HashAlgo) -> AppResult<bool> {
    if !path.exists() {
        return Ok(false);
    }
    let actual = match algo {
        HashAlgo::Sha256 => sha256_file(path).await?,
        HashAlgo::Sha1 => sha1_file(path).await?,
    };
    Ok(actual.eq_ignore_ascii_case(expected))
}

/// Descarga un archivo comprobando su hash. Omite la descarga si ya existe y
/// coincide. Reintenta ante fallos de red y escribe a un temporal antes de
/// renombrar para evitar archivos corruptos.
pub async fn download_file<F>(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    expected: Option<(&str, HashAlgo)>,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(u64, Option<u64>),
{
    ensure_parent(dest)?;
    if let Some((hash, algo)) = expected {
        if verify(dest, hash, algo).await? {
            on_progress(1, Some(1));
            return Ok(());
        }
    } else if dest.exists() {
        on_progress(1, Some(1));
        return Ok(());
    }

    let tmp = dest.with_extension("part");
    let mut last_err: Option<AppError> = None;

    for attempt in 1..=DOWNLOAD_ATTEMPTS {
        match download_once(client, url, &tmp, expected, &mut on_progress).await {
            Ok(()) => {
                tokio::fs::rename(&tmp, dest).await?;
                return Ok(());
            }
            Err(e) => {
                let _ = tokio::fs::remove_file(&tmp).await;
                last_err = Some(e);
                if attempt < DOWNLOAD_ATTEMPTS {
                    tokio::time::sleep(Duration::from_millis(700 * attempt as u64)).await;
                }
            }
        }
    }

    let err = last_err.unwrap_or_else(|| AppError::msg("Descarga fallida"));
    crate::log::error(&format!("download_file {url} -> {err}"));
    Err(err)
}

async fn download_once<F>(
    client: &reqwest::Client,
    url: &str,
    tmp: &Path,
    expected: Option<(&str, HashAlgo)>,
    on_progress: &mut F,
) -> AppResult<()>
where
    F: FnMut(u64, Option<u64>),
{
    let res = client
        .get(url)
        .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .send()
        .await?;
    if !res.status().is_success() {
        return Err(AppError::msg(format!(
            "Descarga fallida ({}) para {url}",
            res.status()
        )));
    }
    let total = res.content_length();
    let mut file = tokio::fs::File::create(tmp).await?;
    let mut downloaded: u64 = 0;
    let mut hasher = Sha256::new();
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;
        on_progress(downloaded, total);
    }
    file.flush().await?;
    drop(file);

    if let Some((hash, algo)) = expected {
        let ok = match algo {
            HashAlgo::Sha256 => hex::encode(hasher.finalize()).eq_ignore_ascii_case(hash),
            HashAlgo::Sha1 => {
                let data = tokio::fs::read(tmp).await?;
                hex::encode(Sha1::digest(&data)).eq_ignore_ascii_case(hash)
            }
        };
        if !ok {
            return Err(AppError::msg(format!("Hash inválido tras descargar {url}")));
        }
    }
    Ok(())
}
