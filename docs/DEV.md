# Desarrollo

## Instalación

```bash
npm install
npm run db:generate
```

## Variables de entorno

Copia `backend/.env.example` a `backend/.env` y rellena los secretos
(`npm run keys:generate` genera los valores listos para pegar).

## Base de datos

Con Docker (recomendado):

```bash
cd backend
docker compose up -d db
cd ..
npm run db:migrate
npm run -w @dedsafio/backend db:seed
```

Con PostgreSQL local: ajusta `DATABASE_URL` y repite `db:migrate`/`db:seed`.

## Ejecutar el backend

```bash
npm run dev:backend       # tsx watch, hot reload
# o
npm run build && npm run start:backend
```

Endpoints útiles:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/launcher/config
curl http://localhost:8080/api/v1/server/status
```

## Pruebas

```bash
npm test
```

Los tests unitarios no requieren base de datos. El smoke test HTTP usa
`app.inject()` y tampoco toca la BD.

## Añadir un endpoint

1. Define el esquema Zod y los tipos en `shared/src/`.
2. Implementa el servicio en `backend/src/services/`.
3. Añade la ruta en `backend/src/routes/` y regístrala en `app.ts`.
4. Añade un test.

## PostgreSQL embebido (sin Docker)

Si no tienes Docker ni PostgreSQL, `embedded-postgres` levanta un servidor local
en `.pgdata/` (ignorado por git):

```bash
npm run db:embedded        # deja el proceso en segundo plano (localhost:5432)
npm run db:deploy          # aplica las migraciones
npm run seed               # crea el admin (SEED_* en backend/.env)
npm run mods:publish-all   # publica los .jar de mods-source/
npm run mods:manifest      # firma y publica el manifiesto
```

## Launcher

Requiere **Node 20+** y **Rust** (rustup + MSVC Build Tools de Visual Studio).
En Windows:

```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools
rustup default stable
```

Luego, genera los iconos y compila:

```bash
npm run launcher:install
npm --prefix launcher run tauri icon ruta/a/logo.png   # genera los iconos
npm run launcher:typecheck        # solo la UI (no necesita Rust)
npm run launcher:dev              # app completa en desarrollo
npm run launcher:build            # instalador NSIS en launcher/src-tauri/target/release/bundle
```

El backend se localiza con `DEDSAFIO_API_URL` (por defecto `http://localhost:8080`).

## Mod Fabric

Requiere **JDK 21** (ya presente aquí) y **Gradle**:

```powershell
winget install Gradle.Gradle
```

```bash
# En la carpeta mod/
gradle build                       # -> build/libs/dedsafio-guard-1.0.0.jar
```

Sube el jar al backend (cifrado en reposo + entrega autenticada):

```bash
npx tsx tools/publish-mod.ts --file mod/build/libs/dedsafio-guard-1.0.0.jar --id dedsafio --version 1.0.0
npm run mods:manifest
```

Variables del servidor al arrancar el servidor de Minecraft:
`DEDSAFIO_SERVER_ID`, `DEDSAFIO_MANIFEST_VERSION`, `DEDSAFIO_EXPECTED_MODS`
(ids separados por comas) y `DEDSAFIO_API_URL`. Detalles en `docs/MOD.md`.

