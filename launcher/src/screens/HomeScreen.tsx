import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store";
import Avatar from "../components/Avatar";
import SettingsModal from "../components/SettingsModal";

export default function HomeScreen() {
  const user = useStore((s) => s.user);
  const config = useStore((s) => s.config);
  const status = useStore((s) => s.status);
  const news = useStore((s) => s.news);
  const busy = useStore((s) => s.busy);
  const logout = useStore((s) => s.logout);
  const play = useStore((s) => s.play);
  const refreshStatus = useStore((s) => s.refreshStatus);
  const refreshNews = useStore((s) => s.refreshNews);

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const id = setInterval(() => void refreshStatus(), 30_000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const online = status?.online ?? false;
  const players = status?.players.online ?? 0;
  const max = status?.players.max ?? 0;

  return (
    <motion.div
      className="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Sidebar */}
      <div className="sidebar">
        <div className="panel user-card">
          <Avatar username={user?.username ?? "?"} />
          <div className="user-meta">
            <h3>{user?.username}</h3>
            <span>{user?.role === "admin" ? "Administrador" : "Jugador"}</span>
          </div>
        </div>

        <div className="panel server-card">
          <div className="status-line">
            <span className={"pill " + (online ? "online" : "offline")} />
            {online ? "EN LÍNEA" : "DESCONECTADO"}
          </div>
          <div className="players">
            {players}
            <small> / {max}</small>
          </div>
          <div className="ver">
            {config?.minecraft} · Fabric {config?.loaderVersion}
          </div>
        </div>

        <div className="menu-buttons">
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>
            ⚙ Configuración
          </button>
          <button className="btn btn-ghost" onClick={() => void refreshNews()}>
            ↻ Actualizar noticias
          </button>
          <button className="btn btn-ghost" onClick={() => void logout()}>
            ⏻ Cerrar sesión
          </button>
        </div>
      </div>

      {/* Centro */}
      <div className="center">
        <div className="hero">
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt="logo" />
          ) : (
            <div className="avatar" style={{ width: 150, height: 150, borderRadius: 32 }}>
              <span style={{ fontSize: 60 }}>D</span>
            </div>
          )}
          <h1>{config?.serverName ?? "Dedsafio"}</h1>
          <div className="sub">{config?.minecraft} · Fabric</div>
        </div>
        <button
          className="play-btn"
          disabled={busy || !online}
          onClick={() => void play()}
          title={!online ? "El servidor está desconectado" : "Preparar y jugar"}
        >
          {busy ? "PREPARANDO…" : online ? "JUGAR" : "SERVIDOR OFFLINE"}
        </button>
      </div>

      {/* Noticias */}
      <div className="panel news-panel">
        <div className="news-head">Noticias</div>
        {news.length === 0 ? (
          <div className="news-empty">No hay novedades por ahora.</div>
        ) : (
          <div className="news-list">
            {news.map((n) => (
              <div className="news-item" key={n.id}>
                <span className="tag">{n.type}</span>
                <h4>{n.title}</h4>
                <p>{n.description}</p>
                <time>{new Date(n.publishedAt).toLocaleDateString()}</time>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </motion.div>
  );
}
