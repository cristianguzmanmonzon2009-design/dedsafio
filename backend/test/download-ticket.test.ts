import { describe, it, expect } from "vitest";
import {
  buildDownloadTicket,
  verifyDownloadTicket,
} from "../src/lib/download-ticket.js";

function parseTicket(url: string) {
  const q = new URL(url, "https://example.com").searchParams;
  return {
    modId: q.get("modId")!,
    version: q.get("version")!,
    exp: q.get("exp")!,
    sig: q.get("sig")!,
    userId: q.get("uid")!,
  };
}

describe("URLs firmadas de descarga", () => {
  it("genera y valida un ticket correcto", () => {
    const ticket = buildDownloadTicket({
      modId: "endersafio-core",
      version: "1.0.0",
      userId: "user-1",
      sha256: "a".repeat(64),
      size: 123,
      artifactSignature: "sig",
    });
    const parsed = parseTicket(ticket.url);
    expect(parsed.userId).toBe("user-1");
    const verified = verifyDownloadTicket(parsed);
    expect(verified?.modId).toBe("endersafio-core");
  });

  it("rechaza un ticket manipulado", () => {
    const ticket = buildDownloadTicket({
      modId: "mod",
      version: "1.0.0",
      userId: "user-1",
      sha256: "a".repeat(64),
      size: 1,
      artifactSignature: "sig",
    });
    const parsed = parseTicket(ticket.url);
    parsed.sig = "AAAA";
    expect(verifyDownloadTicket(parsed)).toBeNull();
  });

  it("rechaza un ticket para otro usuario", () => {
    const ticket = buildDownloadTicket({
      modId: "mod",
      version: "1.0.0",
      userId: "user-1",
      sha256: "a".repeat(64),
      size: 1,
      artifactSignature: "sig",
    });
    const parsed = parseTicket(ticket.url);
    parsed.userId = "user-2";
    expect(verifyDownloadTicket(parsed)).toBeNull();
  });

  it("rechaza un ticket expirado", () => {
    const ticket = buildDownloadTicket({
      modId: "mod",
      version: "1.0.0",
      userId: "user-1",
      sha256: "a".repeat(64),
      size: 1,
      artifactSignature: "sig",
    });
    const parsed = parseTicket(ticket.url);
    parsed.exp = String(Math.floor(Date.now() / 1000) - 5);
    expect(verifyDownloadTicket(parsed)).toBeNull();
  });
});
