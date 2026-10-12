import { status as pingStatus } from "minecraft-server-util";
import type { ServerStatus } from "@dedsafio/shared";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";

/**
 * Estado del servidor de Minecraft obtenido vía Server List Ping (SLP).
 * Se cachea brevemente para no golpear el servidor en cada petición.
 */

const CACHE_TTL_MS = 5_000;
let cache: { at: number; value: ServerStatus } | null = null;
let inFlight: Promise<ServerStatus> | null = null;

function offline(): ServerStatus {
  return {
    serverId: env.SERVER_ID,
    online: false,
    players: { online: 0, max: 0 },
    version: env.MINECRAFT_VERSION,
    checkedAt: new Date().toISOString(),
  };
}

async function fetchStatus(): Promise<ServerStatus> {
  const started = Date.now();
  try {
    const result = await pingStatus(env.SERVER_HOST, env.SERVER_PORT, {
      timeout: 3000,
      enableSRV: true,
    });
    const value: ServerStatus = {
      serverId: env.SERVER_ID,
      online: true,
      players: {
        online: result.players.online,
        max: result.players.max,
      },
      version: result.version.name,
      motd: result.motd?.clean ?? undefined,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    };
    return value;
  } catch (err) {
    logger.debug(
      { err: (err as Error).message, host: env.SERVER_HOST, port: env.SERVER_PORT },
      "Server status offline",
    );
    return offline();
  }
}

export async function getServerStatus(): Promise<ServerStatus> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }
  if (inFlight) return inFlight;
  inFlight = fetchStatus()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
