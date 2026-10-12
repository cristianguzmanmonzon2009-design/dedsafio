# Despliegue

## 0. Despliegue gratis en la nube (Render + Neon + R2)

Objetivo: que los jugadores **no dependan de tu PC**. El backend vive en Internet.

### 0.1 Base de datos (Neon)
1. Crea una cuenta en https://neon.tech (gratis).
2. Crea un proyecto y copia la cadena `postgresql://...` (con `?sslmode=require`).

### 0.2 Almacén de mods cifrados (Cloudflare R2)
1. Crea un bucket (p. ej. `dedsafio-mods`) en Cloudflare R2 (10 GB gratis).
2. Crea un **token de API S3** y apunta: `Access Key ID`, `Secret Access Key`,
   endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, región `auto`.

### 0.3 Desplegar el backend (Render)
1. Sube el repo a GitHub.
2. En https://render.com -> **New -> Blueprint** -> selecciona el repo (usa `render.yaml`).
3. Rellena las variables marcadas como secretas: `DATABASE_URL` (Neon), los
   `*_SECRET`/`*_KEY*` (los mismos de tu `backend/.env`) y las `S3_*` (R2).
4. Al terminar tendrás una URL tipo `https://dedsafio-backend.onrender.com`.

> El plan free de Render duerme el servicio tras 15 min de inactividad y tarda
> ~1 min en despertar; el launcher espera hasta 2 min por petición, así que la
> primera conexión puede tardar. Para evitar el "arranque en frío", usa un plan
> pago o un servicio de ping (UptimeRobot) cada 10 min.

### 0.4 Migrar datos y mods a la nube
Desde tu PC, apuntando al backend de producción (edita `backend/.env`):
1. `DATABASE_URL` = la de Neon.
2. `STORAGE_DRIVER=s3` y las `S3_*` de R2.
3. Ejecuta:
   ```bash
   npm run db:deploy                 # crea las tablas en Neon
   npm run db:seed                   # crea el usuario admin
   npm run storage:sync              # sube los .enc existentes a R2
   npm run mods:manifest             # regenera el manifiesto firmado
   ```
   Si prefieres no reutilizar la base local, repite `npm run mods:publish-all`
   (vuelve a publicar y sube a R2 automáticamente).

### 0.5 Apuntar el launcher a la nube
- Edita `DEFAULT_API_URL` en `launcher/src-tauri/src/lib.rs` con tu URL de Render
  **o** crea un `api-url.txt` junto al `.exe` con esa URL en una sola línea.
- Recompila el instalador: `npm run launcher:build`.

## 1. Backend con Docker

```bash
cd backend
cp .env.example .env
# Genera secretos: en la raíz -> npm run keys:generate  (pega la salida en .env)
export POSTGRES_PASSWORD='una_clave_fuerte'
docker compose up -d --build
docker compose exec api npm run db:seed
```

La imagen aplica `prisma migrate deploy` automáticamente al arrancar.

## 2. HTTPS

El backend habla HTTP; expón HTTPS con un **reverse proxy** (Caddy/Nginx) que
termine TLS. Ejemplo mínimo con Caddy:

```
launcher.tudominio.com {
    reverse_proxy 127.0.0.1:8080
}
```

El launcher y el mod deben apuntar a `https://launcher.tudominio.com`.

## 3. Secrets de producción

Nunca reutilices los valores de desarrollo. Genera nuevos
(`npm run keys:generate`) y guárdalos como secretos del orquestador
(Docker secrets, Kubernetes Secret, etc.). Rota `SIGNING_*` y
`MOD_MASTER_KEY_B64` según `SECURITY.md`.

## 4. Subir mods

```bash
# Copia los .jar a mods-source/ y desde la raíz:
npm run mods:publish -- --file mi-mod.jar --id mi-mod --version 1.0.0
npm run mods:manifest
```

El backend descifra y sirve los artefactos en `GET /mods/download` mediante
URLs firmadas de 60 s emitidas tras `GET /mods/manifest`.

## 5. Crear usuarios

- Registro público: `POST /api/v1/auth/register`.
- Administrador: `npm run -w @dedsafio/backend db:seed` (usa `SEED_ADMIN_*`).
- Revocar/restaurar acceso: `POST /api/v1/admin/users/:id/revoke`.

## 6. Publicar una actualización del launcher

1. Compila el instalador (Etapa 7) y súbelo a tu hosting.
2. Actualiza en `.env`:
   `LAUNCHER_LATEST_VERSION`, `LAUNCHER_MANDATORY`, `LAUNCHER_DOWNLOAD_URL`,
   `LAUNCHER_DOWNLOAD_SHA256`.
3. Reinicia el backend. El launcher lo consulta en `GET /launcher/version`.

## 7. Rollback

- **Mods/manifiesto**: republica el manifiesto anterior (`mods:manifest`
  regenera desde los mods activos; reactiva la versión previa en `ModVersion`).
- **Backend**: `git`/imagen previa. Las migraciones son aditivas por defecto.
- **Launcher**: apunta `LAUNCHER_*` a la versión anterior.
