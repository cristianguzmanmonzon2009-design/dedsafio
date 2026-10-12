import type { FastifyInstance } from "fastify";
import {
  launcherVersionResponseSchema,
  type LauncherConfig,
  type LauncherVersionResponse,
} from "@dedsafio/shared";
import { env } from "../env.js";
import { publicKeyPem } from "../lib/signing.js";
import { buildManifest } from "../services/mods.js";

export async function launcherRoutes(app: FastifyInstance): Promise<void> {
  /** Información de versión para el auto-actualizador. */
  app.get("/launcher/version", async (): Promise<LauncherVersionResponse> => {
    const data = launcherVersionResponseSchema.parse({
      latest: env.LAUNCHER_LATEST_VERSION,
      minimum: env.LAUNCHER_MINIMUM_VERSION,
      mandatory: env.LAUNCHER_MANDATORY,
      ...(env.LAUNCHER_DOWNLOAD_URL
        ? { url: env.LAUNCHER_DOWNLOAD_URL }
        : {}),
      ...(env.LAUNCHER_DOWNLOAD_SHA256
        ? { sha256: env.LAUNCHER_DOWNLOAD_SHA256 }
        : {}),
    });
    return data;
  });

  /**
   * Configuración pública del launcher. Incluye la clave pública Ed25519 con
   * la que se verifican manifiestos y artefactos. No contiene secretos.
   */
  app.get("/launcher/config", async () => {
    const config: LauncherConfig = {
      serverId: env.SERVER_ID,
      serverName: env.SERVER_NAME,
      minecraft: env.MINECRAFT_VERSION,
      loader: "fabric",
      loaderVersion: env.FABRIC_LOADER_VERSION,
      javaMajor: env.REQUIRED_JAVA_MAJOR,
      authorizedAddress: `${env.SERVER_HOST}:${env.SERVER_PORT}`,
      ...(env.BRANDING_BACKGROUND_URL
        ? { backgroundUrl: env.BRANDING_BACKGROUND_URL }
        : {}),
      ...(env.BRANDING_LOGO_URL ? { logoUrl: env.BRANDING_LOGO_URL } : {}),
      ...(env.BRANDING_DISCORD_URL ? { discordUrl: env.BRANDING_DISCORD_URL } : {}),
    };
    return { config, signingPublicKeyPem: publicKeyPem() };
  });

  /** Manifiesto firmado de mods (requiere autenticación). */
  app.get(
    "/launcher/manifest",
    { preHandler: app.authenticate },
    async (req) => {
      const manifest = await buildManifest(env.SERVER_ID);
      return { manifest };
    },
  );
}
