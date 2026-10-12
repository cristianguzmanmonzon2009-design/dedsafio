import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256Hex,
  constantTimeEqual,
} from "../src/lib/crypto.js";

describe("crypto", () => {
  it("hashea y verifica contraseñas con argon2id", async () => {
    const hash = await hashPassword("SuperSegura123");
    expect(hash).toContain("$argon2id$");
    expect(await verifyPassword(hash, "SuperSegura123")).toBe(true);
    expect(await verifyPassword(hash, "incorrecta")).toBe(false);
  });

  it("nunca almacena la contraseña en claro en el hash", async () => {
    const hash = await hashPassword("NoDebeAparecer");
    expect(hash).not.toContain("NoDebeAparecer");
  });

  it("genera tokens aleatorios únicos", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("calcula sha256 estable", () => {
    expect(sha256Hex("hola")).toBe(sha256Hex(Buffer.from("hola")));
  });

  it("constantTimeEqual compara correctamente", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
