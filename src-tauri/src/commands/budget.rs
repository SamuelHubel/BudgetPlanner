use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    domain::{
        budget::{validate_budget_amounts, validate_month, BudgetError, BudgetInputMode},
        goals::spent_from_net,
    },
    error::AppError,
    state::AppState,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// The amount budgeted for one expense category.
pub struct BudgetAllocationDto {
    /// Expense category the allocation belongs to.
    pub category_id: i64,
    /// Budgeted amount in integer cents.
    pub amount_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
/// A saved budget for one calendar month.
pub struct BudgetDto {
    /// Month the budget covers, in ISO `YYYY-MM` format.
    pub month: String,
    /// Income the user expects this month, in integer cents.
    pub expected_income_cents: i64,
    /// How allocations are entered: `percent` or `amount`.
    pub input_mode: String,
    /// Positive allocations ordered by category id.
    pub allocations: Vec<BudgetAllocationDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Actual spending in one expense category.
pub struct BudgetActualDto {
    /// Expense category the spending belongs to.
    pub category_id: i64,
    /// Positive net spending in integer cents.
    pub spent_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Everything the Budget tab shows for one calendar month.
pub struct BudgetMonthDto {
    /// The requested month, in ISO `YYYY-MM` format.
    pub month: String,
    /// The month's saved budget, when one exists.
    pub budget: Option<BudgetDto>,
    /// The nearest earlier budget to copy from, when this month has no budget.
    pub template: Option<BudgetDto>,
    /// Categories with positive net spending this month.
    pub actuals: Vec<BudgetActualDto>,
    /// Outflows this month with no category, in integer cents.
    pub uncategorized_spent_cents: i64,
}

/// Loads a month's budget, copy-forward template, and actual spending.
#[tauri::command]
pub fn get_budget(state: State<'_, AppState>, month: String) -> Result<BudgetMonthDto, AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    load_budget_month(connection, &month)
}

/// Creates or replaces a month's budget and returns it.
#[tauri::command]
pub fn save_budget(
    state: State<'_, AppState>,
    month: String,
    expected_income_cents: i64,
    input_mode: String,
    allocations: Vec<BudgetAllocationDto>,
) -> Result<BudgetDto, AppError> {
    let mut database = super::connection(&state)?;
    let connection = database.as_mut().ok_or(AppError::Locked)?;
    save_budget_in_connection(
        connection,
        &month,
        expected_income_cents,
        &input_mode,
        &allocations,
    )
}

/// Permanently deletes a month's budget.
#[tauri::command]
pub fn delete_budget(state: State<'_, AppState>, month: String) -> Result<(), AppError> {
    let database = super::connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    delete_budget_in_connection(connection, &month)
}

fn load_budget_month(connection: &Connection, month: &str) -> Result<BudgetMonthDto, AppError> {
    validate_month(month).map_err(budget_error)?;
    let budget = load_budget(connection, month)?;
    let template = if budget.is_some() {
        None
    } else {
        let template_month: Option<String> = connection
            .query_row(
                "SELECT month FROM budgets WHERE month < ?1 ORDER BY month DESC LIMIT 1",
                [month],
                |row| row.get(0),
            )
            .optional()?;
        match template_month {
            Some(template_month) => load_budget(connection, &template_month)?,
            None => None,
        }
    };
    Ok(BudgetMonthDto {
        month: month.to_owned(),
        budget,
        template,
        actuals: load_actuals(connection, month)?,
        uncategorized_spent_cents: load_uncategorized_spending(connection, month)?,
    })
}

fn load_budget(connection: &Connection, month: &str) -> Result<Option<BudgetDto>, AppError> {
    let row = connection
        .query_row(
            "SELECT id, expected_income_cents, input_mode FROM budgets WHERE month = ?1",
            [month],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    let Some((id, expected_income_cents, input_mode)) = row else {
        return Ok(None);
    };
    let mut statement = connection.prepare(
        "SELECT category_id, amount_cents FROM budget_allocations
         WHERE budget_id = ?1
         ORDER BY category_id",
    )?;
    let allocations = statement
        .query_map([id], |row| {
            Ok(BudgetAllocationDto {
                category_id: row.get(0)?,
                amount_cents: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Some(BudgetDto {
        month: month.to_owned(),
        expected_income_cents,
        input_mode,
        allocations,
    }))
}

/// Sums net spending per expense category for the month, dropping categories
/// whose refunds cancel out their spending.
fn load_actuals(connection: &Connection, month: &str) -> Result<Vec<BudgetActualDto>, AppError> {
    let mut statement = connection.prepare(
        "SELECT t.category_id, SUM(t.amount_cents)
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE c.type = 'expense' AND substr(t.date, 1, 7) = ?1
         GROUP BY t.category_id
         ORDER BY t.category_id",
    )?;
    let rows = statement
        .query_map([month], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut actuals = Vec::with_capacity(rows.len());
    for (category_id, net_cents) in rows {
        let spent_cents = spent_from_net(net_cents).map_err(spending_error)?;
        super::validate_safe_cents(spent_cents)?;
        if spent_cents > 0 {
            actuals.push(BudgetActualDto {
                category_id,
                spent_cents,
            });
        }
    }
    Ok(actuals)
}

/// Sums uncategorized outflows only: uncategorized rows have no category type,
/// so positive ones may be income rather than refunds.
fn load_uncategorized_spending(connection: &Connection, month: &str) -> Result<i64, AppError> {
    let net_cents: i64 = connection.query_row(
        "SELECT COALESCE(SUM(amount_cents), 0) FROM transactions
         WHERE category_id IS NULL AND amount_cents < 0 AND substr(date, 1, 7) = ?1",
        [month],
        |row| row.get(0),
    )?;
    let spent_cents = spent_from_net(net_cents).map_err(spending_error)?;
    super::validate_safe_cents(spent_cents)?;
    Ok(spent_cents)
}

fn save_budget_in_connection(
    connection: &mut Connection,
    month: &str,
    expected_income_cents: i64,
    input_mode: &str,
    allocations: &[BudgetAllocationDto],
) -> Result<BudgetDto, AppError> {
    validate_month(month).map_err(budget_error)?;
    let input_mode = BudgetInputMode::parse(input_mode).map_err(budget_error)?;
    let amounts = allocations
        .iter()
        .map(|item| (item.category_id, item.amount_cents))
        .collect::<Vec<_>>();
    validate_budget_amounts(expected_income_cents, &amounts).map_err(budget_error)?;
    super::validate_safe_cents(expected_income_cents)?;
    for allocation in allocations {
        super::validate_safe_cents(allocation.amount_cents)?;
    }

    let transaction = connection.transaction()?;
    for allocation in allocations {
        ensure_expense_category(&transaction, allocation.category_id)?;
    }
    let budget_id: i64 = transaction.query_row(
        "INSERT INTO budgets (month, expected_income_cents, input_mode)
         VALUES (?1, ?2, ?3)
         ON CONFLICT (month) DO UPDATE SET
           expected_income_cents = excluded.expected_income_cents,
           input_mode = excluded.input_mode,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         RETURNING id",
        params![month, expected_income_cents, input_mode.as_str()],
        |row| row.get(0),
    )?;
    transaction.execute(
        "DELETE FROM budget_allocations WHERE budget_id = ?1",
        [budget_id],
    )?;
    for allocation in allocations.iter().filter(|item| item.amount_cents > 0) {
        transaction.execute(
            "INSERT INTO budget_allocations (budget_id, category_id, amount_cents)
             VALUES (?1, ?2, ?3)",
            params![budget_id, allocation.category_id, allocation.amount_cents],
        )?;
    }
    transaction.commit()?;

    load_budget(connection, month)?
        .ok_or_else(|| AppError::InvalidInput("budget not found".to_owned()))
}

fn delete_budget_in_connection(connection: &Connection, month: &str) -> Result<(), AppError> {
    validate_month(month).map_err(budget_error)?;
    let deleted = connection.execute("DELETE FROM budgets WHERE month = ?1", [month])?;
    if deleted == 0 {
        return Err(AppError::InvalidInput("budget not found".to_owned()));
    }
    Ok(())
}

/// Checks that a category exists and tracks expenses.
fn ensure_expense_category(connection: &Connection, category_id: i64) -> Result<(), AppError> {
    let category_type: Option<String> = connection
        .query_row(
            "SELECT type FROM categories WHERE id = ?1",
            [category_id],
            |row| row.get(0),
        )
        .optional()?;
    match category_type.as_deref() {
        Some("expense") => Ok(()),
        Some(_) => Err(AppError::InvalidInput(
            "budgets can only allocate expense categories".to_owned(),
        )),
        None => Err(AppError::InvalidInput("category not found".to_owned())),
    }
}

fn budget_error(error: BudgetError) -> AppError {
    AppError::InvalidInput(error.to_string())
}

fn spending_error(error: impl std::fmt::Display) -> AppError {
    AppError::InvalidInput(error.to_string())
}

#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};

    use super::*;
    use crate::db::run_migrations;

    fn migrated_connection() -> Connection {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        run_migrations(&mut connection).unwrap();
        connection
    }

    fn category_id(connection: &Connection, name: &str) -> i64 {
        connection
            .query_row("SELECT id FROM categories WHERE name = ?1", [name], |row| {
                row.get(0)
            })
            .unwrap()
    }

    fn allocation(category_id: i64, amount_cents: i64) -> BudgetAllocationDto {
        BudgetAllocationDto {
            category_id,
            amount_cents,
        }
    }

    fn save(
        connection: &mut Connection,
        month: &str,
        income: i64,
        allocations: Vec<BudgetAllocationDto>,
    ) -> Result<BudgetDto, AppError> {
        save_budget_in_connection(connection, month, income, "percent", &allocations)
    }

    #[test]
    fn a_month_without_budgets_is_empty() {
        let connection = migrated_connection();

        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert_eq!(view.month, "2026-10");
        assert_eq!(view.budget, None);
        assert_eq!(view.template, None);
        assert!(view.actuals.is_empty());
        assert_eq!(view.uncategorized_spent_cents, 0);
    }

    #[test]
    fn saves_and_reloads_a_budget() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");

        let saved = save_budget_in_connection(
            &mut connection,
            "2026-10",
            500_000,
            "amount",
            &[allocation(housing, 150_000)],
        )
        .unwrap();
        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert_eq!(saved.month, "2026-10");
        assert_eq!(saved.expected_income_cents, 500_000);
        assert_eq!(saved.input_mode, "amount");
        assert_eq!(saved.allocations, [allocation(housing, 150_000)]);
        assert_eq!(view.budget, Some(saved));
    }

    #[test]
    fn saving_a_month_again_replaces_its_budget() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");
        let dining = category_id(&connection, "Dining Out");
        save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(housing, 150_000)],
        )
        .unwrap();

        let saved = save(
            &mut connection,
            "2026-10",
            600_000,
            vec![allocation(dining, 20_000)],
        )
        .unwrap();

        assert_eq!(saved.expected_income_cents, 600_000);
        assert_eq!(saved.allocations, [allocation(dining, 20_000)]);
        let budget_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM budgets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(budget_count, 1);
    }

    #[test]
    fn zero_allocations_are_not_stored() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");
        let dining = category_id(&connection, "Dining Out");

        let saved = save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(housing, 150_000), allocation(dining, 0)],
        )
        .unwrap();

