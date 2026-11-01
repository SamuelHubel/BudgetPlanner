use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::State;

use crate::{
    domain::goals::{normalize_goal_title, spent_from_net, validate_goal_link, GoalError},
    error::AppError,
    state::AppState,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Spending progress for a goal linked to an expense category.
pub struct GoalProgressDto {
    /// Month the progress covers, in ISO `YYYY-MM` format.
    pub month: String,
    /// Non-negative net spending in the linked category, in integer cents.
    pub spent_cents: i64,
    /// Monthly spending limit in integer cents.
    pub limit_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Goal fields serialized for the frontend API.
pub struct GoalDto {
    /// Stable database identifier.
    pub id: i64,
    /// User-written goal text.
    pub title: String,
    /// Linked expense category, when the goal tracks spending.
    pub category_id: Option<i64>,
    /// Monthly spending limit in integer cents, when the goal tracks spending.
    pub spending_limit_cents: Option<i64>,
    /// Creation timestamp in ISO 8601 UTC format.
    pub created_at: String,
    /// Computed progress, or `None` when the goal is untracked or has no data.
    pub progress: Option<GoalProgressDto>,
}

/// Validated goal fields shared by the create and update commands.
struct GoalInput {
    title: String,
    category_id: Option<i64>,
    spending_limit_cents: Option<i64>,
}

/// Lists goals newest first, with spending progress for tracked goals.
#[tauri::command(async)]
pub fn list_goals(state: State<'_, AppState>) -> Result<Vec<GoalDto>, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    list_goals_from(connection)
}

/// Creates a goal and returns it with its computed progress.
#[tauri::command(async)]
pub fn create_goal(
    state: State<'_, AppState>,
    title: String,
    category_id: Option<i64>,
    spending_limit_cents: Option<i64>,
) -> Result<GoalDto, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    create_goal_in_connection(connection, &title, category_id, spending_limit_cents)
}

/// Replaces a goal's text and spending link, returning the updated goal.
#[tauri::command(async)]
pub fn update_goal(
    state: State<'_, AppState>,
    id: i64,
    title: String,
    category_id: Option<i64>,
    spending_limit_cents: Option<i64>,
) -> Result<GoalDto, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    update_goal_in_connection(connection, id, &title, category_id, spending_limit_cents)
}

/// Permanently deletes a goal.
#[tauri::command(async)]
pub fn delete_goal(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    delete_goal_in_connection(connection, id)
}

fn list_goals_from(connection: &Connection) -> Result<Vec<GoalDto>, AppError> {
    let tracked_month = latest_transaction_month(connection)?;
    // `id` only increases, so it orders by insertion even when `created_at`
    // timestamps tie within the same millisecond.
    let mut statement = connection.prepare(
        "SELECT id, title, category_id, target_amount_cents, created_at
         FROM goals
         ORDER BY id DESC",
    )?;
    let rows = statement
        .query_map([], read_goal_row)?
        .collect::<Result<Vec<_>, _>>()?;
    rows.into_iter()
        .map(|row| with_progress(connection, row, tracked_month.as_deref()))
        .collect()
}

fn create_goal_in_connection(
    connection: &Connection,
    title: &str,
    category_id: Option<i64>,
    spending_limit_cents: Option<i64>,
) -> Result<GoalDto, AppError> {
    let input = validate_input(connection, title, category_id, spending_limit_cents)?;
    connection.execute(
        "INSERT INTO goals (title, category_id, target_amount_cents) VALUES (?1, ?2, ?3)",
        params![input.title, input.category_id, input.spending_limit_cents],
    )?;
    load_goal(connection, connection.last_insert_rowid())
}

fn update_goal_in_connection(
    connection: &Connection,
    id: i64,
    title: &str,
    category_id: Option<i64>,
    spending_limit_cents: Option<i64>,
) -> Result<GoalDto, AppError> {
    let input = validate_input(connection, title, category_id, spending_limit_cents)?;
    let updated = connection.execute(
        "UPDATE goals SET title = ?1, category_id = ?2, target_amount_cents = ?3 WHERE id = ?4",
        params![
            input.title,
            input.category_id,
            input.spending_limit_cents,
            id
        ],
    )?;
    if updated == 0 {
        return Err(goal_not_found());
    }
    load_goal(connection, id)
}

fn delete_goal_in_connection(connection: &Connection, id: i64) -> Result<(), AppError> {
    let deleted = connection.execute("DELETE FROM goals WHERE id = ?1", [id])?;
    if deleted == 0 {
        return Err(goal_not_found());
    }
    Ok(())
}

