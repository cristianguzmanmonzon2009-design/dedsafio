# Distribución del launcher

Componentes y quién ve qué:

| Pieza | Se compila con | El jugador la recibe |
|---|---|---|
| **Backend** (Node + PostgreSQL) | Node | No (corre en tu servidor, vía HTTPS) |
| **Launcher** (instalador `.exe`) | Node + Rust/Tauri | Sí (lo descarga e instala) |
| **Mods** (incl. `dedsafio` guard) | — | No: el launcher los baja del backend |
| **Servidor de Minecraft** | Java | No (lo tienes tú) |

En resumen: **públicas el backend con HTTPS, apuntas el launcher a ese backend, generas
el instalador y lo repartes**. Los mods viajan por el backend, nunca aparte.

---

## 1. Poner el backend online (HTTPS)

> **Recomendado (gratis y sin depender de tu PC):** despliega el backend en la
> nube con **Render + Neon + Cloudflare R2**. Pasos completos en
> [`DEPLOY.md`](./DEPLOY.md) sección **0**. Con eso el launcher solo necesita tu
> URL pública (`https://...`) y tus jugadores no encienden nada de tu parte.

### Opción rápida para probar (túnel)
```powershell
# instala cloudflared y expone tu backend local con HTTPS
cloudflared tunnel --url http://localhost:8080
```
Te dará una URL tipo `https://xxxx.trycloudflare.com`. Esa es la URL del API.

### Opción producción (VPS / tu host)
1. Con Docker, en `backend/`:
   ```bash
   docker compose up -d db
   npm install
   npm run build:shared && npm run build:backend
   npx prisma migrate deploy --schema backend/prisma/schema.prisma
   npm run -w @dedsafio/backend db:seed
   ```
2. Sube tu carpeta `mods-source/` con los `.jar` y publica:
   ```bash
   npm run mods:publish-all
   npm run mods:manifest
   ```
3. Arranca el backend detrás de un reverse proxy (Nginx/Caddy) con **HTTPS** y
   dominio, p. ej. `https://api.tudominio.com`.

### Ajustes de entorno en producción (`backend/.env`)
- `NODE_ENV=production` (desactiva el devToken de recuperación).
- `DATABASE_URL` real.
3. `CORS_ORIGINS=tauri://localhost` (y tu web si la hay).
4. `SERVER_ID`, `SERVER_NAME`, `SERVER_HOST`, `SERVER_PORT` correctos.
4. Branding opcional: `BRANDING_LOGO_URL`, `BRANDING_BACKGROUND_URL`, `BRANDING_DISCORD_URL`.
5. Auto-actualizador: `LAUNCHER_LATEST_VERSION`, `LAUNCHER_MINIMUM_VERSION`,
   `LAUNCHER_MANDATORY`, `LAUNCHER_DOWNLOAD_URL`, `LAUNCHER_DOWNLOAD_SHA256`.

> El launcher conecta por HTTPS (el CSP ya permite `https:`), así que un dominio
> con TLS funciona sin tocar configuración.

---

## 2. Instalar el mod guard en el SERVIDOR de Minecraft

El mod `dedsafio` valida la licencia del launcher. **Debe estar también en el servidor**:

1. Copia `mod/dedsafio-guard-1.0.0.jar` a la carpeta `mods/` del servidor Fabric 1.21.1.
2. Arranca el servidor con estas variables de entorno:
   ```
   DEDSAFIO_SERVER_ID=endersafio
   DEDSAFIO_API_URL=https://tu-api-publico       # el mismo backend
   DEDSAFIO_MANIFEST_VERSION=m-6591d436b24a       # versión actual del manifiesto
   DEDSAFIO_EXPECTED_MODS=endersafio,dedsafio,fabric-api,...   # ids obligatorios (opcional)
   ```
   Si `DEDSAFIO_EXPECTED_MODS` está vacío, solo se valida la licencia.
   Sirve también para expulsar a quien active mods prohibidos de más.

---

## 3. Apuntar el launcher a tu backend

El launcher resuelve el API así (en orden):
1. variable de entorno `DEDSAFIO_API_URL`;
2. archivo `api-url.txt` junto al `dedsafio-launcher.exe` (una sola línea, p. ej. `https://tu-api-publico`);
3. valor embebido `DEFAULT_API_URL` en `launcher/src-tauri/src/lib.rs`.

**Recomendado:** edita `DEFAULT_API_URL` a tu URL pública y recompila:
```powershell
# asegúrate de tener el PATH con Rust + MinGW
$env:Path = "$env:USERPROFILE\.cargo\bin;C:\Users\Usuario\mingw\bin;" + $env:Path
npm run launcher:build
```
El instalador sale en:
`launcher\src-tauri\target\release\bundle\nsis\Dedsafio Launcher_0.1.0_x64-setup.exe`

---

## 4. Branding e iconos (opcional)

- Logo del launcher: coloca tu PNG y regenera iconos:
  ```bash
  npm --prefix launcher run tauri icon ruta/logo.png
  ```
- Background/logo de la ventana: variables `BRANDING_*` del backend (se sirven por HTTPS).

---

## 5. Repartir a los jugadores

1. Sube el `Dedsafio Launcher_0.1.0_x64-setup.exe` a Discord / Drive / tu web.
2. El jugador solo hace: instalar → abrir → crear cuenta o iniciar sesión → **JUGAR**.
3. El launcher (primera vez) instala Java, Minecraft 1.21.1, Fabric y todos los mods,
   y comprueba el hash de cada archivo.

Crear cuentas: el propio launcher tiene «Crear una cuenta». Para cerrar el registro y
darlo tú, gestiona usuarios desde los endpoints de administración (`/api/v1/admin/...`)
con el usuario `admin`.

---

## 6. Actualizaciones

- Solo mods / versión de manifiesto: publica los nuevos `.jar` y ejecuta
  `npm run mods:manifest`. Los launchers cogen el manifiesto nuevo solos.
- Nueva versión del launcher: sube el nuevo `setup.exe`, actualiza
  `LAUNCHER_LATEST_VERSION`, `LAUNCHER_DOWNLOAD_URL` y `LAUNCHER_DOWNLOAD_SHA256` en el
  backend. Si `LAUNCHER_MANDATORY=true`, se fuerza la actualización.

---

## Comprobación rápida

```bash
curl https://tu-api-publico/health
curl https://tu-api-publico/api/v1/launcher/config     # authorizedAddress = s10.mia.us.tarohosting.lat:33538
curl https://tu-api-publico/api/v1/server/status        # online=true
```
