import { useState } from "react";
import { useStore } from "../store";
import type { LauncherSettings } from "../lib/types";
import { api } from "../lib/bridge";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [draft, setDraft] = useState<LauncherSettings>(
    settings ?? {
      minRamMb: 2048,
      maxRamMb: 4096,
      width: 1280,
      height: 720,
      fullscreen: false,
      installDir: "",
      jvmArgs: "",
      language: "es_es",
      autoUpdate: true,
    },
  );
  const [java, setJava] = useState<string>("detectando…");
  const [saving, setSaving] = useState(false);

  async function pickDir() {
    try {
      const dir = await api.pickDirectory();
      if (dir) setDraft({ ...draft, installDir: dir });
    } catch {
      /* cancelado */
    }
  }

  async function detect() {
    const info = await api.detectJava();
    setJava(info ? `${info.version} (Java ${info.major})` : "No encontrado");
  }

  async function save() {
    setSaving(true);
    await setSettings(draft);
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración</h2>
          <button className="btn-link" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="settings-group">
          <h4>Rendimiento</h4>
          <div className="row">
            <label>Memoria máxima (MB)</label>
            <input
              type="number"
              value={draft.maxRamMb}
              onChange={(e) =>
                setDraft({ ...draft, maxRamMb: Number(e.target.value) })
              }
            />
          </div>
          <div className="row">
            <label>Memoria mínima (MB)</label>
            <input
              type="number"
              value={draft.minRamMb}
              onChange={(e) =>
                setDraft({ ...draft, minRamMb: Number(e.target.value) })
              }
            />
          </div>
          <div className="row">
            <label>
              Argumentos JVM
              <span className="hint"> Avanzado — opcional</span>
            </label>
            <input
              type="text"
              value={draft.jvmArgs}
              onChange={(e) => setDraft({ ...draft, jvmArgs: e.target.value })}
            />
          </div>
        </div>

        <div className="settings-group">
          <h4>Ventana</h4>
          <div className="row">
            <label>Resolución</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                value={draft.width}
                onChange={(e) =>
                  setDraft({ ...draft, width: Number(e.target.value) })
                }
              />
              <input
                type="number"
                value={draft.height}
                onChange={(e) =>
                  setDraft({ ...draft, height: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="row">
            <label>Pantalla completa</label>
            <div
              className={"switch" + (draft.fullscreen ? " on" : "")}
              onClick={() => setDraft({ ...draft, fullscreen: !draft.fullscreen })}
            />
          </div>
        </div>

        <div className="settings-group">
          <h4>Instalación</h4>
          <div className="row">
            <label>Carpeta de instalación</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="hint" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {draft.installDir || "(por defecto)"}
              </span>
              <button className="btn btn-ghost" style={{ width: "auto", height: 38, padding: "0 14px" }} onClick={pickDir}>
                Elegir
              </button>
            </div>
          </div>
          <div className="row">
            <label>Java detectado</label>
            <span className="hint">{java}</span>
          </div>
          <div className="row">
            <label>Idioma del juego</label>
            <input
              type="text"
              value={draft.language}
              onChange={(e) => setDraft({ ...draft, language: e.target.value })}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => { onClose(); void detect(); }}>
            Probar
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
