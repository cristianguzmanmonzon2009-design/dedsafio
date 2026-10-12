use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherSettings {
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
    pub width: u32,
    pub height: u32,
    pub fullscreen: bool,
    pub install_dir: String,
    pub jvm_args: String,
    pub language: String,
    pub auto_update: bool,
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            min_ram_mb: 2048,
            max_ram_mb: 4096,
            width: 1280,
            height: 720,
            fullscreen: false,
            install_dir: String::new(),
            jvm_args: String::new(),
            language: "es_es".to_string(),
            auto_update: true,
        }
    }
}

fn settings_path() -> std::path::PathBuf {
    crate::game::paths::Paths::default_root().join("settings.json")
}

pub async fn load() -> LauncherSettings {
    let path = settings_path();
    match tokio::fs::read(&path).await {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => LauncherSettings::default(),
    }
}

pub async fn save(settings: &LauncherSettings) -> AppResult<LauncherSettings> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let data = serde_json::to_vec_pretty(settings)?;
    tokio::fs::write(&path, data).await?;
    Ok(settings.clone())
}

/// Sugiere memoria máxima según la RAM del sistema (por si se quiere usar).
pub fn suggested_max_ram() -> u32 {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_memory();
    let total_mb = (sys.total_memory() / 1024 / 1024) as u32;
    (total_mb / 2).clamp(2048, 8192)
}

#[allow(dead_code)]
fn _assert_path(_: &Path) {}
