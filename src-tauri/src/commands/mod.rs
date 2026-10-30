/// Password setup and encrypted database lifecycle commands.
pub mod auth;
/// Transaction category lookup commands.
pub mod categories;
/// Financial goal tracking commands.
pub mod goals;
/// Statement preview and transaction import commands.
pub mod import;
/// Financial-data maintenance commands.
pub mod maintenance;
/// Application settings commands.
pub mod settings;
/// Financial summary commands.
pub mod summary;

use std::sync::MutexGuard;

use rusqlite::Connection;
use tauri::State;

use crate::{error::AppError, state::AppState};

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

fn connection<'a>(
    state: &'a State<'_, AppState>,
) -> Result<MutexGuard<'a, Option<Connection>>, AppError> {
    state.db.lock().map_err(|_| AppError::StateUnavailable)
}

fn validate_safe_cents(amount_cents: i64) -> Result<(), AppError> {
    if amount_cents.unsigned_abs() > MAX_SAFE_INTEGER {
        return Err(AppError::InvalidInput(
            "amount exceeds the safe integer range for the webview".to_owned(),
        ));
    }
    Ok(())
}
