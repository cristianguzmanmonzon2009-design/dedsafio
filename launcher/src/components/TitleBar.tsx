import { getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();

export default function TitleBar() {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <span className="dot" />
        Dedsafio Launcher
      </div>
      <div className="win-controls">
        <button title="Minimizar" onClick={() => win.minimize()}>
          <svg width="11" height="11" viewBox="0 0 11 11">
            <rect x="0" y="5" width="11" height="1.4" fill="currentColor" />
          </svg>
        </button>
        <button title="Maximizar" onClick={() => win.toggleMaximize()}>
          <svg width="11" height="11" viewBox="0 0 11 11">
            <rect
              x="1"
              y="1"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </button>
        <button className="close" title="Cerrar" onClick={() => win.close()}>
          <svg width="11" height="11" viewBox="0 0 11 11">
            <path
              d="M1 1 L10 10 M10 1 L1 10"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
