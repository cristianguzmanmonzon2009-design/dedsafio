import type { FastifyInstance, FastifyRequest } from "fastify";
import { telemetrySchema, HEADERS } from "@dedsafio/shared";
import { parse } from "../lib/validate.js";
import { prisma } from "../db.js";

async function recordEvent(req: FastifyRequest): Promise<{ ok: boolean }> {
  const input = parse(telemetrySchema, req.body);
  const hwid =
    input.hardwareId ??
    (req.headers[HEADERS.hardwareId.toLowerCase()] as string | undefined);
  await prisma.telemetryEvent.create({
    data: {
      userId: req.auth?.userId ?? null,
      event: input.event,
      hardwareId: hwid ?? null,
      metadata: input.metadata ?? undefined,
      ip: req.ip,
    },
  });
  return { ok: true };
}

export async function telemetryRoutes(app: FastifyInstance): Promise<void> {
  app.post("/telemetry/start", { preHandler: app.authenticate }, (req) =>
    recordEvent(req),
  );
  app.post("/telemetry/stop", { preHandler: app.authenticate }, (req) =>
    recordEvent(req),
  );
}
