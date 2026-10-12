import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  signLicenseToken,
  verifyLicenseToken,
} from "../src/lib/jwt.js";

describe("JWT de acceso", () => {
  it("firma y verifica un access token", async () => {
    const token = await signAccessToken("user-1", "user");
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.role).toBe("user");
    expect(claims.jti).toBeTruthy();
  });

  it("rechaza un token corrupto", async () => {
    await expect(verifyAccessToken("no.es.jwt")).rejects.toBeTruthy();
  });
});

describe("Token de licencia", () => {
  it("incluye servidor, hardware y manifiesto", async () => {
    const { token, jti } = await signLicenseToken({
      userId: "user-1",
      serverId: "endersafio",
      hardwareId: "hw-abc-123456",
      manifestVersion: "m-deadbeef",
    });
    const claims = await verifyLicenseToken(token);
    expect(claims.jti).toBe(jti);
    expect(claims.serverId).toBe("endersafio");
    expect(claims.hwid).toBe("hw-abc-123456");
    expect(claims.manifestVersion).toBe("m-deadbeef");
  });

  it("un access token no es válido como license token (audiencia distinta)", async () => {
    const access = await signAccessToken("user-1", "user");
    await expect(verifyLicenseToken(access)).rejects.toBeTruthy();
  });
});
