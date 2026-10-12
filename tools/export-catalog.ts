import "./_env.js";
/**
 * Exporta el catálogo de datos (ModVersion, Manifest, News) de la base local a
 * `backend/prisma/catalog.json`. El contenedor importa ese JSON al arrancar si
 * la base está vacía (ver backend/prisma/seed.ts).
 *
 * Uso:  DATABASE_URL=... npx tsx tools/export-catalog.ts
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mods = await prisma.modVersion.findMany();
  const manifest = await prisma.manifest.findMany();
  const news = await prisma.news.findMany();

  const dest = path.resolve("backend/prisma/catalog.json");
  await fs.writeFile(
    dest,
    JSON.stringify({ mods, manifest, news }, null, 2),
    "utf8",
  );
  console.log(
    `escrito ${dest}: mods=${mods.length} manifest=${manifest.length} news=${news.length}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
