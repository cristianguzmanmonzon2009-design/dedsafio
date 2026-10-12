import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";

/** Registro de auditoría. No incluye secretos ni tokens. */
export async function audit(params: {
  userId?: string | null;
  action: string;
  detail?: string;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        detail: params.detail?.slice(0, 500) ?? null,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    // La auditoría nunca debe tumbar una operación válida.
    logger.warn({ err, action: params.action }, "No se pudo registrar auditoría");
  }
}
