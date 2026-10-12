import { z } from "zod";
import { PROTOCOL_VERSION, ROLES, NEWS_TYPES } from "./protocol.js";

/* ------------------------------------------------------------------ */
/* Primitivas                                                          */
/* ------------------------------------------------------------------ */

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(32, "El usuario no puede superar 32 caracteres")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "El usuario solo puede contener letras, números, '.', '_' y '-'",
  );

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña no puede superar 128 caracteres");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido")
  .max(254);

export const hardwareIdSchema = z
  .string()
  .trim()
  .min(8, "hardwareId inválido")
  .max(256);

/* ------------------------------------------------------------------ */
/* Autenticación                                                       */
/* ------------------------------------------------------------------ */

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  hardwareId: hardwareIdSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
  allDevices: z.boolean().optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ------------------------------------------------------------------ */
/* Licencias / sesión de juego                                         */
/* ------------------------------------------------------------------ */

export const licenseSessionSchema = z.object({
  hardwareId: hardwareIdSchema,
  serverId: z.string().trim().min(1).max(64),
  manifestVersion: z.string().trim().min(1).max(64),
});
export type LicenseSessionInput = z.infer<typeof licenseSessionSchema>;

export const licenseValidateSchema = z.object({
  token: z.string().min(20),
  hardwareId: hardwareIdSchema,
  serverId: z.string().trim().min(1).max(64),
  /** Host:puerto al que el cliente está realmente conectado. */
  connectedAddress: z.string().trim().min(1).max(255).optional(),
});
export type LicenseValidateInput = z.infer<typeof licenseValidateSchema>;

/* ------------------------------------------------------------------ */
/* Manifiestos y mods                                                  */
/* ------------------------------------------------------------------ */

export const modEntrySchema = z.object({
  id: z.string().trim().min(1).max(64),
  version: z.string().trim().min(1).max(64),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "sha256 inválido"),
  size: z.number().int().nonnegative(),
  required: z.boolean(),
  fileName: z.string().trim().min(1).max(255),
  /** Servidores autorizados para este artefacto (vacío = todos los del servidor). */
  servers: z.array(z.string().trim().min(1).max(64)).optional(),
});
export type ModEntry = z.infer<typeof modEntrySchema>;

export const manifestSchema = z.object({
  protocol: z.string().default(PROTOCOL_VERSION),
  version: z.string().trim().min(1).max(64),
  minecraft: z.string().trim().min(1).max(32),
  loader: z.literal("fabric"),
  loaderVersion: z.string().trim().min(1).max(32),
  serverId: z.string().trim().min(1).max(64),
  mods: z.array(modEntrySchema),
  /** ISO-8601 del momento de emisión. */
  issuedAt: z.string().datetime(),
  /** Firma Ed25519 (base64) sobre el manifiesto sin este campo. */
  signature: z.string().min(1),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** Variante sin firma, usada al firmar/verificar. */
export const unsignedManifestSchema = manifestSchema.omit({ signature: true });
export type UnsignedManifest = z.infer<typeof unsignedManifestSchema>;

/* ------------------------------------------------------------------ */
/* Estado del servidor                                                 */
/* ------------------------------------------------------------------ */

export const serverStatusSchema = z.object({
  serverId: z.string(),
  online: z.boolean(),
  players: z.object({
    online: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
  version: z.string(),
  motd: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  checkedAt: z.string().datetime(),
});
export type ServerStatus = z.infer<typeof serverStatusSchema>;

/* ------------------------------------------------------------------ */
/* Noticias                                                            */
/* ------------------------------------------------------------------ */

export const newsItemSchema = z.object({
  id: z.string(),
  type: z.enum(NEWS_TYPES),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().url().optional(),
  publishedAt: z.string().datetime(),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

/* ------------------------------------------------------------------ */
/* Telemetría                                                          */
/* ------------------------------------------------------------------ */

export const telemetrySchema = z.object({
  event: z.string().trim().min(1).max(64),
  hardwareId: hardwareIdSchema.optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type TelemetryInput = z.infer<typeof telemetrySchema>;

/* ------------------------------------------------------------------ */
/* Auxiliares de respuesta                                             */
/* ------------------------------------------------------------------ */

export const roleSchema = z.enum(ROLES);
export const userProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  role: roleSchema,
  accessRevoked: z.boolean(),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authResponseSchema = z.object({
  user: userProfileSchema,
  tokens: authTokensSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const licenseSessionResponseSchema = z.object({
  licenseToken: z.string(),
  expiresIn: z.number().int().positive(),
  serverId: z.string(),
  hwid: z.string(),
  manifestVersion: z.string(),
});
export type LicenseSessionResponse = z.infer<
  typeof licenseSessionResponseSchema
>;

export const launcherVersionResponseSchema = z.object({
  latest: z.string(),
  minimum: z.string(),
  mandatory: z.boolean(),
  url: z.string().url().optional(),
  sha256: z.string().optional(),
  notes: z.string().optional(),
});
export type LauncherVersionResponse = z.infer<
  typeof launcherVersionResponseSchema
>;

export const downloadTicketSchema = z.object({
  modId: z.string(),
  url: z.string(),
  expiresAt: z.string().datetime(),
  sha256: z.string(),
  size: z.number().int().nonnegative(),
  signature: z.string(),
});
export type DownloadTicket = z.infer<typeof downloadTicketSchema>;
