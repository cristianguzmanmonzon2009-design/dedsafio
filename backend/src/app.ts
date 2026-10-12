import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  API_PREFIX,
  PROTOCOL_VERSION,
  HEADERS,
} from "@dedsafio/shared";
import { corsOrigins, env, isProduction } from "./env.js";
import { loggerOptions } from "./lib/logger.js";
import { ApiError } from "./lib/errors.js";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { licenseRoutes } from "./routes/license.js";
import { launcherRoutes } from "./routes/launcher.js";
import { modsRoutes } from "./routes/mods.js";
import { serverRoutes } from "./routes/server.js";
import { newsRoutes } from "./routes/news.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import { adminRoutes } from "./routes/admin.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1 MiB
  });

  await app.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : !isProduction,
    credentials: true,
    allowedHeaders: [
      "content-type",
      "authorization",
      HEADERS.protocolVersion,
      HEADERS.hardwareId,
      HEADERS.launcherVersion,
    ],
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: [],
  });

  await app.register(authPlugin);

  // Cabecera de versión de protocolo en todas las respuestas.
  app.addHook("onSend", async (_req, reply) => {
    reply.header(HEADERS.protocolVersion, PROTOCOL_VERSION);
  });

  app.get("/health", async () => ({
    status: "ok",
    protocol: PROTOCOL_VERSION,
    serverId: env.SERVER_ID,
    time: new Date().toISOString(),
  }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(meRoutes);
      await api.register(licenseRoutes);
      await api.register(launcherRoutes);
      await api.register(modsRoutes);
      await api.register(serverRoutes);
      await api.register(newsRoutes);
      await api.register(telemetryRoutes);
      await api.register(adminRoutes);
    },
    { prefix: API_PREFIX },
  );

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({
      error: { code: "not_found", message: "Recurso no encontrado" },
    });
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err: error }, "Error no controlado");
    }
    return reply.code(status).send({
      error: {
        code: status === 429 ? "rate_limited" : "internal_error",
        message:
          status === 429
            ? "Demasiadas solicitudes, inténtalo más tarde"
            : "Error interno del servidor",
      },
    });
  });

  return app;
}
