import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NEWS_TYPES } from "@dedsafio/shared";
import { parse } from "../lib/validate.js";
import { prisma } from "../db.js";
import { ApiError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import { revokeLicensesForUser } from "../services/licenses.js";
import { revokeAllSessions } from "../services/users.js";
import { listModVersions } from "../services/mods.js";

const revokeSchema = z.object({ revoked: z.boolean() });
const newsSchema = z.object({
  type: z.enum(NEWS_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.requireAdmin);

  /** Revoca o restaura el acceso de un usuario al launcher y sus licencias. */
  app.post("/admin/users/:id/revoke", async (req) => {
    const { id } = req.params as { id: string };
    const { revoked } = parse(revokeSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound("Usuario no encontrado");

    await prisma.user.update({
      where: { id },
      data: { accessRevoked: revoked },
    });
    if (revoked) {
      await revokeLicensesForUser(id);
      await revokeAllSessions(id);
    }
    await audit({
      userId: req.auth!.userId,
      action: revoked ? "admin.user.revoke" : "admin.user.restore",
      detail: `target=${id}`,
      ip: req.ip,
    });
    return { ok: true, accessRevoked: revoked };
  });

  app.get("/admin/users", async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accessRevoked: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { users };
  });

  app.get("/admin/mods", async () => {
    return { mods: await listModVersions() };
  });

  app.get("/admin/audit", async () => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { logs };
  });

  app.post("/admin/news", async (req, reply) => {
    const input = parse(newsSchema, req.body);
    const created = await prisma.news.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.description,
        imageUrl: input.imageUrl ?? null,
        active: input.active ?? true,
      },
    });
    await audit({
      userId: req.auth!.userId,
      action: "admin.news.create",
      detail: created.id,
    });
    reply.code(201);
    return { news: created };
  });
}
