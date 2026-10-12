# Seguridad

## Controles implementados

| Control | Dónde | Detalle |
|---|---|---|
| Contraseñas | `backend/lib/crypto.ts` | argon2id (19 MiB, t=2). Nunca en claro. |
| Sesiones | `services/users.ts` | Refresh tokens opacos, rotativos; se guarda el hash. |
| Access token | `lib/jwt.ts` | JWT HS256, 15 min, con `jti`. |
| Token de licencia | `lib/jwt.ts` | JWT HS256, 10 min, ligado a usuario+hardware+servidor+manifiesto. |
| Revocación | `routes/admin.ts` | `accessRevoked` + revocación de licencias y sesiones. |
| Firma de artefactos | `lib/signing.ts` | Ed25519. La clave privada vive solo en el backend. |
| Cifrado en reposo | `lib/aes.ts` | AES-256-GCM con clave maestra del backend. |
| Descarga autenticada | `lib/download-ticket.ts` | URL firmada HMAC, TTL 60 s, atada a `userId`. |
| Integridad | `services/mods.ts` | SHA-256 verificado antes y después de descifrar. |
| Anti-abuso | `app.ts` | Rate limiting global y por ruta. |
| Validación | `lib/validate.ts` | Zod en todos los cuerpos. |
| CORS | `app.ts` | Lista blanca por entorno. |
| Logs | `lib/logger.ts` | Redacción de tokens/contraseñas/firmas. |
| Secretos | `env.ts` | Solo variables de entorno. Nada hardcodeado. |

## Límites técnicos reales (no se simulan)

1. **Un mod debe existir en claro para ejecutarse.** Fabric necesita leer el
   `.jar`. Cifrar en reposo y descifrar a un directorio temporal del SO es el
   máximo práctico; durante la ejecución el jar es inspeccionable.
2. **La ofuscación no es irrompible.** Ralentiza ingeniería inversa, no la evita.
   Nunca sustituye la autorización del backend.
3. **El cliente es hostil por definición.** Por eso la seguridad recae en
   backend + tokens + firmas, no en ocultar cosas en el launcher.

## Lo que NO se hace (seguridad falsa)

- No hay contraseñas ni claves maestras en el código.
- No se "protege" renombrando `.jar` ni ocultando carpetas.
- No se autoriza por IP (puede cambiar) ni por el nombre del servidor.
- No se confía en el cliente para decisiones críticas.

## Rotación de secretos

- `npm run keys:generate` regenera secretos.
- Cambiar `SIGNING_PRIVATE_KEY_PEM_B64` invalida manifiestos previos: hay que
  volver a publicar (`npm run mods:manifest`) y actualizar la clave pública
  embebida en el launcher/mod.
- Cambiar `MOD_MASTER_KEY_B64` requiere **re-cifrar** todos los artefactos
  (volver a ejecutar `mods:publish` para cada mod).
