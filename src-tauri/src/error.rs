use serde::{ser::SerializeStruct, Serialize};
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

impl AppError {
    /// Stable identifier the frontend can branch on, unlike the display text.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Import(ImportError::AmbiguousDateOrder) => "ambiguousDateOrder",
            Self::Import(
                ImportError::AmbiguousAmount(_) | ImportError::AmbiguousAmountRow { .. },
            ) => "ambiguousAmount",
            Self::Locked => "locked",
            Self::BadPassword => "badPassword",
            _ => "other",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut error = serializer.serialize_struct("AppError", 2)?;
        error.serialize_field("code", self.code())?;
        error.serialize_field("message", &self.to_string())?;
        error.end()
    }
}

#[cfg(test)]
mod tests {
    use super::AppError;
    use crate::domain::ImportError;

    #[test]
    fn errors_serialize_with_a_code_and_a_message() {
        let value = serde_json::to_value(AppError::BadPassword).unwrap();
        assert_eq!(
            value,
            serde_json::json!({ "code": "badPassword", "message": "incorrect password" })
        );
    }

    #[test]
    fn ambiguous_imports_have_codes_the_import_flow_can_branch_on() {
        let date = AppError::Import(ImportError::AmbiguousDateOrder);
        let amount = AppError::Import(ImportError::AmbiguousAmountRow {
            line: 2,
            value: "1,234".to_owned(),
        });
        let other = AppError::InvalidInput("nope".to_owned());
        assert_eq!(date.code(), "ambiguousDateOrder");
        assert_eq!(amount.code(), "ambiguousAmount");
        assert_eq!(other.code(), "other");
    }
}
