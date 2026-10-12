use std::net::SocketAddr;
use std::process::Child;
use std::sync::Arc;
use std::time::Duration;

use reqwest::{Method, StatusCode};
use serde::de::DeserializeOwned;
use serde::Serialize;
use tokio::sync::Mutex;

use crate::api_types::{AuthTokens, TokensResponse};
use crate::error::{AppError, AppResult};

const KEYRING_SERVICE: &str = "com.dedsafio.launcher";
const KEYRING_USER: &str = "refresh_token";

#[derive(Default)]
pub struct Session {
    pub access: Option<String>,
    pub refresh: Option<String>,
    pub hardware_id: Option<String>,
    pub username: Option<String>,
}

/// Resolutor DNS que prefiere IPv4 para evitar fallos en CDNs con IPv6 roto.
#[derive(Debug)]
struct Ipv4FirstResolver;

impl reqwest::dns::Resolve for Ipv4FirstResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let addrs = tokio::net::lookup_host((host.as_str(), 0))
                .await
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
            let mut v4: Vec<SocketAddr> = Vec::new();
            let mut v6: Vec<SocketAddr> = Vec::new();
            for a in addrs {
                if a.is_ipv4() {
                    v4.push(a);
                } else {
                    v6.push(a);
                }
            }
            v4.extend(v6);
            let iter: reqwest::dns::Addrs = Box::new(v4.into_iter());
            Ok(iter)
        })
    }
}

pub struct AppState {
    pub base_url: String,
    pub client: reqwest::Client,
    pub session: Arc<Mutex<Session>>,
    pub child: Arc<Mutex<Option<Child>>>,
}

impl AppState {
    pub fn new(base_url: String) -> AppResult<Self> {
        let client = reqwest::Client::builder()
            .user_agent(concat!("DedsafioLauncher/", env!("CARGO_PKG_VERSION")))
            .dns_resolver(Arc::new(Ipv4FirstResolver))
            .connect_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(120))
            .build()?;
        Ok(Self {
            base_url,
            client,
            session: Arc::new(Mutex::new(Session::default())),
            child: Arc::new(Mutex::new(None)),
        })
    }

    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    pub async fn set_session(&self, tokens: &AuthTokens) {
        let mut s = self.session.lock().await;
        s.access = Some(tokens.access_token.clone());
        s.refresh = Some(tokens.refresh_token.clone());
        drop(s);
        let _ = save_refresh_token(&tokens.refresh_token);
    }

    pub async fn clear_session(&self) {
        let mut s = self.session.lock().await;
        s.access = None;
        s.refresh = None;
        drop(s);
        let _ = delete_refresh_token();
    }

    pub async fn access_token(&self) -> Option<String> {
        self.session.lock().await.access.clone()
    }

    pub async fn set_hardware_id(&self, id: &str) {
        self.session.lock().await.hardware_id = Some(id.to_string());
    }

    pub async fn hardware_id(&self) -> String {
        self.session
            .lock()
            .await
            .hardware_id
            .clone()
            .unwrap_or_default()
    }

    pub async fn set_username(&self, name: &str) {
        self.session.lock().await.username = Some(name.to_string());
    }

    pub async fn username(&self) -> String {
        self.session
            .lock()
            .await
            .username
            .clone()
            .unwrap_or_else(|| "Player".to_string())
    }

    pub async fn refresh_token(&self) -> Option<String> {
        let s = self.session.lock().await;
        if s.refresh.is_some() {
            return s.refresh.clone();
        }
        drop(s);
        load_refresh_token().ok().flatten()
    }

    /// Restaura el refresh token persistido (Credential Manager) al inicio.
    pub async fn restore_refresh_token(&self) {
        if let Ok(Some(token)) = load_refresh_token() {
            self.session.lock().await.refresh = Some(token);
        }
    }

    /// Reintenta una vez rotando el refresh token ante un 401.
    pub async fn refresh_session(&self) -> AppResult<()> {
        let refresh = self
            .refresh_token()
            .await
            .ok_or_else(|| AppError::msg("invalid_credentials: sesión expirada"))?;
        let res = self
            .client
            .post(self.url("/api/v1/auth/refresh"))
            .json(&serde_json::json!({ "refreshToken": refresh }))
            .send()
            .await?;
        if !res.status().is_success() {
            self.clear_session().await;
            return Err(AppError::msg("invalid_credentials: sesión expirada"));
        }
        let body: TokensResponse = res.json().await?;
        self.set_session(&body.tokens).await;
        Ok(())
    }

    /// GET autenticado con reintento tras refrescar el token.
    pub async fn get_authed<T: DeserializeOwned>(&self, path: &str) -> AppResult<T> {
        let res = self.send_authed(Method::GET, path, None::<&()>).await?;
        Ok(res.json().await?)
    }

    pub async fn post_authed<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> AppResult<T> {
        let res = self.send_authed(Method::POST, path, Some(body)).await?;
        Ok(res.json().await?)
    }

    async fn send_authed<B: Serialize>(
        &self,
        method: Method,
        path: &str,
        body: Option<&B>,
    ) -> AppResult<reqwest::Response> {
        let send = |token: Option<String>| {
            let mut rb = self.client.request(method.clone(), self.url(path));
            if let Some(t) = token {
                rb = rb.bearer_auth(t);
            }
            if let Some(b) = body {
                rb = rb.json(b);
            }
            rb.send()
        };

        let token = self.access_token().await;
        let res = send(token).await?;
        if res.status() == StatusCode::UNAUTHORIZED {
            self.refresh_session().await?;
            let token = self.access_token().await;
            let res = send(token).await?;
            return self.check(res).await;
        }
        self.check(res).await
    }

    async fn check(&self, res: reqwest::Response) -> AppResult<reqwest::Response> {
        if res.status().is_success() {
            return Ok(res);
        }
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        let code = match status {
            StatusCode::UNAUTHORIZED => "invalid_credentials",
            StatusCode::CONFLICT => "conflict",
            StatusCode::FORBIDDEN => "revoked",
            _ => "http_error",
        };
        Err(AppError::msg(format!("{code}: {text}")))
    }

    /// Descarga cruda sin autenticación (URLs firmadas de tickets).
    pub async fn get_bytes(&self, path: &str) -> AppResult<reqwest::Response> {
        let res = self.client.get(self.url(path)).send().await?;
        if !res.status().is_success() {
            return Err(AppError::msg(format!(
                "No se pudo descargar ({})",
                res.status()
            )));
        }
        Ok(res)
    }
}

/* --------------------------- Credential Manager --------------------------- */

fn entry() -> Result<keyring::Entry, keyring::Error> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
}

pub fn save_refresh_token(token: &str) -> Result<(), keyring::Error> {
    entry()?.set_password(token)
}

pub fn load_refresh_token() -> Result<Option<String>, keyring::Error> {
    match entry()?.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn delete_refresh_token() -> Result<(), keyring::Error> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e),
    }
}
