use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{error::AppError, state::AppState};

const IMPORT_USE_SUBCATEGORIES: &str = "import_use_subcategories";
const SHOW_SUBCATEGORY_CHARTS: &str = "show_subcategory_charts";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Remembered choices for how subcategories are assigned and displayed.
pub struct CategorySettings {
    /// Whether the import screen assigns subcategories by default.
    pub use_subcategories_on_import: bool,
    /// Whether selecting a main category opens its subcategory donut.
    pub show_subcategory_charts: bool,
}

#[tauri::command(async)]
/// Returns the persisted currency code used for financial display.
pub fn get_currency(state: State<'_, AppState>) -> Result<String, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    read_currency_from(connection)
}

fn read_currency_from(connection: &Connection) -> Result<String, AppError> {
    Ok(connection.query_row(
        "SELECT setting_value FROM settings WHERE setting_key = 'currency'",
        [],
        |row| row.get(0),
    )?)
}

/// Returns the remembered subcategory choices.
#[tauri::command(async)]
pub fn get_category_settings(state: State<'_, AppState>) -> Result<CategorySettings, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    read_category_settings_from(connection)
}

/// Persists the subcategory choices.
#[tauri::command(async)]
pub fn update_category_settings(
    state: State<'_, AppState>,
    settings: CategorySettings,
) -> Result<CategorySettings, AppError> {
    let mut database = super::connection(&state)?;
    let connection = database.as_mut().ok_or(AppError::Locked)?;
    write_category_settings_in(connection, settings)?;
    read_category_settings_from(connection)
}

fn read_category_settings_from(connection: &Connection) -> Result<CategorySettings, AppError> {
    Ok(CategorySettings {
        use_subcategories_on_import: read_flag(connection, IMPORT_USE_SUBCATEGORIES)?,
        show_subcategory_charts: read_flag(connection, SHOW_SUBCATEGORY_CHARTS)?,
    })
}

fn read_flag(connection: &Connection, key: &str) -> Result<bool, AppError> {
    let value: String = connection.query_row(
        "SELECT setting_value FROM settings WHERE setting_key = ?1",
        [key],
        |row| row.get(0),
    )?;
    Ok(value == "true")
}

fn write_category_settings_in(
    connection: &mut Connection,
    settings: CategorySettings,
) -> Result<(), AppError> {
    let transaction = connection.transaction()?;
    for (key, value) in [
        (
            IMPORT_USE_SUBCATEGORIES,
            settings.use_subcategories_on_import,
        ),
        (SHOW_SUBCATEGORY_CHARTS, settings.show_subcategory_charts),
    ] {
        transaction.execute(
            "UPDATE settings SET setting_value = ?2 WHERE setting_key = ?1",
            params![key, if value { "true" } else { "false" }],
        )?;
    }
    transaction.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::db::{migrated_connection, run_migrations};

    use super::{
        read_category_settings_from, read_currency_from, write_category_settings_in,
        CategorySettings,
    };

    #[test]
    fn category_settings_default_on_and_round_trip() {
        let mut connection = migrated_connection();
        assert_eq!(
            read_category_settings_from(&connection).unwrap(),
            CategorySettings {
                use_subcategories_on_import: true,
                show_subcategory_charts: true,
            }
        );

        let changed = CategorySettings {
            use_subcategories_on_import: false,
            show_subcategory_charts: true,
        };
        write_category_settings_in(&mut connection, changed).unwrap();

        assert_eq!(read_category_settings_from(&connection).unwrap(), changed);
    }

    #[test]
    fn currency_defaults_to_usd() {
        let mut connection = Connection::open_in_memory().unwrap();
        run_migrations(&mut connection).unwrap();

        assert_eq!(read_currency_from(&connection).unwrap(), "USD");
    }
}
