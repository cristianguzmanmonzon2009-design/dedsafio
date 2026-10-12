import { TOKEN_TTL, type AuthTokens, type UserProfile } from "@dedsafio/shared";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword, randomToken, hashToken } from "../lib/crypto.js";
import { signAccessToken } from "../lib/jwt.js";
import { ApiError } from "../lib/errors.js";
import { audit } from "./audit.js";

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  role?: "user" | "admin";
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { username: true, email: true },
  });
  if (existing) {
    const field = existing.username === input.username ? "usuario" : "email";
    throw ApiError.conflict(`Ya existe una cuenta con ese ${field}`);
  }
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.role ?? "user",
    },
  });
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<{ id: string; role: "user" | "admin" }> {
  const user = await prisma.user.findUnique({ where: { username } });
  // Se verifica siempre contra un hash para no filtrar existencia por timing.
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(
        "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        password,
      );
  if (!user || !valid) {
    throw ApiError.unauthorized("Usuario o contraseña incorrectos");
  }
  return { id: user.id, role: user.role as "user" | "admin" };
}

export async function toProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("Usuario no encontrado");
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as "user" | "admin",
    accessRevoked: user.accessRevoked,
    createdAt: user.createdAt.toISOString(),
  };
}

export interface SessionMeta {
  hardwareId?: string;
  userAgent?: string;
  ip?: string;
}

/** Crea una sesión (refresh token rotativo) y emite tokens de acceso. */
export async function issueSession(
  userId: string,
  role: "user" | "admin",
  meta: SessionMeta,
): Promise<AuthTokens> {
  const refreshToken = randomToken(32);
  const accessToken = await signAccessToken(userId, role);
  await prisma.session.create({
    data: {
      userId,
      refreshHash: hashToken(refreshToken),
      hardwareId: meta.hardwareId ?? null,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      expiresAt: new Date(Date.now() + TOKEN_TTL.refresh * 1000),
    },
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: TOKEN_TTL.access,
    tokenType: "Bearer",
  };
}

/** Rota un refresh token: revoca el anterior y emite uno nuevo. */
export async function rotateSession(
  refreshToken: string,
  meta: SessionMeta,
): Promise<AuthTokens> {
  const hash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshHash: hash },
    include: { user: { select: { id: true, role: true, accessRevoked: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized("Sesión inválida o expirada");
  }
  if (session.user.accessRevoked) {
    throw ApiError.forbidden("Tu acceso ha sido revocado");
  }

  const tokens = await issueSession(
    session.userId,
    session.user.role as "user" | "admin",
    meta,
  );
  const rotated = await prisma.session.findUnique({
    where: { refreshHash: hashToken(tokens.refreshToken) },
    select: { id: true },
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), rotatedToId: rotated?.id ?? null },
  });
  return tokens;
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Inicia recuperación de contraseña. Devuelve el token solo en desarrollo. */
export async function createPasswordReset(
  email: string,
): Promise<{ token: string | null; userId: string | null }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { token: null, userId: null };
  const token = randomToken(32);
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  await audit({ userId: user.id, action: "password.reset_requested" });
  return { token, userId: user.id };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const hash = hashToken(token);
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw ApiError.badRequest("Token de recuperación inválido o expirado");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await audit({ userId: reset.userId, action: "password.reset_completed" });
}
