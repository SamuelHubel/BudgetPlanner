use tauri::{AppHandle, Manager, State};

use crate::{db::open_database, error::AppError, state::AppState};

#[tauri::command]
pub fn unlock(
    app: AppHandle,
    state: State<'_, AppState>,
    password: String,
) -> Result<(), AppError> {
    let _ = password;
    let mut database = super::connection(&state)?;
    if database.is_none() {
        let path = app
            .path()
            .app_data_dir()
            .map_err(|error| AppError::ApplicationPath(error.to_string()))?
            .join("budget.db");
        *database = Some(open_database(&path)?);
    }
    Ok(())
}

#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<(), AppError> {
    super::connection(&state)?.take();
    Ok(())
}
