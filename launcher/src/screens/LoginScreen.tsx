import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store";

export default function LoginScreen() {
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const busy = useStore((s) => s.busy);
  const error = useStore((s) => s.error);
  const config = useStore((s) => s.config);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (mode === "register" && password !== confirm) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }
    if (mode === "login") await login(username.trim(), password);
    else await register(username.trim(), email.trim(), password);
  }

  const show = localError ?? error;

  return (
    <div className="login-wrap">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="login-logo">
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt="logo" />
          ) : (
            <div className="avatar" style={{ width: 84, height: 84, borderRadius: 20 }}>
              <span style={{ fontSize: 34 }}>D</span>
            </div>
          )}
          <h1>{config?.serverName ?? "Dedsafio"}</h1>
          <p>{mode === "login" ? "Inicia sesión para jugar" : "Crea tu cuenta"}</p>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Usuario</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
              autoFocus
              autoComplete="username"
            />
          </div>

          {mode === "register" && (
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
          )}

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "register" && (
            <div className="field">
              <label>Repite la contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          )}

          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? <span className="spinner" /> : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        {show && <div className="error-banner">{show}</div>}

        <div className="login-links">
          <button
            className="btn-link"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setLocalError(null);
            }}
          >
            {mode === "login" ? "Crear una cuenta" : "Ya tengo cuenta"}
          </button>
          <button
            className="btn-link"
            onClick={() => {
              if (config?.discordUrl) window.open(config.discordUrl, "_blank");
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </motion.div>
    </div>
  );
}
