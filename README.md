# Dedsafio — Launcher privado + backend + mods (Minecraft 1.21.1 / Fabric)

Plataforma privada para distribuir un servidor de Minecraft 1.21.1 con Fabric:
el usuario solo abre el launcher, inicia sesión y pulsa **JUGAR**; el launcher
se encarga de Java, Minecraft, Fabric, mods, dependencias, verificaciones y
actualizaciones.

> Estado: **Etapas 0–2 implementadas y verificadas** (contrato compartido +
> backend funcional). El launcher (Tauri) y el mod Fabric se implementan en las
> etapas siguientes.

## Estructura

```
dedsafio/
  shared/     Contrato de red (tipos + esquemas Zod + protocolo)
  backend/    API Fastify + Prisma + PostgreSQL (autoridad de seguridad)
  launcher/   App de escritorio (Rust + Tauri 2 + React)  [Etapa 4-5]
  mod/        Mod Fabric 1.21.1 de protección               [Etapa 6]
  tools/      CLI de administración (claves, cifrado y publicación de mods)
  mods-source/ Carpeta donde colocas los .jar que quieres distribuir
  docs/       Arquitectura, seguridad, desarrollo y despliegue
```

## Requisitos

- Node.js ≥ 20
- Docker (para PostgreSQL) — o un PostgreSQL local
- Java 21 (solo para ejecutar Minecraft; el launcher lo gestiona)

## Puesta en marcha rápida (backend)

```bash
npm install
npm run db:generate          # genera el cliente Prisma
cp backend/.env.example backend/.env   # si no existe (ya hay uno de dev)

# Levantar PostgreSQL + API con Docker:
cd backend && docker compose up -d --build && cd ..

# O con PostgreSQL local:
npm run db:migrate
npm run dev:backend

# Crear el administrador inicial:
npm run -w @dedsafio/backend db:seed
```

Comprueba: `curl http://localhost:8080/health`

## Publicar mods privados

```bash
# 1) Coloca tus .jar en mods-source/
# 2) Cifra e ingesta (usa la clave maestra del backend):
npm run mods:publish -- --file mi-mod.jar --id mi-mod --version 1.0.0
# 3) Firma y publica el manifiesto:
npm run mods:manifest
```

## Generar claves y secretos

```bash
npm run keys:generate   # salida lista para pegar en backend/.env
```

## Pruebas

```bash
npm test         # 30 tests: crypto, AES, firmas, JWT, tickets, esquemas, HTTP
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Seguridad y límites técnicos](docs/SECURITY.md)
- [Desarrollo](docs/DEV.md)
- [Despliegue y HTTPS](docs/DEPLOY.md)
