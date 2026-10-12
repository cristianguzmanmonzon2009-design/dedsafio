import type { FastifyInstance } from "fastify";
import { toProfile } from "../services/users.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", { preHandler: app.authenticate }, async (req) => {
    const profile = await toProfile(req.auth!.userId);
    return { user: profile };
  });
}