/// Applies domain rules and checks that a linked category is a known expense category.
fn validate_input(
    connection: &Connection,
    title: &str,
    category_id: Option<i64>,
    spending_limit_cents: Option<i64>,
) -> Result<GoalInput, AppError> {
    let title = normalize_goal_title(title).map_err(goal_error)?;
    validate_goal_link(category_id, spending_limit_cents).map_err(goal_error)?;
    if let Some(limit) = spending_limit_cents {
        super::validate_safe_cents(limit)?;
    }
    if let Some(category_id) = category_id {
        super::ensure_expense_category(
            connection,
            category_id,
            "goals can only track expense categories",
        )?;
    }
    Ok(GoalInput {
        title,
        category_id,
        spending_limit_cents,
    })
}

fn load_goal(connection: &Connection, id: i64) -> Result<GoalDto, AppError> {
    let row = connection
        .query_row(
            "SELECT id, title, category_id, target_amount_cents, created_at
             FROM goals WHERE id = ?1",
            [id],
            read_goal_row,
        )
        .optional()?
        .ok_or_else(goal_not_found)?;
    let tracked_month = latest_transaction_month(connection)?;
    with_progress(connection, row, tracked_month.as_deref())
}

fn read_goal_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<GoalDto> {
    let category_id: Option<i64> = row.get(2)?;
    let spending_limit_cents: Option<i64> = row.get(3)?;
    Ok(GoalDto {
        id: row.get(0)?,
        title: row.get(1)?,
        category_id,
        // Deleting a category sets `category_id` to NULL but leaves the limit.
        // Report such goals as untracked so editing them passes validation.
        spending_limit_cents: category_id.and(spending_limit_cents),
        created_at: row.get(4)?,
        progress: None,
    })
}

/// The month progress is measured in: the latest month with any transaction.
///
/// Statements are imported after the fact, so the current calendar month is
/// often empty. This matches the month the Home tab shows by default.
fn latest_transaction_month(connection: &Connection) -> Result<Option<String>, AppError> {
    Ok(connection.query_row(
        "SELECT MAX(substr(date, 1, 7)) FROM transactions",
        [],
        |row| row.get(0),
    )?)
}

/// Fills in a goal's progress for the tracked month, when it is tracked.
fn with_progress(
    connection: &Connection,
    mut goal: GoalDto,
    tracked_month: Option<&str>,
) -> Result<GoalDto, AppError> {
    let (Some(category_id), Some(limit_cents), Some(month)) =
        (goal.category_id, goal.spending_limit_cents, tracked_month)
    else {
        return Ok(goal);
    };
    // One query per tracked goal is fine at personal-goal scale; switch to a
    // single GROUP BY over categories if goal counts ever grow large.
    let net_cents: i64 = connection.query_row(
        "SELECT COALESCE(SUM(amount_cents), 0) FROM transactions
         WHERE category_id = ?1 AND substr(date, 1, 7) = ?2",
        params![category_id, month],
        |row| row.get(0),
    )?;
    let spent_cents = spent_from_net(net_cents).map_err(goal_error)?;
    super::validate_safe_cents(spent_cents)?;
    goal.progress = Some(GoalProgressDto {
        month: month.to_owned(),
        spent_cents,
        limit_cents,
    });
    Ok(goal)
}

fn goal_error(error: GoalError) -> AppError {
    AppError::InvalidInput(error.to_string())
}

