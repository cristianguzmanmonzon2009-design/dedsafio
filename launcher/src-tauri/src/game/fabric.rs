use std::path::PathBuf;

use serde::Deserialize;

use crate::error::AppResult;
use crate::game::mojang::{maven_path, Arguments};
use crate::game::net::{download_file, HashAlgo};
use crate::game::paths::Paths;

const FABRIC_META: &str = "https://meta.fabricmc.net/v2/versions/loader";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FabricProfile {
    pub id: String,
    pub main_class: String,
    #[serde(default)]
    pub libraries: Vec<FabricLibrary>,
    #[serde(default)]
    pub arguments: Option<Arguments>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FabricLibrary {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}

pub struct FabricInstall {
    pub main_class: String,
    pub libraries: Vec<PathBuf>,
    pub arguments: Option<Arguments>,
}

/// Descarga el perfil de Fabric y sus librerías para (game, loader) concretos.
pub async fn install<F>(
    client: &reqwest::Client,
    paths: &Paths,
    game: &str,
    loader: &str,
    mut on_phase: F,
) -> AppResult<FabricInstall>
where
    F: FnMut(u64, Option<u64>),
{
    let url = format!("{FABRIC_META}/{game}/{loader}/profile/json");
    let profile: FabricProfile = client.get(&url).send().await?.json().await?;

    let mut libraries: Vec<PathBuf> = Vec::new();
    let total = profile.libraries.len() as u64;
    let mut done = 0u64;
    for lib in &profile.libraries {
        let Some(base) = &lib.url else { continue };
        let rel = maven_path(&lib.name);
        let dest = paths.libraries().join(&rel);
        let full = if base.ends_with('/') {
            format!("{base}{rel}")
        } else {
            format!("{base}/{rel}")
        };
        download_file(
            client,
            &full,
            &dest,
            lib.sha1.as_deref().map(|s| (s, HashAlgo::Sha1)),
            |_, _| {},
        )
        .await?;
        libraries.push(dest);
        done += 1;
        on_phase(done, Some(total));
    }

    Ok(FabricInstall {
        main_class: profile.main_class,
        libraries,
        arguments: profile.arguments,
    })
}
