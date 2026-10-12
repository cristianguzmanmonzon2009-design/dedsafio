import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { TOKEN_TTL, type Role } from "@dedsafio/shared";
import { env } from "../env.js";

const accessKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const licenseKey = new TextEncoder().encode(env.LICENSE_TOKEN_SECRET);

const ISSUER = "dedsafio-backend";
const AUDIENCE_ACCESS = "dedsafio-launcher";
const AUDIENCE_LICENSE = "dedsafio-mod";

export interface AccessClaims extends JWTPayload {
  sub: string;
  role: Role;
  jti: string;
}

export interface LicenseClaims extends JWTPayload {
  sub: string;
  jti: string;
  serverId: string;
  hwid: string;
  manifestVersion: string;
}

export async function signAccessToken(
  userId: string,
  role: Role,
): Promise<string> {
  const jti = randomUUID();
  return new SignJWT({ role, jti })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE_ACCESS)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL.access}s`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessKey, {
    issuer: ISSUER,
    audience: AUDIENCE_ACCESS,
  });
  return payload as AccessClaims;
}

export interface LicenseInput {
  userId: string;
  serverId: string;
  hardwareId: string;
  manifestVersion: string;
}

export async function signLicenseToken(
  input: LicenseInput,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const token = await new SignJWT({
    serverId: input.serverId,
    hwid: input.hardwareId,
    manifestVersion: input.manifestVersion,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE_LICENSE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL.license}s`)
    .sign(licenseKey);
  return { token, jti };
}

export async function verifyLicenseToken(
  token: string,
): Promise<LicenseClaims> {
  const { payload } = await jwtVerify(token, licenseKey, {
    issuer: ISSUER,
    audience: AUDIENCE_LICENSE,
  });
  return payload as LicenseClaims;
}
