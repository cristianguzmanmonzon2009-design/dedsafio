import { createHmac } from "node:crypto";
import { TOKEN_TTL, type DownloadTicket } from "@dedsafio/shared";
import { env } from "../env.js";
import { signJson } from "./signing.js";

/**
 * URLs firmadas de corta duración.
 * Un enlace de descarga solo es válido mientras su firma HMAC no expire,
 * por lo que una URL filtrada deja de servir en segundos.
 */

const key = Buffer.from(env.DOWNLOAD_URL_SECRET, "utf8");

function hmac(payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

interface TicketParams {
  modId: string;
  version: string;
  userId: string;
  sha256: string;
  size: number;
  /** Firma Ed25519 del artefacto (opaca para el cliente, solo reenviada). */
  artifactSignature: string;
}

export function buildDownloadTicket(params: TicketParams): DownloadTicket {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL.downloadUrl;
  const payload = `${params.modId}.${params.version}.${params.userId}.${exp}`;
  const sig = hmac(payload);
  const query = new URLSearchParams({
    modId: params.modId,
    version: params.version,
    uid: params.userId,
    exp: String(exp),
    sig,
  });
  const ticket: DownloadTicket = {
    modId: params.modId,
    url: `/api/v1/mods/download?${query.toString()}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    sha256: params.sha256,
    size: params.size,
    signature: params.artifactSignature,
  };
  return ticket;
}

export interface VerifiedTicket {
  modId: string;
  version: string;
  exp: number;
}

export function verifyDownloadTicket(input: {
  modId: string;
  version: string;
  exp: string;
  sig: string;
  userId: string;
}): VerifiedTicket | null {
  const exp = Number.parseInt(input.exp, 10);
  if (!Number.isFinite(exp)) return null;
  if (exp * 1000 < Date.now()) return null;
  const expected = hmac(
    `${input.modId}.${input.version}.${input.userId}.${exp}`,
  );
  // Comparación en tiempo constante.
  const a = Buffer.from(expected);
  const b = Buffer.from(input.sig);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i]! ^ b[i]!);
  if (diff !== 0) return null;
  return { modId: input.modId, version: input.version, exp };
}

/** Firma (Ed25519) de los metadatos del artefacto publicados en el ticket. */
export function ticketMetadataSignature(meta: {
  modId: string;
  version: string;
  sha256: string;
  size: number;
}): string {
  return signJson(meta);
}
