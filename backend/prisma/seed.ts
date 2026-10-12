import { PrismaClient } from "@prisma/client";
import { hash as argonHash } from "@node-rs/argon2";
import { env } from "../src/env.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "SEED_ADMIN_PASSWORD vacío: no se crearán administradores.",
    );
    return;
  }
  const passwordHash = await argonHash(env.SEED_ADMIN_PASSWORD, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { username: env.SEED_ADMIN_USERNAME },
    update: { role: "admin" },
    create: {
      username: env.SEED_ADMIN_USERNAME,
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    },
  });
  console.log(`Administrador listo: ${admin.username} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
