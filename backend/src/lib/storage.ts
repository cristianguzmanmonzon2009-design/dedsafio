import { createReadStream } from "node:fs";
import path from "node:path";
import { type Readable } from "node:stream";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env, storageDir } from "../env.js";
import { ApiError } from "./errors.js";

/**
 * Almacén de artefactos cifrados. Soporta disco local ("local") o cualquier
 * servicio compatible con S3 ("s3"): Cloudflare R2, Backblaze B2, MinIO, AWS.
 * Los objetos se guardan ya cifrados; el descifrado ocurre siempre en el
 * backend, nunca en el cliente.
 */

export function isS3(): boolean {
  return env.STORAGE_DRIVER === "s3";
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error(
        "Almacenamiento S3 incompleto: define S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY",
      );
    }
    client = new S3Client({
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function objectKey(storagePath: string): string {
  const prefix = env.S3_PREFIX.replace(/\/+$/, "");
  return prefix ? `${prefix}/${storagePath}` : storagePath;
}

/** Ruta absoluta local del artefacto (solo para el driver "local"). */
export function resolveLocalPath(storagePath: string): string {
  const resolved = path.resolve(storageDir, storagePath);
  if (resolved !== storageDir && !resolved.startsWith(storageDir + path.sep)) {
    throw ApiError.badRequest("Ruta de artefacto inválida");
  }
  return resolved;
}

/** Devuelve un stream del artefacto CIFRADO desde S3 o desde disco. */
export async function openEncryptedStream(
  storagePath: string,
): Promise<Readable> {
  if (isS3()) {
    const res = await s3().send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey(storagePath),
      }),
    );
    if (!res.Body) {
      throw ApiError.internal("Artefacto no encontrado en el almacén");
    }
    return res.Body as Readable;
  }
  return createReadStream(resolveLocalPath(storagePath));
}

/** Sube un artefacto CIFRADO a S3 (no-op en driver local). */
export async function putEncryptedObject(
  storagePath: string,
  body: Buffer,
): Promise<void> {
  if (!isS3()) return;
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey(storagePath),
      Body: body,
      ContentType: "application/octet-stream",
    }),
  );
}
