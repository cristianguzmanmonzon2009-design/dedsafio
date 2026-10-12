/**
 * Genera secretos y claves para el backend.
 * Uso:  npm run keys:generate
 * Copia la salida a backend/.env (nunca al repositorio).
 */
import {
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";

function b64urlSecret(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privatePem = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const publicPem = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

const lines = [
  "# ==== Generado por tools/generate-keys.ts ====",
  `ACCESS_TOKEN_SECRET=${b64urlSecret()}`,
  `LICENSE_TOKEN_SECRET=${b64urlSecret()}`,
  `DOWNLOAD_URL_SECRET=${b64urlSecret()}`,
  `SIGNING_PRIVATE_KEY_PEM_B64=${Buffer.from(privatePem).toString("base64")}`,
  `SIGNING_PUBLIC_KEY_PEM_B64=${Buffer.from(publicPem).toString("base64")}`,
  `MOD_MASTER_KEY_B64=${randomBytes(32).toString("base64")}`,
];

console.log(lines.join("\n"));
console.log("\n# Clave pública en PEM (para referencia del launcher/mod):");
console.log(publicPem);
