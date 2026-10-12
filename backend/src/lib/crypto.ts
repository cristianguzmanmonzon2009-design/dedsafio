import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

/**
 * Parámetros argon2id alineados con recomendaciones OWASP (2024).
 */
const ARGON_OPTIONS = {
  algorithm: 2 as const, // Argon2id
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

/** Token opaco aleatorio (URL-safe). Se usa para refresh tokens y resets. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function sha256Base64(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("base64");
}

/** Hash determinista para almacenar tokens de sesión (no reversible). */
export function hashToken(token: string): string {
  return sha256Hex(token);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
