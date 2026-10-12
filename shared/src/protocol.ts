/**
 * Protocolo compartido launcher <-> backend.
 * Este paquete es la única fuente de verdad del contrato de red.
 */

export const PROTOCOL_VERSION = "1" as const;

/** Versión de Minecraft objetivo de toda la plataforma. */
export const TARGET_MINECRAFT = "1.21.1" as const;

/**
 * Fabric Loader por defecto. Es configurable por entorno en el backend y
 * puede sobreescribirse desde el manifiesto publicado.
 */
export const DEFAULT_FABRIC_LOADER = "0.19.5" as const;

/** Java requerido por Minecraft 1.21.1. */
export const REQUIRED_JAVA_MAJOR = 21 as const;

/** Tipos de build de Minecraft aceptados por el instalador. */
export const MINECRAFT_CHANNEL = "release" as const;

/** Endpoints oficiales públicos (no privados) usados por el instalador. */
export const PUBLIC_ENDPOINTS = {
  mojangVersionManifest:
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  mojangResources: "https://resources.download.minecraft.net",
  fabricMeta: "https://meta.fabricmc.net/v2",
  fabricMaven: "https://maven.fabricmc.net",
} as const;

/** Tiempos (segundos) del sistema de licencias y descargas. */
export const TOKEN_TTL = {
  /** Access token de sesión del launcher. */
  access: 60 * 15,
  /** Refresh token (rotativo). */
  refresh: 60 * 60 * 24 * 30,
  /** Token temporal de licencia que viaja al mod. */
  license: 60 * 10,
  /** Vida de una URL firmada de descarga. */
  downloadUrl: 60 * 5,
} as const;

/** Cabeceras HTTP propias del protocolo. */
export const HEADERS = {
  protocolVersion: "x-dedsafio-protocol",
  hardwareId: "x-dedsafio-hwid",
  launcherVersion: "x-dedsafio-launcher",
  signature: "x-dedsafio-signature",
} as const;

/** Prefijo de rutas de la API. */
export const API_PREFIX = "/api/v1" as const;

export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const NEWS_TYPES = [
  "news",
  "update",
  "event",
  "maintenance",
  "announcement",
] as const;
export type NewsType = (typeof NEWS_TYPES)[number];
