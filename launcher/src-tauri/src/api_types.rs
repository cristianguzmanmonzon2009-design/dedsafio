use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub access_revoked: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user: UserProfile,
    pub tokens: AuthTokens,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokensResponse {
    pub tokens: AuthTokens,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserResponse {
    pub user: UserProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherConfig {
    pub server_id: String,
    pub server_name: String,
    pub minecraft: String,
    pub loader: String,
    pub loader_version: String,
    pub java_major: u32,
    pub authorized_address: String,
    #[serde(default)]
    pub background_url: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub discord_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherConfigResponse {
    pub config: LauncherConfig,
    pub signing_public_key_pem: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherVersion {
    pub latest: String,
    pub minimum: String,
    pub mandatory: bool,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Players {
    pub online: u32,
    pub max: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub server_id: String,
    pub online: bool,
    pub players: Players,
    pub version: String,
    #[serde(default)]
    pub motd: Option<String>,
    #[serde(default)]
    pub latency_ms: Option<u64>,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatusResponse {
    pub status: ServerStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsItem {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub image_url: Option<String>,
    pub published_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsResponse {
    pub news: Vec<NewsItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModEntry {
    pub id: String,
    pub version: String,
    pub sha256: String,
    pub size: u64,
    pub required: bool,
    pub file_name: String,
    #[serde(default)]
    pub servers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub protocol: String,
    pub version: String,
    pub minecraft: String,
    pub loader: String,
    pub loader_version: String,
    pub server_id: String,
    pub mods: Vec<ModEntry>,
    pub issued_at: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTicket {
    pub mod_id: String,
    pub url: String,
    pub expires_at: String,
    pub sha256: String,
    pub size: u64,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestResponse {
    pub manifest: Manifest,
    pub tickets: Vec<DownloadTicket>,
}
