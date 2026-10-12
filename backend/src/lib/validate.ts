import type { z } from "zod";
import { ApiError } from "./errors.js";

/** Valida con Zod y lanza ApiError 400 con detalle legible. */
export function parse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest(
      "Datos de entrada inválidos",
      result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    );
  }
  return result.data;
}
