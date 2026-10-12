# Launcher (Tauri 2 + React/TS)

Launcher privado de Dedsafio. El usuario solo abre el launcher, inicia sesión y
pulsa **JUGAR**: el launcher instala Java, Minecraft 1.21.1, Fabric y los mods
privados (descifrados por el backend) y arranca el juego.

## Estructura

```
launcher/
├── index.html
├── package.json            # React + Vite + @tauri-apps/api
├── vite.config.ts
├── src/                    # UI (React + TS)
│   ├── App.tsx
│   ├── store.ts            # estado global (zustand)
│   ├── lib/bridge.ts       # envoltorio tipado de los comandos Tauri
│   ├── lib/types.ts        # tipos que espejan el contrato del backend
│   ├── components/         # TitleBar, ProgressOverlay, SettingsModal, Avatar...
│   └── screens/            # LoginScreen, HomeScreen
└── src-tauri/              # Backend Rust del launcher
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── lib.rs          # builder Tauri + registro de comandos
        ├── commands.rs     # comandos expuestos a la UI
        ├── state.rs        # sesión (memoria + Credential Manager)
        ├── settings.rs     # ajustes (RAM, resolución, carpeta...)
        ├── api_types.rs    # DTOs del backend
        └── game/           # java, mojang, fabric, mods, launch, net, paths
```

## Comandos Tauri (invoke)

| Comando | Descripción |
|---|---|
| `api_login` / `api_register` / `api_logout` / `api_me` | Autenticación contra el backend |
| `get_config` / `get_server_status` / `get_news` / `get_launcher_version` | Datos públicos |
| `get_settings` / `save_settings` / `detect_java` / `pick_directory` | Ajustes |
| `prepare_and_play` | Instala Java+MC+Fabric+mods y lanza el juego |
| `kill_game` | Cierra el proceso del juego |

Progreso por el evento `progress`; fin del juego por `game-exit`.

## Seguridad

- Los tokens **no** viven en la UI: los guarda el proceso Rust. El refresh token
  se persiste en el **Credential Manager de Windows** (`keyring`).
- Los mods se descargan con **tickets HMAC de corta duración** enviados por el
  backend y se verifica **SHA-256** de cada archivo antes de usarlo.
- La carpeta `mods/` se sincroniza: se eliminan los `.jar` no gestionados.
- La licencia (`/license/session`) se pasa al juego por entorno (`DEDSAFIO_LICENSE`).

## Requisitos de compilación

- Node 20+ y **Rust** (rustup + MSVC Build Tools). Ver `docs/DEV.md`.
- Genera los iconos antes de compilar: `npm run tauri icon ruta/logo.png`.

## Comandos

```
# En la carpeta launcher/
npm install
npm run dev          # UI en el navegador (sin comandos Tauri)
npm run typecheck    # Verificación de tipos
npm run tauri:dev    # Ejecuta la app completa (requiere Rust)
npm run tauri:build  # Genera el instalador NSIS en src-tauri/target/release/bundle
```

El backend se localiza por la variable de entorno `DEDSAFIO_API_URL`
(por defecto `http://localhost:8080`).
