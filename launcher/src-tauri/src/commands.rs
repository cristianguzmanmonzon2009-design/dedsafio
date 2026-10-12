use std::time::Instant;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

use crate::api_types::*;
use crate::error::{AppError, AppResult};
use crate::game::{fabric, java, launch, mods as modsync, mojang, paths::Paths};
use crate::settings::{self, LauncherSettings};
use crate::SharedState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    phase: String,
    message: String,
    current_file: Option<String>,
    phase_progress: f64,
    total_progress: f64,
    speed_bytes_per_sec: Option<f64>,
    eta_seconds: Option<f64>,
    error: Option<String>,
}

fn emit(
    app: &AppHandle,
    phase: &str,
    message: &str,
    file: Option<String>,
    pp: f64,
    tp: f64,
) {
    let _ = app.emit(
        "progress",
        ProgressEvent {
            phase: phase.to_string(),
            message: message.to_string(),
            current_file: file,
            phase_progress: pp.clamp(0.0, 1.0),
            total_progress: tp.clamp(0.0, 1.0),
            speed_bytes_per_sec: None,
            eta_seconds: None,
            error: None,
        },
    );
}

fn emit_error(app: &AppHandle, message: &str) {
    let _ = app.emit(
        "progress",
        ProgressEvent {
            phase: "error".into(),
            message: message.to_string(),
            current_file: None,
            phase_progress: 0.0,
            total_progress: 0.0,
            speed_bytes_per_sec: None,
            eta_seconds: None,
            error: Some(message.to_string()),
        },
    );
}

/// Reparte el progreso de una fase dentro de un tramo del total.
struct Phase<'a> {
    app: &'a AppHandle,
    phase: &'a str,
    message: &'a str,
    base: f64,
    span: f64,
    started: Instant,
    last_bytes: u64,
    last: Instant,
}

impl<'a> Phase<'a> {
    fn new(app: &'a AppHandle, phase: &'a str, message: &'a str, base: f64, span: f64) -> Self {
        let now = Instant::now();
        Self {
            app,
            phase,
            message,
            base,
            span,
            started: now,
            last_bytes: 0,
            last: now,
        }
    }

    fn tick(&mut self, done: u64, total: Option<u64>) {
        let frac = match total {
            Some(t) if t > 0 => (done as f64 / t as f64).clamp(0.0, 1.0),
            _ => 0.0,
        };
        let now = Instant::now();
        let dt = now.duration_since(self.last).as_secs_f64();
        let speed = if dt > 0.25 {
            let s = (done.saturating_sub(self.last_bytes)) as f64 / dt;
            self.last = now;
            self.last_bytes = done;
            Some(s)
        } else {
            None
        };
        let eta = match (total, speed) {
            (Some(t), Some(s)) if s > 1.0 && t > done => Some((t - done) as f64 / s),
            _ => None,
        };
        let _ = self.app.emit(
            "progress",
            ProgressEvent {
                phase: self.phase.to_string(),
                message: self.message.to_string(),
                current_file: None,
                phase_progress: frac,
                total_progress: self.base + self.span * frac,
                speed_bytes_per_sec: speed,
                eta_seconds: eta,
                error: None,
            },
        );
    }
}

/* ------------------------------- Auth ------------------------------- */

#[tauri::command]
pub async fn api_login(
    state: State<'_, SharedState>,
    app: AppHandle,
    username: String,
    password: String,
    hardware_id: String,
) -> Result<AuthResponse, AppError> {
    let _ = &app;
    let st = state.inner().clone();
    let body = serde_json::json!({
        "username": username,
        "password": password,
        "hardwareId": hardware_id,
    });
    let res = st.client.post(st.url("/api/v1/auth/login")).json(&body).send().await?;
    if !res.status().is_success() {
        return Err(map_status(res).await);
    }
    let auth: AuthResponse = res.json().await?;
    st.set_session(&auth.tokens).await;
    st.set_hardware_id(&hardware_id).await;
    st.set_username(&auth.user.username).await;
    Ok(auth)
}

#[tauri::command]
pub async fn api_register(
    state: State<'_, SharedState>,
    username: String,
    email: String,
    password: String,
) -> Result<AuthResponse, AppError> {
    let st = state.inner().clone();
    let body = serde_json::json!({ "username": username, "email": email, "password": password });
    let res = st
        .client
        .post(st.url("/api/v1/auth/register"))
        .json(&body)
        .send()
        .await?;
    if !res.status().is_success() {
        return Err(map_status(res).await);
    }
    let auth: AuthResponse = res.json().await?;
    st.set_session(&auth.tokens).await;
    st.set_username(&auth.user.username).await;
    Ok(auth)
}

