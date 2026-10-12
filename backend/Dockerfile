# Imagen del backend Dedsafio (monorepo npm workspaces).
# El contexto de build es la RAÍZ del repositorio (ver docker-compose.yml).
FROM node:20-slim

WORKDIR /app

# Prisma necesita OpenSSL en runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Manifiestos de workspace primero (mejor caché de capas).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN npm ci

# Código fuente.
COPY shared shared
COPY backend backend

# Compila shared + backend y genera el cliente Prisma.
RUN npm run build:shared \
    && npm run -w @dedsafio/backend db:generate \
    && npm run build:backend

ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 8080

# Aplica migraciones pendientes y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
