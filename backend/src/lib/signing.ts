import {
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";
import { canonicalize } from "@dedsafio/shared";
import { env } from "../env.js";

/**
 * Firma digital Ed25519 para manifiestos y artefactos.
 * El backend custodia la clave privada (en `SIGNING_PRIVATE_KEY_PEM_B64`).
 * El launcher y el mod solo conocen la clave pública, que no es secreta.
 */

function decodePem(b64: string, label: string): string {
  const pem = Buffer.from(b64, "base64").toString("utf8");
  if (!pem.includes("-----BEGIN")) {
    throw new Error(`${label} no parece un PEM válido`);
  }
  return pem;
}

let privateKey: KeyObject | null = null;
let publicKey: KeyObject | null = null;

function getPrivateKey(): KeyObject {
  if (!privateKey) {
    privateKey = createPrivateKey(
      decodePem(env.SIGNING_PRIVATE_KEY_PEM_B64, "SIGNING_PRIVATE_KEY"),
    );
  }
  return privateKey;
}

function getPublicKey(): KeyObject {
  if (!publicKey) {
    publicKey = createPublicKey(
      decodePem(env.SIGNING_PUBLIC_KEY_PEM_B64, "SIGNING_PUBLIC_KEY"),
    );
  }
  return publicKey;
}

/** Firma bytes y devuelve la firma en base64. */
export function signBytes(data: Buffer): string {
  return nodeSign(null, data, getPrivateKey()).toString("base64");
}

export function verifyBytes(data: Buffer, signatureB64: string): boolean {
  try {
    return nodeVerify(
      null,
      data,
      getPublicKey(),
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}

/** Firma un objeto JSON de forma canónica (claves ordenadas). */
export function signJson(value: unknown): string {
  return signBytes(Buffer.from(canonicalize(value), "utf8"));
}

export function verifyJson(value: unknown, signatureB64: string): boolean {
  return verifyBytes(Buffer.from(canonicalize(value), "utf8"), signatureB64);
}

/** Clave pública en PEM (para servir al launcher). Es información pública. */
export function publicKeyPem(): string {
  return getPublicKey()
    .export({ type: "spki", format: "pem" })
    .toString();
}
