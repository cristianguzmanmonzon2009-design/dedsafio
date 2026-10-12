/** Error de API con código HTTP y código de negocio estable. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "No autorizado") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message = "Acceso denegado") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "No encontrado") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "conflict", message);
  }
  static tooMany(message = "Demasiadas solicitudes") {
    return new ApiError(429, "rate_limited", message);
  }
  static internal(message = "Error interno") {
    return new ApiError(500, "internal_error", message);
  }
}
