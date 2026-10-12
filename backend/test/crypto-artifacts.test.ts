import { describe, it, expect } from "vitest";
import { encryptBuffer, decryptBuffer } from "../src/lib/aes.js";
import {
  signJson,
  verifyJson,
  verifyBytes,
} from "../src/lib/signing.js";
import { canonicalize } from "@dedsafio/shared";

describe("AES-256-GCM", () => {
  it("cifra y descifra un buffer", () => {
    const plain = Buffer.from("mod-secreto-binario-123");
    const enc = encryptBuffer(plain);
    expect(enc.ciphertext.equals(plain)).toBe(false);
    const dec = decryptBuffer(enc.ciphertext, enc.iv, enc.authTag);
    expect(dec.equals(plain)).toBe(true);
  });

  it("falla si el ciphertext fue alterado (GCM autenticado)", () => {
    const enc = encryptBuffer(Buffer.from("dato"));
    enc.ciphertext[0] = enc.ciphertext[0]! ^ 0xff;
    expect(() => decryptBuffer(enc.ciphertext, enc.iv, enc.authTag)).toThrow();
  });

  it("usa IV distinto en cada cifrado", () => {
    const a = encryptBuffer(Buffer.from("x"));
    const b = encryptBuffer(Buffer.from("x"));
    expect(a.iv).not.toBe(b.iv);
  });
});

describe("Firmas Ed25519", () => {
  it("firma y verifica un JSON canónico", () => {
    const payload = { b: 2, a: 1, nested: { z: true, y: "x" } };
    const sig = signJson(payload);
    expect(verifyJson(payload, sig)).toBe(true);
  });

  it("detecta manipulación del contenido", () => {
    const sig = signJson({ precio: 100 });
    expect(verifyJson({ precio: 1 }, sig)).toBe(false);
  });

  it("canonicalize ordena claves de forma determinista", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(verifyBytes(Buffer.from("no"), "AAAA")).toBe(false);
  });
});
