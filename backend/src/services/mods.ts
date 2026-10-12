import { type Readable } from "node:stream";
import {
  canonicalize,
  manifestSchema,
  type Manifest,
  type ModEntry,
  type UnsignedManifest,
} from "@dedsafio/shared";
import { prisma } from "../db.js";
import { ApiError } from "../lib/errors.js";
import { sha256Hex } from "../lib/crypto.js";
import { signJson, verifyJson } from "../lib/signing.js";
import { decryptStream } from "../lib/aes.js";
import { openEncryptedStream } from "../lib/storage.js";
import { buildDownloadTicket, ticketMetadataSignature } from "../lib/download-ticket.js";
import { env } from "../env.js";
import type { DownloadTicket } from "@dedsafio/shared";

/** Mod activo aplicable a un servidor. */
function appliesToServer(
  servers: string[],
  serverId: string,
): boolean {
  return servers.length === 0 || servers.includes(serverId);
}

/**
 * Construye el manifiesto firmado a partir de los mods activos.
 * La versión del manifiesto es un hash determinista del conjunto de mods,
 * de forma que cambia únicamente cuando cambia su contenido.
 */
export async function buildManifest(serverId: string): Promise<Manifest> {
  const records = await prisma.modVersion.findMany({
    where: { active: true },
    orderBy: { modId: "asc" },
  });

  const mods: ModEntry[] = records
    .filter((r) => appliesToServer(r.servers, serverId))
    .map((r) => ({
      id: r.modId,
      version: r.version,
      sha256: r.sha256,
      size: r.size,
      required: r.required,
      fileName: r.fileName,
      ...(r.servers.length > 0 ? { servers: r.servers } : {}),
    }));

  const version =
    "m-" + sha256Hex(canonicalize(mods)).slice(0, 12);

  const unsigned: UnsignedManifest = {
    protocol: "1",
    version,
    minecraft: env.MINECRAFT_VERSION,
    loader: "fabric",
    loaderVersion: env.FABRIC_LOADER_VERSION,
    serverId,
    mods,
    issuedAt: new Date().toISOString(),
  };

  const signature = signJson(unsigned);
  return manifestSchema.parse({ ...unsigned, signature });
}

/** Verifica la firma de un manifiesto (usado en tests y por confianza). */
export function verifyManifest(manifest: Manifest): boolean {
  const { signature, ...unsigned } = manifest;
  return verifyJson(unsigned, signature);
}

/**
 * Emite un ticket de descarga de corta duración para un mod concreto,
 * firmado con Ed25519 (metadatos) y HMAC (URL).
 */
export async function issueDownloadTicket(params: {
  modId: string;
  version: string;
  serverId: string;
  userId: string;
}): Promise<DownloadTicket> {
  const record = await prisma.modVersion.findUnique({
    where: { modId_version: { modId: params.modId, version: params.version } },
  });
  if (!record || !record.active) {
    throw ApiError.notFound("Mod no encontrado");
  }
  if (!appliesToServer(record.servers, params.serverId)) {
    throw ApiError.forbidden("Este mod no está autorizado para tu servidor");
  }

  const artifactSignature = ticketMetadataSignature({
    modId: record.modId,
    version: record.version,
    sha256: record.sha256,
    size: record.size,
  });

  return buildDownloadTicket({
    modId: record.modId,
    version: record.version,
    userId: params.userId,
    sha256: record.sha256,
    size: record.size,
    artifactSignature,
  });
}

/**
 * Descifra el artefacto en streaming (desde S3 o disco) y lo entrega.
 * La autenticidad la garantiza AES-256-GCM (el tag se valida al agotar el
 * stream); la integridad del contenido en claro va firmada en el manifiesto,
 * que valida el cliente con la clave pública.
 */
export async function openDecryptedArtifact(record: {
  storagePath: string;
  sha256: string;
  iv: string;
  authTag: string;
}): Promise<Readable> {
  const encrypted = await openEncryptedStream(record.storagePath);
  return decryptStream(encrypted, record.iv, record.authTag);
}

export async function listModVersions() {
  return prisma.modVersion.findMany({ orderBy: [{ modId: "asc" }, { version: "asc" }] });
}
