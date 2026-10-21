use rusqlite::Connection;
use tauri::State;

use crate::{error::AppError, state::AppState};

#[tauri::command]
pub fn get_currency(state: State<'_, AppState>) -> Result<String, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    get_currency_from(connection)
}

fn get_currency_from(connection: &Connection) -> Result<String, AppError> {
    Ok(connection.query_row(
        "SELECT setting_value FROM settings WHERE setting_key = 'currency'",
        [],
        |row| row.get(0),
    )?)
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::db::run_migrations;

    use super::get_currency_from;

    #[test]
    fn currency_defaults_to_usd() {
        let mut connection = Connection::open_in_memory().unwrap();
        run_migrations(&mut connection).unwrap();

        assert_eq!(get_currency_from(&connection).unwrap(), "USD");
    }
}