#[tauri::command]
pub async fn api_logout(state: State<'_, SharedState>) -> Result<(), AppError> {
    let st = state.inner().clone();
    if let Some(refresh) = st.refresh_token().await {
        let _ = st
            .client
            .post(st.url("/api/v1/auth/logout"))
            .json(&serde_json::json!({ "refreshToken": refresh }))
            .send()
            .await;
    }
    st.clear_session().await;
    Ok(())
}

#[tauri::command]
pub async fn api_me(state: State<'_, SharedState>) -> Result<Option<UserProfile>, AppError> {
    let st = state.inner().clone();
    let has_refresh = st.refresh_token().await.is_some();
    if st.access_token().await.is_none() && !has_refresh {
        return Ok(None);
    }
    match st.get_authed::<UserResponse>("/api/v1/me").await {
        Ok(res) => {
            st.set_username(&res.user.username).await;
            Ok(Some(res.user))
        }
        Err(_) => {
            st.clear_session().await;
            Ok(None)
        }
    }
}

/* ------------------------------- API pública ------------------------------- */

#[tauri::command]
pub async fn get_config(state: State<'_, SharedState>) -> Result<LauncherConfig, AppError> {
    let st = state.inner().clone();
    let res: LauncherConfigResponse = st
        .client
        .get(st.url("/api/v1/launcher/config"))
        .send()
        .await?
        .json()
        .await?;
    Ok(res.config)
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, SharedState>) -> Result<ServerStatus, AppError> {
    let st = state.inner().clone();
    let res: ServerStatusResponse = st
        .client
        .get(st.url("/api/v1/server/status"))
        .send()
        .await?
        .json()
        .await?;
    Ok(res.status)
}

#[tauri::command]
pub async fn get_news(state: State<'_, SharedState>) -> Result<Vec<NewsItem>, AppError> {
    let st = state.inner().clone();
    let res: NewsResponse = st
        .client
        .get(st.url("/api/v1/news"))
        .send()
        .await?
        .json()
        .await?;
    Ok(res.news)
}

#[tauri::command]
pub async fn get_launcher_version(state: State<'_, SharedState>) -> Result<LauncherVersion, AppError> {
    let st = state.inner().clone();
    let res: LauncherVersion = st
        .client
        .get(st.url("/api/v1/launcher/version"))
        .send()
        .await?
        .json()
        .await?;
    Ok(res)
}

/* ------------------------------- Ajustes ------------------------------- */

#[tauri::command]
pub async fn get_settings() -> Result<LauncherSettings, AppError> {
    Ok(settings::load().await)
}

#[tauri::command]
pub async fn save_settings(value: LauncherSettings) -> Result<LauncherSettings, AppError> {
    settings::save(&value).await
}

#[tauri::command]
pub async fn detect_java(state: State<'_, SharedState>) -> Result<Option<java::JavaInfo>, AppError> {
    let _ = state;
    let cfg = settings::load().await;
    let paths = Paths::resolve_or_default(
        if cfg.install_dir.is_empty() {
            None
        } else {
            Some(cfg.install_dir.as_str())
        },
        "endersafio",
    );
    Ok(java::detect(&paths).await)
}

#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> Result<Option<String>, AppError> {
    let picked = app.dialog().file().blocking_pick_folder();
    Ok(picked
        .and_then(|p| p.into_path().ok())
        .map(|pb| pb.to_string_lossy().to_string()))
}

/* ------------------------------- Juego ------------------------------- */

#[tauri::command]
pub async fn prepare_and_play(
    state: State<'_, SharedState>,
    app: AppHandle,
    settings: LauncherSettings,
) -> Result<(), AppError> {
    let st = state.inner().clone();
    if let Err(e) = play_inner(&st, &app, &settings).await {
        emit_error(&app, &e.to_string());
        return Err(e);
    }
    Ok(())
}

