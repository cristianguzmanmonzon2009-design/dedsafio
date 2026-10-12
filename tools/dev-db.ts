/**
 * PostgreSQL embebido para desarrollo (sin Docker ni instalación).
 * Mantiene un clúster persistente en `.pgdata/` y la base `dedsafio`.
 *
 * Uso:  npm run db:embedded
 * Déjalo corriendo en su propia terminal mientras desarrollas.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dataDir = path.join(repoRoot, ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "dedsafio",
  password: "dedsafio",
  port: 5432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8"],
  onLog: () => {},
  onError: (e) => console.error("[pg]", e),
});

async function main(): Promise<void> {
  const alreadyInitialised = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (!alreadyInitialised) {
    console.log("Inicializando clúster de PostgreSQL embebido...");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase("dedsafio");
    console.log("Base de datos 'dedsafio' creada.");
  } catch {
    // Ya existe: es lo normal en arranques posteriores.
  }

  console.log("EMBEDDED_PG_READY en postgresql://dedsafio:dedsafio@localhost:5432/dedsafio");
  console.log("Deja esta terminal abierta. Ctrl+C para detener.");

  const shutdown = async () => {
    console.log("\nDeteniendo PostgreSQL embebido...");
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Mantiene vivo el proceso.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
