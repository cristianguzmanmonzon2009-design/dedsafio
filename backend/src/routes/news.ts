import type { FastifyInstance } from "fastify";
import type { NewsType } from "@dedsafio/shared";
import { prisma } from "../db.js";

export async function newsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/news", async () => {
    const items = await prisma.news.findMany({
      where: { active: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });
    return {
      news: items.map((n) => ({
        id: n.id,
        type: n.type as NewsType,
        title: n.title,
        description: n.description,
        ...(n.imageUrl ? { imageUrl: n.imageUrl } : {}),
        publishedAt: n.publishedAt.toISOString(),
      })),
    };
  });
}
