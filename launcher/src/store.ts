import { create } from "zustand";
import { api } from "./lib/bridge";
import type {
  LauncherConfig,
  LauncherSettings,
  NewsItem,
  ProgressEvent,
  ServerStatus,
  UserProfile,
} from "./lib/types";

export type Screen = "loading" | "login" | "home";

interface State {
  screen: Screen;
  user: UserProfile | null;
  config: LauncherConfig | null;
  status: ServerStatus | null;
  news: NewsItem[];
  settings: LauncherSettings | null;
  progress: ProgressEvent;
  busy: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshNews: () => Promise<void>;
  setSettings: (s: LauncherSettings) => Promise<void>;
  play: () => Promise<void>;
  setProgress: (p: ProgressEvent) => void;
  clearError: () => void;
}

const idleProgress: ProgressEvent = {
  phase: "idle",
  message: "Listo",
  phaseProgress: 0,
  totalProgress: 0,
};

function hardwareId(): string {
  // Identificador estable por instalación, generado y persistido por el backend Rust.
  const key = "dedsafio.hwid";
  let v = localStorage.getItem(key);
  if (!v) {
    v =
      "hw-" +
      crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(key, v);
  }
  return v;
}

function friendlyError(err: unknown): string {
  const m = typeof err === "string" ? err : (err as Error)?.message ?? "Error";
  if (m.includes("invalid_credentials"))
    return "Usuario o contraseña incorrectos.";
  if (m.includes("conflict")) return "Ese usuario o email ya está registrado.";
  if (m.includes("revoked")) return "Tu acceso a este launcher ha sido revocado.";
  return m.replace(/^Error:\s*/, "");
}

export const useStore = create<State>((set, get) => ({
  screen: "loading",
  user: null,
  config: null,
  status: null,
  news: [],
  settings: null,
  progress: idleProgress,
  busy: false,
  error: null,

  async bootstrap() {
    try {
      const [config, settings, user] = await Promise.all([
        api.getConfig(),
        api.getSettings(),
        api.me(),
      ]);
      set({ config, settings, user, screen: user ? "home" : "login" });
      void get().refreshStatus();
      void get().refreshNews();
    } catch (err) {
      set({ screen: "login", error: friendlyError(err) });
    }
  },

  async login(username, password) {
    set({ busy: true, error: null });
    try {
      const res = await api.login(username, password, hardwareId());
      set({ user: res.user, screen: "home", busy: false });
      void get().refreshStatus();
      void get().refreshNews();
    } catch (err) {
      set({ busy: false, error: friendlyError(err) });
    }
  },

  async register(username, email, password) {
    set({ busy: true, error: null });
    try {
      const res = await api.register(username, email, password);
      set({ user: res.user, screen: "home", busy: false });
    } catch (err) {
      set({ busy: false, error: friendlyError(err) });
    }
  },

  async logout() {
    await api.logout().catch(() => {});
    set({ user: null, screen: "login" });
  },

  async refreshStatus() {
    try {
      const status = await api.getServerStatus();
      set({ status });
    } catch {
      /* silencioso: se reintenta por polling */
    }
  },

  async refreshNews() {
    try {
      const news = await api.getNews();
      set({ news });
    } catch {
      /* silencioso */
    }
  },

  async setSettings(s) {
    const saved = await api.saveSettings(s);
    set({ settings: saved });
  },

  async play() {
    const settings = get().settings;
    if (!settings) return;
    set({ busy: true, error: null, progress: { ...idleProgress, phase: "checking", message: "Comprobando archivos..." } });
    try {
      await api.play(settings);
    } catch (err) {
      const message = friendlyError(err);
      set({ busy: false, error: message, progress: { ...idleProgress, phase: "error", message, error: message } });
    }
  },

  setProgress(p) {
    set({ progress: p, busy: p.phase !== "idle" && p.phase !== "running" && p.phase !== "error" });
  },

  clearError() {
    set({ error: null });
  },
}));
