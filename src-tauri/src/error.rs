use serde::Serialize;
use thiserror::Error;

use crate::domain::ImportError;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("{0}")]
    Import(#[from] ImportError),
    #[error("the app is locked")]
    Locked,
    #[error("{0}")]
    InvalidInput(String),
    #[error("application state is unavailable")]
    StateUnavailable,
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("application path error: {0}")]
    ApplicationPath(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
