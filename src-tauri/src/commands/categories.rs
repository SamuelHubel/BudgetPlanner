use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{
    domain::{Category, CategoryType, Subcategory},
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// Subcategory fields serialized for the frontend API.
pub struct SubcategoryDto {
    /// Stable database identifier.
    pub id: i64,
    /// Identifier of the parent main category.
    pub category_id: i64,
    /// User-facing subcategory name.
    pub name: String,
    /// Optional display color as a CSS hex string.
    pub color: Option<String>,
}

/// Lists the categories available for transaction assignment.
#[tauri::command(async)]
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

/// Lists the subcategories available for transaction assignment.
#[tauri::command(async)]
pub fn list_subcategories(state: State<'_, AppState>) -> Result<Vec<SubcategoryDto>, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    list_subcategories_from(connection)
}

pub(crate) fn list_subcategories_from(
    connection: &Connection,
) -> Result<Vec<SubcategoryDto>, AppError> {
    let mut statement = connection
        .prepare("SELECT id, category_id, name, color FROM subcategories ORDER BY name")?;
    let subcategories = statement
        .query_map([], |row| {
            Ok(SubcategoryDto {
                id: row.get(0)?,
                category_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(subcategories)
}

/// Loads subcategories as domain values for categorization and summaries.
pub(crate) fn load_domain_subcategories(
    connection: &Connection,
) -> Result<Vec<Subcategory>, AppError> {
    Ok(list_subcategories_from(connection)?
        .into_iter()
        .map(|subcategory| Subcategory {
            id: subcategory.id,
            category_id: subcategory.category_id,
            name: subcategory.name,
        })
        .collect())
}

pub(crate) fn load_domain_categories(connection: &Connection) -> Result<Vec<Category>, AppError> {
    domain_categories(&list_categories_from(connection)?)
}

/// Converts API category records into the domain's typed categories.
pub(crate) fn domain_categories(categories: &[CategoryDto]) -> Result<Vec<Category>, AppError> {
    categories
        .iter()
        .map(|category| {
            let category_type = match category.category_type.as_str() {
                "income" => CategoryType::Income,
                "expense" => CategoryType::Expense,
                _ => {
                    return Err(AppError::InvalidInput(format!(
                        "category {} has an invalid type",
                        category.id
                    )))
                }
            };
            Ok(Category {
                id: category.id,
                name: category.name.clone(),
                category_type,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrated_connection;

    #[test]
    fn subcategories_serialize_with_their_parent_id() {
        let connection = migrated_connection();

        let subcategories = list_subcategories_from(&connection).unwrap();
        let coffee = subcategories
            .iter()
            .find(|subcategory| subcategory.name == "Coffee")
            .unwrap();
        let value = serde_json::to_value(coffee).unwrap();

        assert_eq!(value["categoryId"], coffee.category_id);
        assert!(value.get("category_id").is_none());
    }
}
