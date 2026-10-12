import "./_env.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env, storageDir } from "../backend/src/env.js";
import { isS3, putEncryptedObject } from "../backend/src/lib/storage.js";

/**
 * Sube los artefactos cifrados ya publicados (backend/storage/*.enc) al
 * almacén S3/R2 configurado. Útil para migrar lo local a la nube sin volver a
 * publicar.
 *
 * Requiere en backend/.env: STORAGE_DRIVER=s3 y las claves S3_*.
 */
async function main(): Promise<void> {
  if (!isS3()) {
    throw new Error(
      "STORAGE_DRIVER no es 's3'. Define STORAGE_DRIVER=s3 y las S3_* en backend/.env",
    );
  }
  const files = (await fs.readdir(storageDir)).filter((f) => f.endsWith(".enc"));
  if (files.length === 0) {
    console.log("No hay artefactos en", storageDir);
    return;
  }
  let total = 0;
  for (const f of files) {
    const buf = await fs.readFile(path.join(storageDir, f));
    await putEncryptedObject(f, buf);
    total += buf.length;
    console.log(`  subido ${f} (${(buf.length / 1048576).toFixed(1)} MB)`);
  }
  console.log(
    `Sincronizados ${files.length} artefactos (${(total / 1048576).toFixed(
      1,
    )} MB) al bucket ${env.S3_BUCKET}.`,
  );
}

main().catch((e: unknown) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
