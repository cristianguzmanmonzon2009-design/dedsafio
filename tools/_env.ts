/**
 * Carga el .env del backend antes de importar cualquier módulo que lo requiera.
 * Debe importarse como PRIMER import en los scripts de tools/.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

dotenv.config({ path: path.join(repoRoot, "backend", ".env") });
