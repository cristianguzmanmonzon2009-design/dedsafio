use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use md5::compute as md5_compute;
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::game::fabric::FabricInstall;
use crate::game::mojang::{InstalledVersion, Rule};
use crate::game::paths::Paths;

pub struct LaunchSpec<'a> {
    pub java: &'a Path,
    pub paths: &'a Paths,
    pub vanilla: &'a InstalledVersion,
    pub fabric: &'a FabricInstall,
    pub username: &'a str,
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
    pub width: u32,
    pub height: u32,
    pub fullscreen: bool,
    pub extra_jvm_args: &'a str,
    pub version_label: &'a str,
}

fn offline_uuid(username: &str) -> String {
    let digest = md5_compute(format!("OfflinePlayer:{username}"));
    let hex = format!("{digest:x}");
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

fn arg_allowed(value: &Value) -> bool {
    let Some(rules) = value.get("rules") else {
        return true;
    };
    let Ok(rules) = serde_json::from_value::<Vec<Rule>>(rules.clone()) else {
        return true;
    };
    let mut allowed = false;
    for rule in &rules {
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

fn resolve_list(list: &[Value], subs: &HashMap<String, String>) -> Vec<String> {
    let mut out = Vec::new();
    for item in list {
        if let Some(s) = item.as_str() {
            out.push(substitute(s, subs));
            continue;
        }
        if item.is_object() {
            if !arg_allowed(item) {
                continue;
            }
            if let Some(value) = item.get("value") {
                match value {
                    Value::String(s) => out.push(substitute(s, subs)),
                    Value::Array(arr) => {
                        for v in arr {
                            if let Some(s) = v.as_str() {
                                out.push(substitute(s, subs));
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    out
}

fn substitute(input: &str, subs: &HashMap<String, String>) -> String {
    let mut out = input.to_string();
    for (k, v) in subs {
        out = out.replace(&format!("${{{k}}}"), v);
    }
    out
}

fn classpath(entries: &[PathBuf]) -> String {
    std::env::join_paths(entries)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// Construye los argumentos completos (sin el ejecutable java).
pub fn build_arguments(spec: &LaunchSpec) -> AppResult<(Vec<String>, Vec<String>, String)> {
    let instance = spec.paths.instance();
    let natives = spec.paths.natives(&spec.vanilla.json.id);
    let assets_root = spec.paths.assets();

    let mut cp_entries: Vec<PathBuf> = Vec::new();
    cp_entries.push(spec.vanilla.client_jar.clone());
    cp_entries.extend(spec.vanilla.libraries.iter().cloned());
    cp_entries.extend(spec.fabric.libraries.iter().cloned());
    let cp = classpath(&cp_entries);

    let mut subs: HashMap<String, String> = HashMap::new();
    subs.insert("auth_player_name".into(), spec.username.to_string());
    subs.insert("version_name".into(), spec.version_label.to_string());
    subs.insert("game_directory".into(), instance.to_string_lossy().to_string());
    subs.insert("assets_root".into(), assets_root.to_string_lossy().to_string());
    subs.insert("assets_index_name".into(), spec.vanilla.assets_index_id.clone());
    subs.insert("auth_uuid".into(), offline_uuid(spec.username));
    subs.insert("auth_access_token".into(), "0".into());
    subs.insert("clientid".into(), String::new());
    subs.insert("auth_xuid".into(), String::new());
    subs.insert("user_type".into(), "legacy".into());
    subs.insert("user_properties".into(), "{}".into());
    subs.insert("version_type".into(), "release".into());
    subs.insert("natives_directory".into(), natives.to_string_lossy().to_string());
    subs.insert("classpath".into(), cp);
    subs.insert("classpath_separator".into(), ";".into());
    subs.insert("library_directory".into(), spec.paths.libraries().to_string_lossy().to_string());
    subs.insert("launcher_name".into(), "DedsafioLauncher".into());
    subs.insert("launcher_version".into(), env!("CARGO_PKG_VERSION").into());

    let mut jvm: Vec<String> = Vec::new();
    jvm.push(format!("-Xmx{}M", spec.max_ram_mb.max(1024)));
    jvm.push(format!("-Xms{}M", spec.min_ram_mb.min(spec.max_ram_mb).max(512)));
    jvm.push("-Dfile.encoding=UTF-8".into());

    if let Some((arg, path)) = &spec.vanilla.logging_arg {
        subs.insert("path".into(), path.to_string_lossy().to_string());
        jvm.push(substitute(arg, &subs));
    }

    if let Some(args) = &spec.vanilla.json.arguments {
        jvm.extend(resolve_list(&args.jvm, &subs));
    } else {
        jvm.push("-Djava.library.path=${natives_directory}".into());
        jvm.push("-cp".into());
        jvm.push("${classpath}".into());
    }
    if let Some(args) = &spec.fabric.arguments {
        jvm.extend(resolve_list(&args.jvm, &subs));
    }

    for part in spec.extra_jvm_args.split_whitespace() {
        if !part.is_empty() {
            jvm.push(part.to_string());
        }
    }

    let mut game: Vec<String> = Vec::new();
    if let Some(args) = &spec.vanilla.json.arguments {
        game.extend(resolve_list(&args.game, &subs));
    }
    if let Some(args) = &spec.fabric.arguments {
        game.extend(resolve_list(&args.game, &subs));
    }

    if !spec.fullscreen {
        game.push("--width".into());
        game.push(spec.width.to_string());
        game.push("--height".into());
        game.push(spec.height.to_string());
    } else {
        game.push("--fullscreen".into());
    }

    let main_class = spec.fabric.main_class.clone();
    Ok((jvm, game, main_class))
}

/// Lanza el juego y devuelve el proceso hijo.
pub fn spawn(spec: &LaunchSpec, log_file: &Path) -> AppResult<std::process::Child> {
    let (mut jvm, game, main_class) = build_arguments(spec)?;

    let mut args: Vec<String> = Vec::new();
    args.append(&mut jvm);
    args.push(main_class);
    args.extend(game);

    if let Some(parent) = log_file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let stdout = std::fs::File::create(log_file)?;
    let stderr = stdout.try_clone()?;

    let child = std::process::Command::new(spec.java)
        .args(&args)
        .current_dir(spec.paths.instance())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .stdin(Stdio::null())
        .env("APPDATA", spec.paths.root.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| AppError::msg(format!("No se pudo lanzar el juego: {e}")))?;

    Ok(child)
}