        assert_eq!(saved.allocations, [allocation(housing, 150_000)]);
    }

    #[test]
    fn allocations_above_income_can_be_saved() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");

        let saved = save(
            &mut connection,
            "2026-10",
            100_000,
            vec![allocation(housing, 120_000)],
        )
        .unwrap();

        assert_eq!(saved.allocations, [allocation(housing, 120_000)]);
    }

    #[test]
    fn template_is_the_nearest_earlier_budget() {
        let mut connection = migrated_connection();
        for (month, income) in [
            ("2026-07", 100_000),
            ("2026-09", 200_000),
            ("2026-12", 300_000),
        ] {
            save(&mut connection, month, income, vec![]).unwrap();
        }

        let view = load_budget_month(&connection, "2026-10").unwrap();
        let template = view.template.unwrap();

        assert_eq!(view.budget, None);
        assert_eq!(template.month, "2026-09");
        assert_eq!(template.expected_income_cents, 200_000);
    }

    #[test]
    fn no_template_without_an_earlier_budget() {
        let mut connection = migrated_connection();
        save(&mut connection, "2026-12", 300_000, vec![]).unwrap();

        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert_eq!(view.template, None);
    }

    #[test]
    fn a_month_with_a_budget_has_no_template() {
        let mut connection = migrated_connection();
        save(&mut connection, "2026-09", 200_000, vec![]).unwrap();
        save(&mut connection, "2026-10", 300_000, vec![]).unwrap();

        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert!(view.budget.is_some());
        assert_eq!(view.template, None);
    }

    #[test]
    fn rejects_invalid_budgets_without_changing_the_saved_one() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");
        let pay = category_id(&connection, "Pay");
        let original = save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(housing, 150_000)],
        )
        .unwrap();

        let income_category = save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(pay, 100)],
        );
        let unknown_category = save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(999, 100)],
        );
        let no_income = save(&mut connection, "2026-10", 0, vec![]);
        let bad_month = save(&mut connection, "2026-13", 500_000, vec![]);
        let unsafe_amount = save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(housing, i64::MAX)],
        );
        let bad_mode =
            save_budget_in_connection(&mut connection, "2026-10", 500_000, "shares", &[]);

        assert!(income_category.unwrap_err().to_string().contains("expense"));
        assert!(unknown_category
            .unwrap_err()
            .to_string()
            .contains("category not found"));
        assert!(no_income.unwrap_err().to_string().contains("income"));
        assert!(bad_month.unwrap_err().to_string().contains("YYYY-MM"));
        assert!(unsafe_amount.unwrap_err().to_string().contains("safe"));
        assert!(bad_mode.unwrap_err().to_string().contains("input mode"));
        let view = load_budget_month(&connection, "2026-10").unwrap();
        assert_eq!(view.budget, Some(original));
    }

    #[test]
    fn get_rejects_a_malformed_month() {
        let connection = migrated_connection();

        assert!(load_budget_month(&connection, "October").is_err());
    }

    #[test]
    fn actuals_cover_only_the_selected_month_and_net_refunds() {
        let mut connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");
        let groceries = category_id(&connection, "Groceries");
        let shopping = category_id(&connection, "Shopping");
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, description, date)
                 VALUES (?1, -90000, 'Other month', '2026-09-10'),
                        (?1, -25000, 'Dinner', '2026-10-03'),
                        (?1, 4000, 'Refund', '2026-10-05'),
                        (?2, -12000, 'Market', '2026-10-06'),
                        (?3, 5000, 'Refund exceeds spending', '2026-10-07')",
                params![dining, groceries, shopping],
            )
            .unwrap();
        save(&mut connection, "2026-10", 500_000, vec![]).unwrap();

        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert!(view.actuals.contains(&BudgetActualDto {
            category_id: dining,
            spent_cents: 21_000,
        }));
        assert!(view.actuals.contains(&BudgetActualDto {
            category_id: groceries,
            spent_cents: 12_000,
        }));
        assert!(view.actuals.iter().all(|a| a.category_id != shopping));
    }

    #[test]
    fn actuals_exclude_income_categories() {
        let connection = migrated_connection();
        let pay = category_id(&connection, "Pay");
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (?1, -100, '2026-10-01')",
                [pay],
            )
            .unwrap();

        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert!(view.actuals.is_empty());
    }

    #[test]
    fn uncategorized_spending_ignores_uncategorized_income() {
        let connection = migrated_connection();
        connection
            .execute(
                "INSERT INTO transactions (amount_cents, date)
                 VALUES (-700, '2026-10-01'), (-300, '2026-10-02'),
                        (9000, '2026-10-03'), (-5000, '2026-09-30')",
                [],
            )
            .unwrap();

        let view = load_budget_month(&connection, "2026-10").unwrap();

        assert_eq!(view.uncategorized_spent_cents, 1000);
    }

    #[test]
    fn deletes_a_budget_and_its_allocations() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");
        save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(housing, 150_000)],
        )
        .unwrap();

        delete_budget_in_connection(&connection, "2026-10").unwrap();

        assert_eq!(
            load_budget_month(&connection, "2026-10").unwrap().budget,
            None
        );
        let allocation_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM budget_allocations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(allocation_count, 0);
    }

    #[test]
    fn deleting_a_missing_budget_is_reported() {
        let connection = migrated_connection();

        let error = delete_budget_in_connection(&connection, "2026-10").unwrap_err();

        assert!(error.to_string().contains("budget not found"));
    }

    #[test]
    fn serializes_the_camel_case_ipc_contract() {
        let mut connection = migrated_connection();
        let housing = category_id(&connection, "Housing");
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (?1, -1000, '2026-10-01')",
                [housing],
            )
            .unwrap();
        save(
            &mut connection,
            "2026-10",
            500_000,
            vec![allocation(housing, 150_000)],
        )
        .unwrap();

        let view = load_budget_month(&connection, "2026-10").unwrap();
        let value = serde_json::to_value(view).unwrap();

        assert_eq!(value["month"], "2026-10");
        assert_eq!(value["budget"]["expectedIncomeCents"], 500_000);
        assert_eq!(value["budget"]["inputMode"], "percent");
        assert_eq!(value["budget"]["allocations"][0]["categoryId"], housing);
        assert_eq!(value["budget"]["allocations"][0]["amountCents"], 150_000);
        assert!(value["template"].is_null());
        assert_eq!(value["actuals"][0]["spentCents"], 1000);
        assert_eq!(value["uncategorizedSpentCents"], 0);
    }

    #[test]
    fn deserializes_camel_case_allocations() {
        let parsed: BudgetAllocationDto =
            serde_json::from_str(r#"{"categoryId":4,"amountCents":2500}"#).unwrap();

        assert_eq!(parsed, allocation(4, 2500));
    }
}
