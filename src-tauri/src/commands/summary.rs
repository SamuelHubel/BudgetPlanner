use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{
    commands::{
        categories::CategoryDto,
        categories::{list_categories_from, load_domain_categories},
        connection,
    },
    domain::{
        summary::{
            create_financial_summary, FinancialBreakdown, FinancialSource, FinancialSummary,
        },
        FinancialTransaction,
    },
    error::AppError,
    state::AppState,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotalDto {
    pub category: CategoryDto,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialSourceDto {
    pub category_id: i64,
    pub description: String,
    pub category_name: String,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialBreakdownDto {
    pub income: Vec<CategoryTotalDto>,
    pub expenses: Vec<CategoryTotalDto>,
    pub largest_income_sources: Vec<FinancialSourceDto>,
    pub largest_expenses: Vec<FinancialSourceDto>,
    pub uncategorized_cents: i64,
    pub uncategorized_income_cents: i64,
    pub uncategorized_expenses_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyTotalDto {
    pub month: String,
    pub income_cents: i64,
    pub expenses_cents: i64,
    pub uncategorized_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyBreakdownDto {
    pub month: String,
    pub breakdown: FinancialBreakdownDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialSummaryDto {
    pub breakdown: FinancialBreakdownDto,
    pub monthly_totals: Vec<MonthlyTotalDto>,
    pub monthly_breakdowns: Vec<MonthlyBreakdownDto>,
}

#[tauri::command]
pub fn get_financial_summary(state: State<'_, AppState>) -> Result<FinancialSummaryDto, AppError> {
    let database = connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    get_financial_summary_from(connection)
}

fn get_financial_summary_from(connection: &Connection) -> Result<FinancialSummaryDto, AppError> {
    let categories = load_domain_categories(connection)?;
    let category_colors = list_categories_from(connection)?
        .into_iter()
        .map(|category| (category.id, category))
        .collect::<HashMap<_, _>>();
    let transactions = load_grouped_transactions(connection)?;
    let summary = create_financial_summary(&categories, &transactions)?;
    validate_summary_cents(&summary)?;

    Ok(FinancialSummaryDto {
        breakdown: to_breakdown(summary.breakdown, &category_colors),
        monthly_totals: summary
            .monthly_totals
            .into_iter()
            .map(|total| MonthlyTotalDto {
                month: total.month,
                income_cents: total.income_cents,
                expenses_cents: total.expenses_cents,
                uncategorized_cents: total.uncategorized_cents,
            })
            .collect(),
        monthly_breakdowns: summary
            .monthly_breakdowns
            .into_iter()
            .map(|monthly| MonthlyBreakdownDto {
                month: monthly.month,
                breakdown: to_breakdown(monthly.breakdown, &category_colors),
            })
            .collect(),
    })
}

fn validate_summary_cents(summary: &FinancialSummary) -> Result<(), AppError> {
    validate_breakdown_cents(&summary.breakdown)?;
    for total in &summary.monthly_totals {
        super::validate_safe_cents(total.income_cents)?;
        super::validate_safe_cents(total.expenses_cents)?;
        super::validate_safe_cents(total.uncategorized_cents)?;
    }
    for monthly in &summary.monthly_breakdowns {
        validate_breakdown_cents(&monthly.breakdown)?;
    }
    Ok(())
}

fn validate_breakdown_cents(breakdown: &FinancialBreakdown) -> Result<(), AppError> {
    for total in breakdown.income.iter().chain(&breakdown.expenses) {
        super::validate_safe_cents(total.amount_cents)?;
    }
    for source in breakdown
        .largest_income_sources
        .iter()
        .chain(&breakdown.largest_expenses)
    {
        super::validate_safe_cents(source.amount_cents)?;
    }
    super::validate_safe_cents(breakdown.uncategorized_cents)
        .and_then(|()| super::validate_safe_cents(breakdown.uncategorized_income_cents))
        .and_then(|()| super::validate_safe_cents(breakdown.uncategorized_expenses_cents))
}

fn load_grouped_transactions(
    connection: &Connection,
) -> Result<Vec<FinancialTransaction>, AppError> {
    let mut statement = connection.prepare(
        "SELECT substr(date, 1, 7) || '-01', category_id, SUM(amount_cents), MAX(description)
         FROM transactions
         GROUP BY substr(date, 1, 7), category_id, description COLLATE NOCASE
         , CASE WHEN category_id IS NULL THEN amount_cents > 0 ELSE 0 END
         ORDER BY substr(date, 1, 7), category_id, description COLLATE NOCASE",
    )?;
    let rows = statement
        .query_map([], |row| {
            let month_start: String = row.get(0)?;
            let category_id: Option<i64> = row.get(1)?;
            let amount_cents: i64 = row.get(2)?;
            let description: Option<String> = row.get(3)?;
            let date = NaiveDate::parse_from_str(&month_start, "%Y-%m-%d").map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    month_start.len(),
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            Ok(FinancialTransaction {
                date,
                amount_cents,
                description,
                category_id,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn to_breakdown(
    breakdown: FinancialBreakdown,
    category_colors: &HashMap<i64, CategoryDto>,
) -> FinancialBreakdownDto {
    let convert_totals = |totals: Vec<crate::domain::summary::CategoryTotal>| {
        totals
            .into_iter()
            .filter_map(|total| {
                category_colors
                    .get(&total.category.id)
                    .map(|category| CategoryTotalDto {
                        category: category.clone(),
                        amount_cents: total.amount_cents,
                    })
            })
            .collect()
    };
    FinancialBreakdownDto {
        income: convert_totals(breakdown.income),
        expenses: convert_totals(breakdown.expenses),
        largest_income_sources: convert_sources(breakdown.largest_income_sources),
        largest_expenses: convert_sources(breakdown.largest_expenses),
        uncategorized_cents: breakdown.uncategorized_cents,
        uncategorized_income_cents: breakdown.uncategorized_income_cents,
        uncategorized_expenses_cents: breakdown.uncategorized_expenses_cents,
    }
}

fn convert_sources(sources: Vec<FinancialSource>) -> Vec<FinancialSourceDto> {
    sources
        .into_iter()
        .map(|source| FinancialSourceDto {
            category_id: source.category_id,
            description: source.description,
            category_name: source.category_name,
            amount_cents: source.amount_cents,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::get_financial_summary_from;
    use crate::db::run_migrations;

    #[test]
    fn summarizes_grouped_records_and_serializes_the_ipc_contract() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        run_migrations(&mut connection).unwrap();
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, description, date)
                 VALUES (2, -7500, 'Market', '2026-01-18'),
                        (2, 2000, 'Refund', '2026-01-20'),
                        (NULL, -1000, 'Unknown', '2026-01-21'),
                        (NULL, 200, 'Unknown', '2026-01-21')",
                [],
            )
            .unwrap();
        let summary = get_financial_summary_from(&connection).unwrap();
        assert_eq!(summary.breakdown.uncategorized_cents, -800);
        assert_eq!(summary.breakdown.expenses[0].amount_cents, 5500);
        assert_eq!(summary.breakdown.largest_expenses[0].category_id, 2);
        assert_eq!(summary.breakdown.uncategorized_expenses_cents, 1000);
        assert_eq!(summary.breakdown.uncategorized_income_cents, 200);
        assert_eq!(summary.monthly_totals[0].uncategorized_cents, -800);

        let value = serde_json::to_value(summary).unwrap();
        assert!(value["monthlyTotals"][0]["incomeCents"].is_number());
        assert_eq!(value["breakdown"]["uncategorizedCents"], -800);
        assert_eq!(value["breakdown"]["uncategorizedExpensesCents"], 1000);
        assert_eq!(value["breakdown"]["uncategorizedIncomeCents"], 200);
        assert_eq!(value["breakdown"]["largestExpenses"][0]["categoryId"], 2);
        assert_eq!(
            value["breakdown"]["expenses"][0]["category"]["type"],
            "expense"
        );
        assert!(value.get("monthly_totals").is_none());
    }

    #[test]
    fn rejects_totals_that_the_webview_cannot_represent_exactly() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        run_migrations(&mut connection).unwrap();
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (2, 9007199254740992, '2026-01-01')",
                [],
            )
            .unwrap();

        let error = get_financial_summary_from(&connection).unwrap_err();

        assert!(error.to_string().contains("safe integer range"));
    }
}
