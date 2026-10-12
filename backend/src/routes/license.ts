import type { FastifyInstance } from "fastify";
import {
  licenseSessionSchema,
  licenseValidateSchema,
  type LicenseSessionResponse,
} from "@dedsafio/shared";
import { parse } from "../lib/validate.js";
import { createLicenseSession, validateLicense } from "../services/licenses.js";

export async function licenseRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Solicita una sesión de licencia temporal. Requiere usuario autenticado.
   * El backend es quien decide si el usuario tiene permiso.
   */
  app.post(
    "/license/session",
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req) => {
      const input = parse(licenseSessionSchema, req.body);
      const { token, expiresIn } = await createLicenseSession({
        userId: req.auth!.userId,
        hardwareId: input.hardwareId,
        serverId: input.serverId,
        manifestVersion: input.manifestVersion,
      });
      const response: LicenseSessionResponse = {
        licenseToken: token,
        expiresIn,
        serverId: input.serverId,
        hwid: input.hardwareId,
        manifestVersion: input.manifestVersion,
      };
      return response;
    },
  );

  /**
   * Validación del handshake usada por el mod. Es pública a propósito
   * (no hay sesión de launcher disponible dentro del juego): la seguridad
   * recae en el token firmado, su revocación y las comprobaciones del backend.
   */
  app.post(
    "/license/validate",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req) => {
      const input = parse(licenseValidateSchema, req.body);
      const result = await validateLicense(input);
      return result;
    },
  );
}
