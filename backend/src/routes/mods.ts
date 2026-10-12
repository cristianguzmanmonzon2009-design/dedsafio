import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { parse } from "../lib/validate.js";
import { ApiError } from "../lib/errors.js";
import { verifyDownloadTicket } from "../lib/download-ticket.js";
import { prisma } from "../db.js";
import {
  buildManifest,
  issueDownloadTicket,
  openDecryptedArtifact,
} from "../services/mods.js";

const ticketRequestSchema = z.object({
  modId: z.string().min(1).max(64),
  version: z.string().min(1).max(64),
});

export async function modsRoutes(app: FastifyInstance): Promise<void> {
  /** Manifiesto + tickets de descarga para los mods autorizados. */
  app.get(
    "/mods/manifest",
    { preHandler: app.authenticate },
    async (req) => {
      const manifest = await buildManifest(env.SERVER_ID);
      const userId = req.auth!.userId;
      const tickets = await Promise.all(
        manifest.mods.map((m) =>
          issueDownloadTicket({
            modId: m.id,
            version: m.version,
            serverId: env.SERVER_ID,
            userId,
          }),
        ),
      );
      return { manifest, tickets };
    },
  );

  /** Ticket individual (por si el cliente prefiere pedirlos uno a uno). */
  app.post(
    "/mods/ticket",
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (req) => {
      const input = parse(ticketRequestSchema, req.body);
      const ticket = await issueDownloadTicket({
        modId: input.modId,
        version: input.version,
        serverId: env.SERVER_ID,
        userId: req.auth!.userId,
      });
      return { ticket };
    },
  );

  /**
   * Descarga autorizada. La autorización viaja en la URL firmada (HMAC de
   * corta duración); no hay enlaces públicos permanentes. El artefacto se
   * descifra aquí y se entrega por TLS.
   */
  app.get(
    "/mods/download",
    { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const query = req.query as Record<string, string | undefined>;
      const modId = query.modId;
      const version = query.version;
      const uid = query.uid;
      const exp = query.exp;
      const sig = query.sig;
      if (!modId || !version || !uid || !exp || !sig) {
        throw ApiError.badRequest("Ticket de descarga incompleto");
      }

      const verified = verifyDownloadTicket({ modId, version, exp, sig, userId: uid });
      if (!verified) {
        throw ApiError.forbidden("Ticket de descarga inválido o expirado");
      }

      // El usuario del ticket debe seguir existiendo y estar autorizado.
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { accessRevoked: true },
      });
      if (!user || user.accessRevoked) {
        throw ApiError.forbidden("Usuario revocado");
      }

      const record = await prisma.modVersion.findUnique({
        where: { modId_version: { modId, version } },
      });
      if (!record || !record.active) {
        throw ApiError.notFound("Mod no encontrado");
      }

      const stream = await openDecryptedArtifact(record);
      reply
        .header("content-type", "application/java-archive")
        .header("content-length", String(record.size))
        .header("x-dedsafio-sha256", record.sha256)
        .header("cache-control", "no-store");
      return reply.send(stream);
    },
  );
}
