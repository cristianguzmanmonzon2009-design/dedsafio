import { TOKEN_TTL } from "@dedsafio/shared";
import { prisma } from "../db.js";
import { ApiError } from "../lib/errors.js";
import { signLicenseToken, verifyLicenseToken } from "../lib/jwt.js";
import { env } from "../env.js";
import { audit } from "./audit.js";

/**
 * Emite un token de licencia temporal ligado a usuario + hardware + servidor.
 * El token es de vida corta y se puede revocar por `jti`.
 */
export async function createLicenseSession(params: {
  userId: string;
  hardwareId: string;
  serverId: string;
  manifestVersion: string;
}): Promise<{ token: string; expiresIn: number }> {
  if (params.serverId !== env.SERVER_ID) {
    throw ApiError.forbidden("Este launcher no está autorizado para ese servidor");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { accessRevoked: true },
  });
  if (!user) throw ApiError.unauthorized("Usuario inexistente");
  if (user.accessRevoked) throw ApiError.forbidden("Tu acceso ha sido revocado");

  const { token, jti } = await signLicenseToken({
    userId: params.userId,
    serverId: params.serverId,
    hardwareId: params.hardwareId,
    manifestVersion: params.manifestVersion,
  });

  await prisma.license.create({
    data: {
      id: jti,
      userId: params.userId,
      serverId: params.serverId,
      hardwareId: params.hardwareId,
      manifestVersion: params.manifestVersion,
      expiresAt: new Date(Date.now() + TOKEN_TTL.license * 1000),
    },
  });
  await audit({
    userId: params.userId,
    action: "license.issued",
    detail: `server=${params.serverId} manifest=${params.manifestVersion}`,
  });

  return { token, expiresIn: TOKEN_TTL.license };
}

export interface LicenseValidation {
  valid: boolean;
  reason?: string;
  userId?: string;
}

/**
 * Valida un token de licencia. Usado por el mod en el handshake con el backend.
 * Comprueba firma, expiración, revocación, servidor autorizado y hardware.
 */
export async function validateLicense(params: {
  token: string;
  hardwareId: string;
  serverId: string;
  connectedAddress?: string;
}): Promise<LicenseValidation> {
  let claims;
  try {
    claims = await verifyLicenseToken(params.token);
  } catch {
    return { valid: false, reason: "token_invalid_or_expired" };
  }

  if (claims.serverId !== env.SERVER_ID || params.serverId !== env.SERVER_ID) {
    return { valid: false, reason: "server_not_authorized" };
  }
  if (claims.hwid !== params.hardwareId) {
    return { valid: false, reason: "hardware_mismatch" };
  }

  const record = await prisma.license.findUnique({ where: { id: claims.jti } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    return { valid: false, reason: "revoked_or_expired" };
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, accessRevoked: true },
  });
  if (!user || user.accessRevoked) {
    return { valid: false, reason: "user_revoked" };
  }

  await prisma.telemetryEvent.create({
    data: {
      userId: user.id,
      event: "license.validate_ok",
      hardwareId: params.hardwareId,
      metadata: {
        serverId: params.serverId,
        connectedAddress: params.connectedAddress ?? null,
      },
    },
  });

  return { valid: true, userId: user.id };
}

export async function revokeLicensesForUser(userId: string): Promise<void> {
  await prisma.license.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
