import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AuthResponse,
  JavaInfo,
  LauncherConfig,
  LauncherSettings,
  LauncherVersion,
  NewsItem,
  ProgressEvent,
  ServerStatus,
  UserProfile,
} from "./types";

/**
 * Puente tipado sobre los comandos de Tauri (`src-tauri`).
 * La UI nunca maneja tokens de backend: se guardan en el proceso Rust
 * (memoria + Credential Manager del SO).
 */

export const api = {
  login: (username: string, password: string, hardwareId: string) =>
    invoke<AuthResponse>("api_login", { username, password, hardwareId }),

  register: (username: string, email: string, password: string) =>
    invoke<AuthResponse>("api_register", { username, email, password }),

  logout: () => invoke<void>("api_logout"),

  me: () => invoke<UserProfile | null>("api_me"),

  getConfig: () => invoke<LauncherConfig>("get_config"),

  getServerStatus: () => invoke<ServerStatus>("get_server_status"),

  getNews: () => invoke<NewsItem[]>("get_news"),

  getLauncherVersion: () => invoke<LauncherVersion>("get_launcher_version"),

  detectJava: () => invoke<JavaInfo | null>("detect_java"),

  pickDirectory: () => invoke<string | null>("pick_directory"),

  getSettings: () => invoke<LauncherSettings>("get_settings"),

  saveSettings: (settings: LauncherSettings) =>
    invoke<LauncherSettings>("save_settings", { settings }),

  play: (settings: LauncherSettings) =>
    invoke<void>("prepare_and_play", { settings }),

  killGame: () => invoke<void>("kill_game"),
};

export function onProgress(cb: (e: ProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ProgressEvent>("progress", (event) => cb(event.payload));
}

export function onGameExit(cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<number | null>("game-exit", (event) => cb(event.payload));
}
