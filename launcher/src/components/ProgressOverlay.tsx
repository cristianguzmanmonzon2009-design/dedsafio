import { useStore } from "../store";

export default function ProgressOverlay() {
  const progress = useStore((s) => s.progress);
  const clearError = useStore((s) => s.clearError);

  if (progress.phase === "idle" || progress.phase === "running") return null;

  const isError = progress.phase === "error";
  const pct = Math.round((progress.totalProgress || 0) * 100);

  return (
    <div className="overlay">
      <div className={"progress-card" + (isError ? " error" : "")}>
        <h3>
          {isError
            ? "No se pudo iniciar"
            : progress.phase === "launching"
              ? "Lanzando Minecraft"
              : "Preparando el juego"}
        </h3>
        <div className="file">{progress.currentFile ?? progress.message}</div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          <span>{isError ? progress.error : progress.message}</span>
          <span>
            {!isError && progress.speedBytesPerSec
              ? `${formatSpeed(progress.speedBytesPerSec)} · `
              : ""}
            {!isError && progress.etaSeconds != null
              ? `~${formatEta(progress.etaSeconds)}`
              : `${pct}%`}
          </span>
        </div>
        {isError ? (
          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => clearError()}>
              Cerrar
            </button>
          </div>
        ) : progress.phase === "launching" ? (
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-faint)" }}>
            El juego se está abriendo…
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatSpeed(bps: number): string {
  if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.ceil(seconds / 60)} min`;
}
