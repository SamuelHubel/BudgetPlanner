use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{
    domain::{Category, CategoryType},
    error::AppError,
    state::AppState,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// Category fields serialized for the frontend API.
pub struct CategoryDto {
    /// Stable database identifier.
    pub id: i64,
    /// User-facing category name.
    pub name: String,
    #[serde(rename = "type")]
    /// Category direction: `income` or `expense`.
    pub category_type: String,
    /// Optional display color as a CSS hex string.
    pub color: Option<String>,
}

/// Lists the categories available for transaction assignment.
#[tauri::command]
pub fn list_categories(state: State<'_, AppState>) -> Result<Vec<CategoryDto>, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    list_categories_from(connection)
}

pub(crate) fn list_categories_from(connection: &Connection) -> Result<Vec<CategoryDto>, AppError> {
    let mut statement =
        connection.prepare("SELECT id, name, type, color FROM categories ORDER BY name")?;
    let categories = statement
        .query_map([], |row| {
            Ok(CategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
                category_type: row.get(2)?,
                color: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(categories)
}

pub(crate) fn load_domain_categories(connection: &Connection) -> Result<Vec<Category>, AppError> {
    let mut statement =
        connection.prepare("SELECT id, name, type FROM categories ORDER BY name")?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let categories = rows
        .into_iter()
        .map(|(id, name, category_type)| {
            let category_type = match category_type.as_str() {
                "income" => CategoryType::Income,
                "expense" => CategoryType::Expense,
                _ => {
                    return Err(AppError::InvalidInput(format!(
                        "category {id} has an invalid type"
                    )))
                }
            };
            Ok(Category {
                id,
                name,
                category_type,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(categories)
}
