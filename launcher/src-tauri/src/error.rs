use serde::{Serialize, Serializer};

/// Error serializable que viaja a la UI como string legible.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Msg(String),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
    #[error("{0}")]
    Zip(String),
    #[error("{0}")]
    Keyring(String),
}

impl AppError {
    pub fn msg(m: impl Into<String>) -> Self {
        AppError::Msg(m.into())
    }
}

impl From<String> for AppError {
    fn from(v: String) -> Self {
        AppError::Msg(v)
    }
}

impl From<&str> for AppError {
    fn from(v: &str) -> Self {
        AppError::Msg(v.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(v: zip::result::ZipError) -> Self {
        AppError::Zip(v.to_string())
    }
}

impl From<keyring::Error> for AppError {
    fn from(v: keyring::Error) -> Self {
        AppError::Keyring(v.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