async fn play_inner(st: &SharedState, app: &AppHandle, settings: &LauncherSettings) -> AppResult<()> {
    emit(app, "checking", "Comprobando actualizaciones…", None, 0.0, 0.0);

    // 1) Configuración del servidor.
    let cfg: LauncherConfigResponse = st
        .client
        .get(st.url("/api/v1/launcher/config"))
        .send()
        .await?
        .json()
        .await?;
    let server_id = cfg.config.server_id.clone();
    let paths = Paths::resolve_or_default(
        if settings.install_dir.is_empty() {
            None
        } else {
            Some(settings.install_dir.as_str())
        },
        &server_id,
    );
    paths.ensure_root()?;
    std::fs::create_dir_all(paths.instance())?;

    // 2) Manifiesto firmado + tickets de descarga.
    let manifest: ManifestResponse = st
        .get_authed("/api/v1/mods/manifest")
        .await
        .map_err(|e| AppError::msg(format!("No se pudo obtener el manifiesto: {e}")))?;

    // 3) Java.
    let mut java_phase = Phase::new(app, "java", "Preparando Java…", 0.0, 0.10);
    let java_info = java::ensure_java(
        &st.client,
        &paths,
        cfg.config.java_major,
        |d, t| java_phase.tick(d, t),
    )
    .await?;

    // 4) Minecraft vanilla.
    emit(app, "minecraft", "Descargando Minecraft…", None, 0.0, 0.10);
    let version_json = mojang::fetch_version_json(&st.client, &cfg.config.minecraft).await?;
    let mut mc_phase = Phase::new(app, "minecraft", "Instalando Minecraft…", 0.10, 0.40);
    let vanilla = mojang::install_version(&st.client, &paths, &version_json, |d, t| mc_phase.tick(d, t)).await?;

    // 5) Fabric.
    let mut fb_phase = Phase::new(app, "fabric", "Instalando Fabric…", 0.50, 0.10);
    let fabric_install = fabric::install(
        &st.client,
        &paths,
        &cfg.config.minecraft,
        &cfg.config.loader_version,
        |d, t| fb_phase.tick(d, t),
    )
    .await?;

    // 6) Mods.
    let mut mods_phase = Phase::new(app, "mods", "Descargando mods privados…", 0.60, 0.30);
    modsync::sync_mods(
        &st.client,
        &st.base_url,
        &paths,
        &manifest.manifest,
        &manifest.tickets,
        |d, t| mods_phase.tick(d, t),
    )
    .await?;

    // 7) Licencia (el mod la revalida en el handshake).
    emit(app, "verifying", "Verificando licencia…", None, 0.92, 0.97);
    let hardware_id = st.hardware_id().await;
    let license = st
        .post_authed::<_, serde_json::Value>(
            "/api/v1/license/session",
            &serde_json::json!({
                "hardwareId": hardware_id,
                "serverId": server_id,
                "manifestVersion": manifest.manifest.version,
            }),
        )
        .await
        .ok();

    // 8) Lanzar.
    emit(app, "launching", "Lanzando Minecraft…", None, 1.0, 1.0);
    let version_label = format!("{}-fabric{}", cfg.config.minecraft, cfg.config.loader_version);
    let log_file = paths.instance().join("logs").join("launcher-run.log");
    let spec = launch::LaunchSpec {
        java: std::path::Path::new(&java_info.path),
        paths: &paths,
        vanilla: &vanilla,
        fabric: &fabric_install,
        username: &st.username().await,
        min_ram_mb: settings.min_ram_mb,
        max_ram_mb: settings.max_ram_mb,
        width: settings.width,
        height: settings.height,
        fullscreen: settings.fullscreen,
        extra_jvm_args: &settings.jvm_args,
        version_label: &version_label,
    };

    if let Some(license) = &license {
        if let Some(token) = license.get("licenseToken").and_then(|v| v.as_str()) {
            std::env::set_var("DEDSAFIO_LICENSE", token);
        }
    }
    std::env::set_var("DEDSAFIO_HWID", &hardware_id);
    std::env::set_var("DEDSAFIO_SERVER_ID", &server_id);

    let child = launch::spawn(&spec, &log_file)?;
    *st.child.lock().await = Some(child);

    // Vigilancia del proceso sin bloquear `kill_game`.
    let child_state = st.child.clone();
    let app_clone = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let mut guard = child_state.blocking_lock();
        match guard.as_mut() {
            None => break,
            Some(proc) => match proc.try_wait() {
                Ok(Some(status)) => {
                    *guard = None;
                    let _ = app_clone.emit("game-exit", status.code());
                    break;
                }
                Ok(None) => {}
                Err(_) => {
                    *guard = None;
                    break;
                }
            },
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn kill_game(state: State<'_, SharedState>) -> Result<(), AppError> {
    let st = state.inner().clone();
    let mut guard = st.child.lock().await;
    if let Some(child) = guard.as_mut() {
        let _ = child.kill();
    }
    *guard = None;
    Ok(())
}

/* ------------------------------- Auxiliares ------------------------------- */

async fn map_status(res: reqwest::Response) -> AppError {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let code = match status {
        reqwest::StatusCode::UNAUTHORIZED => "invalid_credentials",
        reqwest::StatusCode::CONFLICT => "conflict",
        reqwest::StatusCode::FORBIDDEN => "revoked",
        _ => "http_error",
    };
    AppError::msg(format!("{code}: {text}"))
}
