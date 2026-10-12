import { z } from "zod";
import { TARGET_MINECRAFT, DEFAULT_FABRIC_LOADER } from "./protocol.js";

/**
 * Configuración pública que el backend entrega al launcher para que este
 * sepa qué instalar sin tener nada hardcodeado. No contiene secretos.
 */
export const launcherConfigSchema = z.object({
  serverId: z.string(),
  serverName: z.string(),
  minecraft: z.string(),
  loader: z.literal("fabric"),
  loaderVersion: z.string(),
  javaMajor: z.number().int().positive(),
  /** Dirección que el mod espera para el servidor autorizado (host:puerto). */
  authorizedAddress: z.string(),
  backgroundUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  discordUrl: z.string().optional(),
});
export type LauncherConfig = z.infer<typeof launcherConfigSchema>;

export const DEFAULT_LAUNCHER_CONFIG: Omit<LauncherConfig, "serverId"> = {
  serverName: "Dedsafio",
  minecraft: TARGET_MINECRAFT,
  loader: "fabric",
  loaderVersion: DEFAULT_FABRIC_LOADER,
  javaMajor: 21,
  authorizedAddress: "play.example.com:25565",
};
