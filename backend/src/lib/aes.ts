import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type DecipherGCM,
  type CipherGCM,
} from "node:crypto";
import type { Readable } from "node:stream";
import { env } from "../env.js";

/**
 * Cifrado simétrico AES-256-GCM de los artefactos privados en reposo.
 *
 * La clave maestra vive SOLO en el backend (`MOD_MASTER_KEY_B64`). El cliente
 * nunca la recibe: descarga el contenido ya descifrado por TLS y verifica su
 * integridad con el hash y la firma del manifiesto.
 *
 * Limitación técnica honesta: un mod debe existir en claro en disco/memoria
 * para que Fabric lo cargue. Este esquema protege el almacenamiento y la
 * distribución, no impide la inspección en tiempo de ejecución.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM
const TAG_LENGTH = 16;

let masterKey: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (!masterKey) {
    const key = Buffer.from(env.MOD_MASTER_KEY_B64, "base64");
    if (key.length !== 32) {
      throw new Error(
        "MOD_MASTER_KEY_B64 debe ser una clave AES-256 (32 bytes en base64)",
      );
    }
    masterKey = key;
  }
  return masterKey;
}

export interface EncryptedPayload {
  iv: string; // base64
  authTag: string; // base64
  ciphertext: Buffer;
}

export function encryptBuffer(plaintext: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getMasterKey(), iv) as CipherGCM;
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext,
  };
}

export function decryptBuffer(
  ciphertext: Buffer,
  ivB64: string,
  authTagB64: string,
): Buffer {
  const decipher = createDecipheriv(
    ALGO,
    getMasterKey(),
    Buffer.from(ivB64, "base64"),
  ) as DecipherGCM;
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Descifra un artefacto en streaming (útil para blobs grandes sin cargar todo
 * en memoria). La autenticidad GCM se comprueba al agotar el stream.
 */
export function decryptStream(
  source: Readable,
  ivB64: string,
  authTagB64: string,
): Readable {
  const decipher = createDecipheriv(
    ALGO,
    getMasterKey(),
    Buffer.from(ivB64, "base64"),
  ) as DecipherGCM;
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return source.pipe(decipher);
}

export const AES_CONSTANTS = { ALGO, IV_LENGTH, TAG_LENGTH };