fn goal_not_found() -> AppError {
    AppError::InvalidInput("goal not found".to_owned())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;
    use crate::db::migrated_connection;

    fn category_id(connection: &Connection, name: &str) -> i64 {
        connection
            .query_row("SELECT id FROM categories WHERE name = ?1", [name], |row| {
                row.get(0)
            })
            .unwrap()
    }

    #[test]
    fn lists_goals_newest_first() {
        let connection = migrated_connection();
        create_goal_in_connection(&connection, "First", None, None).unwrap();
        create_goal_in_connection(&connection, "Second", None, None).unwrap();
        create_goal_in_connection(&connection, "Third", None, None).unwrap();

        let titles = list_goals_from(&connection)
            .unwrap()
            .into_iter()
            .map(|goal| goal.title)
            .collect::<Vec<_>>();

        assert_eq!(titles, ["Third", "Second", "First"]);
    }

    #[test]
    fn creates_updates_and_deletes_goals() {
        let connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");

        let created =
            create_goal_in_connection(&connection, "  Spend less on dining out ", None, None)
                .unwrap();
        assert_eq!(created.title, "Spend less on dining out");
        assert_eq!(created.category_id, None);

        let updated = update_goal_in_connection(
            &connection,
            created.id,
            "Cap dining at $300",
            Some(dining),
            Some(30_000),
        )
        .unwrap();
        assert_eq!(updated.id, created.id);
        assert_eq!(updated.title, "Cap dining at $300");
        assert_eq!(updated.category_id, Some(dining));
        assert_eq!(updated.spending_limit_cents, Some(30_000));

        delete_goal_in_connection(&connection, created.id).unwrap();
        assert!(list_goals_from(&connection).unwrap().is_empty());
    }

    #[test]
    fn unknown_goal_ids_are_reported() {
        let connection = migrated_connection();

        let update = update_goal_in_connection(&connection, 99, "Missing", None, None);
        let delete = delete_goal_in_connection(&connection, 99);

        assert!(update.unwrap_err().to_string().contains("goal not found"));
        assert!(delete.unwrap_err().to_string().contains("goal not found"));
    }

    #[test]
    fn rejects_invalid_spending_links() {
        let connection = migrated_connection();
        let pay = category_id(&connection, "Pay");
        let dining = category_id(&connection, "Dining Out");

        let income = create_goal_in_connection(&connection, "Goal", Some(pay), Some(100));
        let half_linked = create_goal_in_connection(&connection, "Goal", Some(dining), None);
        let unknown = create_goal_in_connection(&connection, "Goal", Some(999), Some(100));
        let empty = create_goal_in_connection(&connection, "   ", None, None);

        assert!(income.unwrap_err().to_string().contains("expense"));
        assert!(half_linked
            .unwrap_err()
            .to_string()
            .contains("both a category"));
        assert!(unknown
            .unwrap_err()
            .to_string()
            .contains("category not found"));
        assert!(empty.unwrap_err().to_string().contains("empty"));
        assert!(list_goals_from(&connection).unwrap().is_empty());
    }

    #[test]
    fn progress_uses_the_latest_month_and_nets_refunds() {
        let connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");
        let groceries = category_id(&connection, "Groceries");
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, description, date)
                 VALUES (?1, -90000, 'Old month', '2026-09-10'),
                        (?1, -25000, 'Dinner', '2026-10-03'),
                        (?1, 4000, 'Refund', '2026-10-05'),
                        (?2, -12000, 'Market', '2026-10-06')",
                params![dining, groceries],
            )
            .unwrap();

        let goal =
            create_goal_in_connection(&connection, "Dining", Some(dining), Some(30_000)).unwrap();

        assert_eq!(
            goal.progress,
            Some(GoalProgressDto {
                month: "2026-10".to_owned(),
                spent_cents: 21_000,
                limit_cents: 30_000,
            })
        );
    }

    #[test]
    fn untracked_goals_and_empty_data_have_no_progress() {
        let connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");

        let untracked = create_goal_in_connection(&connection, "Save more", None, None).unwrap();
        let no_data =
            create_goal_in_connection(&connection, "Dining", Some(dining), Some(30_000)).unwrap();

        assert_eq!(untracked.progress, None);
        assert_eq!(no_data.progress, None);
    }

    #[test]
    fn deleting_the_linked_category_makes_a_goal_untracked() {
        let connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (?1, -1000, '2026-10-01')",
                [dining],
            )
            .unwrap();
        let goal =
            create_goal_in_connection(&connection, "Dining", Some(dining), Some(30_000)).unwrap();
        assert!(goal.progress.is_some());

        connection
            .execute("DELETE FROM categories WHERE id = ?1", [dining])
            .unwrap();
        let goal = &list_goals_from(&connection).unwrap()[0];

        assert_eq!(goal.category_id, None);
        assert_eq!(goal.spending_limit_cents, None);
        assert_eq!(goal.progress, None);
        // The goal can be saved again without tripping the half-linked check.
        update_goal_in_connection(&connection, goal.id, "Dining", None, None).unwrap();
    }

    #[test]
    fn serializes_the_camel_case_ipc_contract() {
        let connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (?1, -1000, '2026-10-01')",
                [dining],
            )
            .unwrap();
        let goal =
            create_goal_in_connection(&connection, "Dining", Some(dining), Some(30_000)).unwrap();

        let value = serde_json::to_value(goal).unwrap();

        assert_eq!(value["categoryId"], dining);
        assert_eq!(value["spendingLimitCents"], 30_000);
        assert!(value["createdAt"].is_string());
        assert_eq!(value["progress"]["month"], "2026-10");
        assert_eq!(value["progress"]["spentCents"], 1000);
        assert_eq!(value["progress"]["limitCents"], 30_000);
        assert!(value.get("category_id").is_none());
    }
}
