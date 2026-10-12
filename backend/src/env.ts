import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGINS: z.string().default(""),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),

  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET debe tener al menos 32 caracteres"),
  LICENSE_TOKEN_SECRET: z
    .string()
    .min(32, "LICENSE_TOKEN_SECRET debe tener al menos 32 caracteres"),
  DOWNLOAD_URL_SECRET: z
    .string()
    .min(32, "DOWNLOAD_URL_SECRET debe tener al menos 32 caracteres"),

  SIGNING_PRIVATE_KEY_PEM_B64: z
    .string()
    .min(1, "SIGNING_PRIVATE_KEY_PEM_B64 es obligatoria"),
  SIGNING_PUBLIC_KEY_PEM_B64: z
    .string()
    .min(1, "SIGNING_PUBLIC_KEY_PEM_B64 es obligatoria"),
  MOD_MASTER_KEY_B64: z.string().min(1, "MOD_MASTER_KEY_B64 es obligatoria"),

  SERVER_ID: z.string().min(1).default("endersafio"),
  SERVER_NAME: z.string().min(1).default("EnderSAFIO"),
  SERVER_HOST: z.string().min(1).default("127.0.0.1"),
  SERVER_PORT: z.coerce.number().int().positive().default(25565),
  MINECRAFT_VERSION: z.string().min(1).default("1.21.1"),
  FABRIC_LOADER_VERSION: z.string().min(1).default("0.16.5"),
  REQUIRED_JAVA_MAJOR: z.coerce.number().int().positive().default(21),

  MOD_STORAGE_DIR: z.string().default("./storage"),
  MODS_SOURCE_DIR: z.string().default("../mods-source"),

  // Almacenamiento de artefactos cifrados: "local", "s3" (R2/S3) o "http"
  // (cualquier host estático, p. ej. assets de un GitHub Release).
  STORAGE_DRIVER: z.enum(["local", "s3", "http"]).default("local"),
  // Base URL para el driver "http": se pide a `${MODS_BASE_URL}/<storagePath>`.
  MODS_BASE_URL: z.string().optional().default(""),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("auto"),
  S3_BUCKET: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_PREFIX: z.string().optional().default("mods"),
  S3_FORCE_PATH_STYLE: bool,

  LAUNCHER_LATEST_VERSION: z.string().default("1.0.0"),
  LAUNCHER_MINIMUM_VERSION: z.string().default("1.0.0"),
  LAUNCHER_MANDATORY: bool,
  LAUNCHER_DOWNLOAD_URL: z.string().optional().default(""),
  LAUNCHER_DOWNLOAD_SHA256: z.string().optional().default(""),

  BRANDING_BACKGROUND_URL: z.string().optional().default(""),
  BRANDING_LOGO_URL: z.string().optional().default(""),
  BRANDING_DISCORD_URL: z.string().optional().default(""),

  SEED_ADMIN_USERNAME: z.string().optional().default("admin"),
  SEED_ADMIN_EMAIL: z.string().optional().default("admin@example.com"),
  SEED_ADMIN_PASSWORD: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

function load(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración de entorno inválida:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();

/**
 * Raíz del paquete backend, independiente del directorio de ejecución y de si
 * el código está compilado (dist) o en desarrollo (src). Permite ejecutar CLI
 * (tools/) desde la raíz del monorepo sin romper rutas.
 */
function findBackendRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export const BACKEND_ROOT = findBackendRoot(
  path.dirname(fileURLToPath(import.meta.url)),
);

/** Rutas absolutas de almacenamiento (resueltas contra la raíz del backend). */
export const storageDir = path.resolve(BACKEND_ROOT, env.MOD_STORAGE_DIR);
export const modsSourceDir = path.resolve(BACKEND_ROOT, env.MODS_SOURCE_DIR);

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";
