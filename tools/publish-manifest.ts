import "./_env.js";

/**
 * Construye y publica un manifiesto firmado (Ed25519) a partir de los mods
 * activos en la base de datos, dejándolo como manifiesto vigente.
 *
 * Uso:
 *   npx tsx tools/publish-manifest.ts
 */

async function main(): Promise<void> {
  const { env } = await import("../backend/src/env.js");
  const { prisma } = await import("../backend/src/db.js");
  const { buildManifest } = await import("../backend/src/services/mods.js");

  const manifest = await buildManifest(env.SERVER_ID);
  const { signature, ...payload } = manifest;

  await prisma.$transaction([
    prisma.manifest.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.manifest.upsert({
      where: { version: manifest.version },
      update: { payload, signature, active: true },
      create: {
        version: manifest.version,
        minecraft: manifest.minecraft,
        loader: manifest.loader,
        loaderVersion: manifest.loaderVersion,
        serverId: manifest.serverId,
        payload,
        signature,
        active: true,
      },
    }),
  ]);

  console.log("Manifiesto publicado:");
  console.log(`  version   : ${manifest.version}`);
  console.log(`  minecraft : ${manifest.minecraft} (${manifest.loader} ${manifest.loaderVersion})`);
  console.log(`  mods      : ${manifest.mods.length}`);
  for (const m of manifest.mods) {
    console.log(`    - ${m.id}@${m.version} (${m.required ? "requerido" : "opcional"})`);
  }
  console.log(`  firma     : ${signature.slice(0, 24)}...`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
