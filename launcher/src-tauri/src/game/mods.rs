use std::collections::HashSet;

use crate::api_types::{Manifest, ModEntry};
use crate::error::{AppError, AppResult};
use crate::game::net::{download_file, sha256_file, HashAlgo};
use crate::game::paths::Paths;

fn ticket_for(mod_id: &str, tickets: &[crate::api_types::DownloadTicket]) -> Option<String> {
    tickets
        .iter()
        .find(|t| t.mod_id == mod_id)
        .map(|t| t.url.clone())
}

/// Sincroniza la carpeta `mods/` con el manifiesto: descarga/actualiza los mods
/// autorizados y elimina cualquier jar no gestionado.
pub async fn sync_mods<F>(
    client: &reqwest::Client,
    base_url: &str,
    paths: &Paths,
    manifest: &Manifest,
    tickets: &[crate::api_types::DownloadTicket],
    mut on_phase: F,
) -> AppResult<()>
where
    F: FnMut(u64, Option<u64>),
{
    let mods_dir = paths.mods();
    tokio::fs::create_dir_all(&mods_dir).await?;

    let total = manifest.mods.len() as u64;
    let mut done = 0u64;
    let mut keep: HashSet<String> = HashSet::new();

    for entry in &manifest.mods {
        keep.insert(entry.file_name.clone());
        let dest = mods_dir.join(&entry.file_name);
        if dest.exists() {
            let hash = sha256_file(&dest).await?;
            if hash.eq_ignore_ascii_case(&entry.sha256) {
                done += 1;
                on_phase(done, Some(total));
                continue;
            }
        }
        let Some(rel) = ticket_for(&entry.id, tickets) else {
            return Err(AppError::msg(format!(
                "Falta ticket de descarga para {}",
                entry.id
            )));
        };
        let url = format!("{base_url}{rel}");
        download_mod(client, &url, &dest, entry).await?;
        done += 1;
        on_phase(done, Some(total));
    }

    remove_unmanaged(&mods_dir, &keep).await?;
    Ok(())
}

async fn download_mod(
    client: &reqwest::Client,
    url: &str,
    dest: &std::path::Path,
    entry: &ModEntry,
) -> AppResult<()> {
    download_file(
        client,
        url,
        dest,
        Some((&entry.sha256, HashAlgo::Sha256)),
        |_, _| {},
    )
    .await
}

async fn remove_unmanaged(mods_dir: &std::path::Path, keep: &HashSet<String>) -> AppResult<()> {
    let mut read = tokio::fs::read_dir(mods_dir).await?;
    while let Some(item) = read.next_entry().await? {
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if !keep.contains(&name) {
            let path = item.path();
            if path.is_file() {
                tokio::fs::remove_file(&path).await.ok();
            }
        }
    }
    Ok(())
}
