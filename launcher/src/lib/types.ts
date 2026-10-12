// Tipos que espejan el contrato del backend (shared/). Se mantienen locales
// para que el launcher compile como proyecto independiente.

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  accessRevoked: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface LauncherConfig {
  serverId: string;
  serverName: string;
  minecraft: string;
  loader: "fabric";
  loaderVersion: string;
  javaMajor: number;
  authorizedAddress: string;
  backgroundUrl?: string;
  logoUrl?: string;
  discordUrl?: string;
}

export interface ServerStatus {
  serverId: string;
  online: boolean;
  players: { online: number; max: number };
  version: string;
  motd?: string;
  latencyMs?: number;
  checkedAt: string;
}

export type NewsType =
  | "news"
  | "update"
  | "event"
  | "maintenance"
  | "announcement";

export interface NewsItem {
  id: string;
  type: NewsType;
  title: string;
  description: string;
  imageUrl?: string;
  publishedAt: string;
}

export interface ModEntry {
  id: string;
  version: string;
  sha256: string;
  size: number;
  required: boolean;
  fileName: string;
  servers?: string[];
}

export interface Manifest {
  protocol: string;
  version: string;
  minecraft: string;
  loader: "fabric";
  loaderVersion: string;
  serverId: string;
  mods: ModEntry[];
  issuedAt: string;
  signature: string;
}

export interface LauncherVersion {
  latest: string;
  minimum: string;
  mandatory: boolean;
  url?: string;
  sha256?: string;
  notes?: string;
}

export type InstallPhase =
  | "idle"
  | "checking"
  | "java"
  | "minecraft"
  | "fabric"
  | "mods"
  | "verifying"
  | "launching"
  | "running"
  | "error";

export interface ProgressEvent {
  phase: InstallPhase;
  message: string;
  currentFile?: string;
  /** 0..1 dentro de la fase. */
  phaseProgress: number;
  /** 0..1 global. */
  totalProgress: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  error?: string;
}

export interface JavaInfo {
  path: string;
  version: string;
  major: number;
  vendor?: string;
}

export interface LauncherSettings {
  minRamMb: number;
  maxRamMb: number;
  width: number;
  height: number;
  fullscreen: boolean;
  installDir: string;
  jvmArgs: string;
  language: string;
  autoUpdate: boolean;
}
