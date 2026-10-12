use std::collections::HashSet;

use serde::Deserialize;

use crate::api_types::{DownloadTicket, Manifest, ModEntry};
use crate::error::AppResult;
use crate::game::net::{download_file, sha256_file, HashAlgo};
use crate::game::paths::Paths;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct TicketResponse {
    ticket: DownloadTicket,
}

/// Pide un ticket de descarga fresco (vida corta) para un mod concreto, justo
/// antes de descargarlo. Evita que un ticket caduque durante la instalación
/// (Java/Minecraft/Fabric tardan y el manifiesto se pide antes).
async fn fresh_ticket(st: &AppState, entry: &ModEntry) -> AppResult<DownloadTicket> {
    let body = serde_json::json!({ "modId": entry.id, "version": entry.version });
    let res: TicketResponse = st.post_authed("/api/v1/mods/ticket", &body).await?;
    Ok(res.ticket)
}

/// Sincroniza la carpeta `mods/` con el manifiesto: descarga/actualiza los mods
/// autorizados y elimina cualquier jar no gestionado.
pub async fn sync_mods<F>(
    st: &AppState,
    paths: &Paths,
    manifest: &Manifest,
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
        let ticket = fresh_ticket(st, entry).await?;
        let url = format!("{}{}", st.base_url, ticket.url);
        download_mod(&st.client, &url, &dest, entry).await?;
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
    while let Some(entry) = read.next_entry().await? {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !keep.contains(name.as_ref()) {
            let path = entry.path();
            if path.is_file() {
                tokio::fs::remove_file(&path).await?;
            }
        }
    }
    Ok(())
}
