import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

/**
 * Smoke test del nivel HTTP. No toca la base de datos: valida que la app
 * compone plugins y sirve las rutas públicas correctamente.
 */
describe("app HTTP", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("responde al healthcheck", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    // Cabecera de protocolo presente.
    expect(res.headers["x-dedsafio-protocol"]).toBe("1");
  });

  it("entrega la config pública del launcher con clave de firma", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/launcher/config" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.config.minecraft).toBe("1.21.1");
    expect(body.config.loader).toBe("fabric");
    expect(body.signingPublicKeyPem).toContain("BEGIN PUBLIC KEY");
  });

  it("entrega la versión del launcher", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/launcher/version" });
    expect(res.statusCode).toBe(200);
    expect(res.json().latest).toBeTruthy();
  });

  it("protege las rutas autenticadas", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me" });
    expect(res.statusCode).toBe(401);
  });

  it("devuelve 404 con formato de error estable", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/inexistente" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});
