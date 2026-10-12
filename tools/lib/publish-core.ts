import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { modsSourceDir, storageDir } from "../../backend/src/env.js";
import { encryptBuffer } from "../../backend/src/lib/aes.js";
import { isS3, putEncryptedObject } from "../../backend/src/lib/storage.js";
import { prisma } from "../../backend/src/db.js";

/**
 * Núcleo de publicación: cifra un .jar con AES-256-GCM y registra/actualiza
 * su entrada en la base de datos. Guarda el artefacto cifrado en disco
 * (driver "local") o en S3/R2 (driver "s3").
 */

export interface PublishOptions {
  file: string;
  id: string;
  version: string;
  required: boolean;
  servers: string[];
}

export interface PublishResult {
  modId: string;
  version: string;
  sha256: string;
  size: number;
  required: boolean;
  servers: string[];
  storedAs: string;
}

async function resolveJar(file: string): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), file),
    path.resolve(modsSourceDir, file),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* siguiente */
    }
  }
  throw new Error(`No se encontró el archivo: ${file}`);
}

/** Guarda el artefacto CIFRADO en el almacén configurado. */
async function storeEncrypted(storedAs: string, ciphertext: Buffer): Promise<void> {
  if (isS3()) {
    await putEncryptedObject(storedAs, ciphertext);
    return;
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(path.join(storageDir, storedAs), ciphertext);
}

export async function publishMod(opts: PublishOptions): Promise<PublishResult> {
  const jarPath = await resolveJar(opts.file);
  const plaintext = await fs.readFile(jarPath);
  const sha256 = createHash("sha256").update(plaintext).digest("hex");
  const size = plaintext.byteLength;

  const encrypted = encryptBuffer(plaintext);
  const storedAs = `${opts.id}-${opts.version}.enc`;
  const fileName = path.basename(jarPath);
  await storeEncrypted(storedAs, encrypted.ciphertext);

  await prisma.modVersion.upsert({
    where: { modId_version: { modId: opts.id, version: opts.version } },
    create: {
      modId: opts.id,
      version: opts.version,
      sha256,
      size,
      required: opts.required,
      fileName,
      servers: opts.servers,
      storagePath: storedAs,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    },
    update: {
      sha256,
      size,
      required: opts.required,
      fileName,
      servers: opts.servers,
      storagePath: storedAs,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      active: true,
    },
  });

  return {
    modId: opts.id,
    version: opts.version,
    sha256,
    size,
    required: opts.required,
    servers: opts.servers,
    storedAs,
  };
}

/** Deriva un id estable a partir del nombre de archivo. */
export function slugifyId(fileName: string): string {
  return path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
