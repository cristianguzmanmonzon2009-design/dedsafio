import { buildApp } from "./app.js";
import { connectDb, disconnectDb } from "./db.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  await connectDb();
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Cerrando backend...");
    try {
      await app.close();
      await disconnectDb();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info(
    { host: env.HOST, port: env.PORT, env: env.NODE_ENV },
    "Backend Dedsafio escuchando",
  );
}

main().catch((err) => {
  logger.error({ err }, "Fallo al iniciar el backend");
  process.exit(1);
});
