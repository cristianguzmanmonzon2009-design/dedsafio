import { pino, type LoggerOptions } from "pino";

/**
 * Opciones de logger con redacción de campos sensibles.
 * Nunca deben aparecer tokens, contraseñas ni firmas en los logs.
 */
function buildOptions(): LoggerOptions {
  const redact = {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-dedsafio-signature"]',
      "body.password",
      "body.refreshToken",
      "body.token",
      "body.accessToken",
      "*.password",
      "*.refreshToken",
      "*.accessToken",
      "*.licenseToken",
    ],
    censor: "[REDACTED]",
  };

  if (process.env.NODE_ENV === "development") {
    return {
      level: "debug",
      redact,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    };
  }
  return { level: "info", redact };
}

export const loggerOptions = buildOptions();

/** Logger independiente para uso fuera de Fastify (scripts, servicios). */
export const logger = pino(loggerOptions);
