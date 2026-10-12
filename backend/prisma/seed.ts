import { PrismaClient } from "@prisma/client";
import { hash as argonHash } from "@node-rs/argon2";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../src/env.js";

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));

/** Sincroniza el catálogo (mods/manifiestos) desde catalog.json en cada arranque. */
async function importCatalog(): Promise<void> {
  const file = path.join(here, "catalog.json");
  try {
    await fs.access(file);
  } catch {
    console.warn("catalog.json no encontrado: se omite la importación.");
    return;
  }
  const data = JSON.parse(await fs.readFile(file, "utf8")) as {
    mods?: Array<Record<string, unknown> & { modId: string; version: string }>;
    manifest?: unknown[];
    news?: unknown[];
  };

  let synced = 0;
  for (const mod of data.mods ?? []) {
    const { id: _id, createdAt: _createdAt, ...rest } = mod;
    await prisma.modVersion.upsert({
      where: { modId_version: { modId: mod.modId, version: mod.version } },
      create: mod as never,
      update: rest as never,
    });
    synced++;
  }

  if (data.manifest?.length) {
    await prisma.manifest.createMany({
      data: data.manifest as never,
      skipDuplicates: true,
    });
  }
  if (data.news?.length) {
    await prisma.news.createMany({
      data: data.news as never,
      skipDuplicates: true,
    });
  }
  console.log(
    `Catálogo sincronizado: mods=${synced} manifest=${data.manifest?.length ?? 0}`,
  );
}

async function ensureAdmin(): Promise<void> {
  if (!env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "SEED_ADMIN_PASSWORD vacío: no se crearán administradores.",
    );
    return;
  }
  const passwordHash = await argonHash(env.SEED_ADMIN_PASSWORD, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { username: env.SEED_ADMIN_USERNAME },
    update: { role: "admin" },
    create: {
      username: env.SEED_ADMIN_USERNAME,
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    },
  });
  console.log(`Administrador listo: ${admin.username} (${admin.id})`);
}

async function main(): Promise<void> {
  await importCatalog();
  await ensureAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
