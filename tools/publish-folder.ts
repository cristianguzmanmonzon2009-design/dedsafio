import "./_env.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { publishMod, slugifyId } from "./lib/publish-core.js";

/**
 * Publica TODOS los .jar de mods-source/ de una vez.
 *
 * Uso:
 *   npx tsx tools/publish-folder.ts [--version 1.0.0] [--optional] [--servers a,b]
 *                                  [--dir mods-source]
 *
 * El id se deriva del nombre de archivo (slug). La versión por defecto es
 * 1.0.0 y puede sobreescribirse con --version.
 */

interface Args {
  dir: string;
  version: string;
  required: boolean;
  servers: string[];
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dir: "mods-source",
    version: "1.0.0",
    required: true,
    servers: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dir":
        out.dir = argv[++i] ?? out.dir;
        break;
      case "--version":
        out.version = argv[++i] ?? out.version;
        break;
      case "--optional":
        out.required = false;
        break;
      case "--servers":
        out.servers = (argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      default:
        if (a?.startsWith("--")) throw new Error(`Argumento desconocido: ${a}`);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const { modsSourceDir } = await import("../backend/src/env.js");
  const dir = path.isAbsolute(args.dir)
    ? args.dir
    : path.resolve(process.cwd(), args.dir);

  const entries = await fs.readdir(dir).catch(() => {
    throw new Error(`No existe el directorio: ${dir}`);
  });
  const jars = entries.filter((f) => f.toLowerCase().endsWith(".jar"));
  if (jars.length === 0) {
    throw new Error(`No hay archivos .jar en ${dir}`);
  }

  console.log(`Publicando ${jars.length} mods desde ${dir}...\n`);
  const seen = new Set<string>();
  let ok = 0;
  for (const jar of jars) {
    const id = slugifyId(jar);
    if (seen.has(id)) {
      console.warn(`  ! id duplicado '${id}' para ${jar}, se omite`);
      continue;
    }
    seen.add(id);
    try {
      const r = await publishMod({
        file: path.join(dir, jar),
        id,
        version: args.version,
        required: args.required,
        servers: args.servers,
      });
      ok++;
      const mb = (r.size / (1024 * 1024)).toFixed(2);
      console.log(
        `  ✓ ${r.modId}@${r.version}  ${mb} MB  ${r.sha256.slice(0, 12)}…`,
      );
    } catch (err) {
      console.error(`  ✗ ${jar}: ${(err as Error).message}`);
    }
  }
  console.log(`\nListo: ${ok}/${jars.length} publicados.`);
  void modsSourceDir;

  const { prisma } = await import("../backend/src/db.js");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
