import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  licenseValidateSchema,
  manifestSchema,
  canonicalize,
} from "@dedsafio/shared";

describe("esquemas compartidos", () => {
  it("valida un registro correcto", () => {
    const r = registerSchema.safeParse({
      username: "jugador_1",
      email: "JUGADOR@Example.com",
      password: "contraseñaLarga",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("jugador@example.com");
  });

  it("rechaza usuario con caracteres inválidos y contraseña corta", () => {
    const r = registerSchema.safeParse({
      username: "usuario con espacios",
      email: "a@b.com",
      password: "corta",
    });
    expect(r.success).toBe(false);
  });

  it("valida login mínimo", () => {
    expect(loginSchema.safeParse({ username: "abc", password: "12345678" }).success).toBe(
      true,
    );
  });

  it("valida input de licencia", () => {
    expect(
      licenseValidateSchema.safeParse({
        token: "x".repeat(20),
        hardwareId: "hw-123456",
        serverId: "endersafio",
      }).success,
    ).toBe(true);
  });

  it("valida un manifiesto firmado", () => {
    const m = {
      protocol: "1",
      version: "m-1",
      minecraft: "1.21.1",
      loader: "fabric",
      loaderVersion: "0.19.5",
      serverId: "endersafio",
      mods: [],
      issuedAt: new Date().toISOString(),
      signature: "abc",
    };
    expect(manifestSchema.safeParse(m).success).toBe(true);
  });

  it("canonicalize es estable", () => {
    expect(canonicalize({ b: [2, 1], a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":[2,1]}',
    );
  });
});
