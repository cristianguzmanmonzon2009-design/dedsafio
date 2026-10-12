import type { FastifyInstance } from "fastify";
import { getServerStatus } from "../services/serverStatus.js";

export async function serverRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/server/status",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async () => {
      const status = await getServerStatus();
      return { status };
    },
  );
}
