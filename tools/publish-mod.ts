import "./_env.js";
import { publishMod } from "./lib/publish-core.js";

/**
 * Publica (cifra e ingesta) UN mod privado en el almacén del backend.
 *
 * Uso:
 *   npx tsx tools/publish-mod.ts --file mods-source/mi-mod.jar \
 *       --id mi-mod --version 1.0.0 [--optional] [--servers endersafio,otro]
 */

interface Args {
  file?: string;
  id?: string;
  version?: string;
  required: boolean;
  servers: string[];
}

function parseArgs(argv: string[]): Args {
  const out: Args = { required: true, servers: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--file":
        out.file = argv[++i];
        break;
      case "--id":
        out.id = argv[++i];
        break;
      case "--version":
        out.version = argv[++i];
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
  if (!args.file || !args.id || !args.version) {
    throw new Error(
      "Uso: publish-mod.ts --file <jar> --id <modId> --version <version> [--optional] [--servers a,b]",
    );
  }

  const r = await publishMod({
    file: args.file,
    id: args.id,
    version: args.version,
    required: args.required,
    servers: args.servers,
  });

  console.log("Mod publicado y cifrado:");
  console.log(`  id        : ${r.modId}`);
  console.log(`  version   : ${r.version}`);
  console.log(`  sha256    : ${r.sha256}`);
  console.log(`  size      : ${r.size} bytes`);
  console.log(`  required  : ${r.required}`);
  console.log(
    `  servidores: ${r.servers.length ? r.servers.join(", ") : "(todos)"}`,
  );
  console.log(`  almacén   : ${r.storedAs}`);

  const { prisma } = await import("../backend/src/db.js");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
