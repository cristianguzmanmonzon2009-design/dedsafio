/**
 * Copia el catálogo de datos (ModVersion, Manifest, News) de una base local a
 * otra remota. Sirve para aprovisionar una base nueva (p. ej. en Render) sin
 * volver a cifrar/publicar artefactos (los .enc ya existen con sus IV/tag).
 *
 * Uso:
 *   LOCAL_DATABASE_URL=... REMOTE_DATABASE_URL=... npx tsx tools/copy-data.ts
 */
import { PrismaClient } from "@prisma/client";

const localUrl = process.env.LOCAL_DATABASE_URL;
const remoteUrl = process.env.REMOTE_DATABASE_URL;
if (!localUrl || !remoteUrl) {
  console.error("Define LOCAL_DATABASE_URL y REMOTE_DATABASE_URL");
  process.exit(1);
}

const local = new PrismaClient({ datasources: { db: { url: localUrl } } });
const remote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });

async function main(): Promise<void> {
  const mods = await local.modVersion.findMany();
  const manifests = await local.manifest.findMany();
  const news = await local.news.findMany();

  const r1 = await remote.modVersion.createMany({
    data: mods,
    skipDuplicates: true,
  });
  const r2 = await remote.manifest.createMany({
    data: manifests,
    skipDuplicates: true,
  });
  const r3 = news.length
    ? await remote.news.createMany({ data: news, skipDuplicates: true })
    : { count: 0 };

  console.log(`ModVersion: ${r1.count}/${mods.length}`);
  console.log(`Manifest:   ${r2.count}/${manifests.length}`);
  console.log(`News:       ${r3.count}/${news.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await local.$disconnect();
    await remote.$disconnect();
  });
