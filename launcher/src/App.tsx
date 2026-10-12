import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useStore } from "./store";
import { onGameExit, onProgress } from "./lib/bridge";
import TitleBar from "./components/TitleBar";
import Background from "./components/Background";
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProgressOverlay from "./components/ProgressOverlay";

export default function App() {
  const screen = useStore((s) => s.screen);
  const config = useStore((s) => s.config);
  const bootstrap = useStore((s) => s.bootstrap);
  const setProgress = useStore((s) => s.setProgress);

  useEffect(() => {
    void bootstrap();
    const unlisten: Array<() => void> = [];
    void onProgress(setProgress).then((u) => unlisten.push(u));
    void onGameExit((code) => {
      setProgress({
        phase: "idle",
        message: code === 0 ? "Juego cerrado" : `El juego terminó (código ${code ?? "?"})`,
        phaseProgress: 1,
        totalProgress: 1,
      });
    });
    return () => unlisten.forEach((u) => u());
  }, [bootstrap, setProgress]);

  return (
    <div className="app">
      <Background url={config?.backgroundUrl} />
      <TitleBar />
      <div className="content">
        <AnimatePresence mode="wait">
          {screen === "loading" && (
            <div className="loading-screen" key="loading">
              <div className="spinner" />
              <p style={{ color: "var(--text-dim)" }}>Iniciando launcher…</p>
            </div>
          )}
          {screen === "login" && <LoginScreen key="login" />}
          {screen === "home" && <HomeScreen key="home" />}
        </AnimatePresence>
      </div>
      <ProgressOverlay />
    </div>
  );
}
