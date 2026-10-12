# Arquitectura

## Componentes

| Componente | Tecnología | Rol |
|---|---|---|
| `launcher/` | Rust + Tauri 2 + React/TS | Cliente de escritorio. Instala y lanza Minecraft. Nunca decide seguridad. |
| `backend/` | Node 20 + TypeScript + Fastify + Prisma | **Autoridad final**: auth, licencias, manifiestos, descargas. |
| `mod/` | Fabric 1.21.1 (Gradle/Loom) | Valida sesión/servidor por handshake con el backend. |
| `shared/` | TypeScript + Zod | Contrato de red único (esquemas + tipos + protocolo). |
| `tools/` | Node + tsx | CLI de administración (claves, cifrado, publicación). |

## Flujo de arranque

1. El launcher llama a `GET /launcher/config` (público) y obtiene versión de
   Minecraft/Fabric, servidor autorizado y la **clave pública Ed25519**.
2. `POST /auth/login` → access token (JWT corto) + refresh token rotativo.
3. `GET /mods/manifest` (autenticado) → manifiesto firmado + tickets de descarga.
4. El launcher compara el manifiesto con los archivos locales (hash SHA-256):
   descarga solo lo que falta o está corrupto/desactualizado.
5. `POST /license/session` → token de licencia temporal (usuario + hardware +
   servidor + versión de manifiesto).
6. El launcher instala Minecraft 1.21.1 + Fabric Loader (fuentes oficiales
   públicas: Piston/Fabric Meta) y lanza Java con la instancia aislada.
7. El mod lee el token de licencia y llama a `POST /license/validate` en su
   handshake; si falla, no ejecuta sus funciones privadas.

## Modelo de datos (PostgreSQL)

- `User` — cuenta, rol, `accessRevoked` (revocación global).
- `Session` — refresh tokens rotativos (se guarda solo el hash).
- `PasswordReset` — tokens de recuperación (hash, expiración, uso único).
- `License` — tokens de licencia emitidos por `jti`, revocables.
- `ModVersion` — artefactos: hash, tamaño, IV/tag AES, servidores permitidos.
- `Manifest` — manifiestos publicados (payload + firma).
- `News`, `TelemetryEvent`, `AuditLog`.

## Decisiones de diseño

- **Backend como autoridad**: el cliente puede parchearse; toda decisión de
  acceso (quién entra, qué mods, validez de licencia) ocurre en el servidor.
- **Hash canónico**: firma y verificación usan serialización JSON determinista
  (claves ordenadas) para producir bytes idénticos en TS y Java.
- **Tokens de corta vida + revocación**: access 15 min, licencia 10 min,
  URL de descarga 60 s; todo revocable por `jti`/usuario.
- **Sin secretos en el cliente**: el launcher solo conoce la clave pública.

Ver [SECURITY.md](SECURITY.md) para límites técnicos honestos.
