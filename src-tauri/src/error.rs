use serde::Serialize;
use thiserror::Error;

use crate::domain::ImportError;

/// Errors exposed by database commands to the frontend.
#[derive(Debug, Error)]
pub enum AppError {
    /// A SQLite operation failed.
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    /// CSV parsing or financial aggregation failed.
    #[error("{0}")]
    Import(#[from] ImportError),
    /// The database is not currently unlocked.
    #[error("the app is locked")]
    Locked,
    /// The supplied password did not unlock the database.
    #[error("incorrect password")]
    BadPassword,
    /// A command argument or persisted value is invalid.
    #[error("{0}")]
    InvalidInput(String),
    /// Application state could not be accessed.
    #[error("application state is unavailable")]
    StateUnavailable,
    /// A filesystem operation failed.
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    /// The Tauri application path could not be resolved.
    #[error("application path error: {0}")]
    ApplicationPath(String),
    /// Secure random number generation failed.
    #[error("secure random number generation failed: {0}")]
    Randomness(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
