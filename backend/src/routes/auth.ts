import type { FastifyInstance } from "fastify";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type AuthResponse,
} from "@dedsafio/shared";
import { parse } from "../lib/validate.js";
import { ApiError } from "../lib/errors.js";
import { isProduction } from "../env.js";
import {
  createUser,
  authenticateUser,
  toProfile,
  issueSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  createPasswordReset,
  resetPassword,
} from "../services/users.js";
import { audit } from "../services/audit.js";
import { HEADERS } from "@dedsafio/shared";

function sessionMeta(req: {
  headers: Record<string, unknown>;
  ip: string;
  body: unknown;
}) {
  const body = req.body as { hardwareId?: string } | undefined;
  return {
    hardwareId:
      body?.hardwareId ??
      (req.headers[HEADERS.hardwareId.toLowerCase()] as string | undefined),
    userAgent: req.headers["user-agent"] as string | undefined,
    ip: req.ip,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = parse(registerSchema, req.body);
      const user = await createUser(input);
      const tokens = await issueSession(user.id, user.role as "user", sessionMeta(req));
      await audit({ userId: user.id, action: "auth.register", ip: req.ip });
      const response: AuthResponse = {
        user: await toProfile(user.id),
        tokens,
      };
      reply.code(201);
      return response;
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = parse(loginSchema, req.body);
      const { id, role } = await authenticateUser(input.username, input.password);
      const tokens = await issueSession(id, role, sessionMeta(req));
      await audit({ userId: id, action: "auth.login", ip: req.ip });
      reply.code(200);
      const response: AuthResponse = {
        user: await toProfile(id),
        tokens,
      };
      return response;
    },
  );

  app.post(
    "/auth/refresh",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => {
      const input = parse(refreshSchema, req.body);
      const tokens = await rotateSession(input.refreshToken, sessionMeta(req));
      return { tokens };
    },
  );

  app.post("/auth/logout", async (req, reply) => {
    const input = parse(logoutSchema, req.body ?? {});
    if (input.allDevices) {
      // Requiere identidad para cerrar todas las sesiones.
      await app.authenticate(req, reply);
      if (req.auth) await revokeAllSessions(req.auth.userId);
    } else if (input.refreshToken) {
      await revokeSession(input.refreshToken);
    } else {
      throw ApiError.badRequest("Debes indicar refreshToken o allDevices");
    }
    return { ok: true };
  });

  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (req) => {
      const input = parse(forgotPasswordSchema, req.body);
      const { token } = await createPasswordReset(input.email);
      // Respuesta genérica: no revela si el email existe.
      return {
        ok: true,
        message: "Si el email existe, recibirás instrucciones",
        // Solo en desarrollo se expone el token para pruebas locales.
        ...(!isProduction && token ? { devToken: token } : {}),
      };
    },
  );

  app.post(
    "/auth/reset-password",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (req) => {
      const input = parse(resetPasswordSchema, req.body);
      await resetPassword(input.token, input.password);
      return { ok: true };
    },
  );
}
