import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite para Tauri (puerto fijo, sin ocultar errores).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
