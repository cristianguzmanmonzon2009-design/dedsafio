mod api_types;
mod commands;
mod error;
mod game;
mod log;
mod settings;
mod state;

use std::sync::Arc;

pub use state::AppState;

pub type SharedState = Arc<AppState>;

/// URL del backend embebida por defecto. Cámbiala por tu dominio público
/// (https://api.tudominio.com) antes de generar el instalador.
const DEFAULT_API_URL: &str = "http://localhost:8080";

/// Prioridad: variable de entorno DEDSAFIO_API_URL > archivo `api-url.txt`
/// junto al ejecutable > valor embebido por defecto.
fn base_url() -> String {
    if let Ok(v) = std::env::var("DEDSAFIO_API_URL") {
        let v = v.trim();
        if !v.is_empty() {
            return v.to_string();
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join("api-url.txt");
            if let Ok(s) = std::fs::read_to_string(&candidate) {
                let s = s.trim();
                if !s.is_empty() {
                    return s.to_string();
                }
            }
        }
    }
    DEFAULT_API_URL.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let api = base_url();
    log::info(&format!("iniciando launcher, api={api}"));
    let state = Arc::new(AppState::new(api).expect("no se pudo crear el estado"));

    let bootstrap_state = state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .setup(move |_app| {
            let st = bootstrap_state.clone();
            tauri::async_runtime::spawn(async move {
                st.restore_refresh_token().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::api_login,
            commands::api_register,
            commands::api_logout,
            commands::api_me,
            commands::get_config,
            commands::get_server_status,
            commands::get_news,
            commands::get_launcher_version,
            commands::get_settings,
            commands::save_settings,
            commands::detect_java,
            commands::pick_directory,
            commands::prepare_and_play,
            commands::kill_game,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Tauri");
}
