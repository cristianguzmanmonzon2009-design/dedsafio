import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@dedsafio/shared";
import { verifyAccessToken } from "../lib/jwt.js";
import { ApiError } from "../lib/errors.js";
import { prisma } from "../db.js";

export interface AuthContext {
  userId: string;
  role: Role;
  jti: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorateRequest("auth", undefined);

  app.decorate(
    "authenticate",
    async (req: FastifyRequest, _reply: FastifyReply) => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        throw ApiError.unauthorized("Falta el token de acceso");
      }
      const token = header.slice("Bearer ".length).trim();
      let claims;
      try {
        claims = await verifyAccessToken(token);
      } catch {
        throw ApiError.unauthorized("Token inválido o expirado");
      }

      // Comprobación de revocación por usuario (el backend manda).
      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, role: true, accessRevoked: true },
      });
      if (!user) throw ApiError.unauthorized("Usuario inexistente");
      if (user.accessRevoked) {
        throw ApiError.forbidden("Tu acceso a este launcher ha sido revocado");
      }

      req.auth = { userId: user.id, role: user.role as Role, jti: claims.jti };
    },
  );

  app.decorate(
    "requireAdmin",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(req, reply);
      if (req.auth?.role !== "admin") {
        throw ApiError.forbidden("Se requiere rol de administrador");
      }
    },
  );
});
