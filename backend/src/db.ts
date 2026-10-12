import { PrismaClient } from "@prisma/client";
import { logger } from "./lib/logger.js";

/**
 * Cliente Prisma singleton. Se evita crear múltiples conexiones durante
 * recargas en caliente de desarrollo.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  logger.info("Base de datos conectada");
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
