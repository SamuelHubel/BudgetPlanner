use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{
    commands::{
        categories::CategoryDto,
        categories::{domain_categories, list_categories_from, list_subcategories_from},
        connection,
    },
    domain::{
        summary::{
            create_financial_summary, FinancialBreakdown, FinancialSource, FinancialSummary,
        },
        FinancialTransaction, Subcategory,
    },
    error::AppError,
    state::AppState,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// A category and its amount in the API summary.
pub struct CategoryTotalDto {
    /// Category metadata.
    pub category: CategoryDto,
    /// Signed category amount in integer cents.
    pub amount_cents: i64,
    /// Parts of the total, largest first.
    pub subcategories: Vec<SubcategoryTotalDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// One share of a category total in the API summary.
pub struct SubcategoryTotalDto {
    /// Subcategory identifier, or `null` for the General share.
    pub subcategory_id: Option<i64>,
    /// User-facing subcategory name.
    pub name: String,
    /// Optional display color as a CSS hex string.
    pub color: Option<String>,
    /// Signed amount in integer cents.
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// A large categorized transaction included in the summary.
pub struct FinancialSourceDto {
    /// Source category identifier.
    pub category_id: i64,
    /// Transaction description.
    pub description: String,
    /// User-facing source category.
    pub category_name: String,
    /// Signed transaction amount in integer cents.
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// Categorized and uncategorized totals for one period.
pub struct FinancialBreakdownDto {
    /// Totals grouped by income category.
    pub income: Vec<CategoryTotalDto>,
    /// Totals grouped by expense category.
    pub expenses: Vec<CategoryTotalDto>,
    /// Largest categorized income transactions.
    pub largest_income_sources: Vec<FinancialSourceDto>,
    /// Largest categorized expense transactions.
    pub largest_expenses: Vec<FinancialSourceDto>,
    /// Net uncategorized amount in integer cents.
    pub uncategorized_cents: i64,
    /// Uncategorized income amount in integer cents.
    pub uncategorized_income_cents: i64,
    /// Uncategorized expense amount in integer cents.
    pub uncategorized_expenses_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// Monthly income and expense totals, including uncategorized activity.
pub struct MonthlyTotalDto {
    /// Month in ISO `YYYY-MM` format.
    pub month: String,
    /// Income amount in integer cents.
    pub income_cents: i64,
    /// Expense amount in integer cents.
    pub expenses_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// A monthly breakdown in the API response.
pub struct MonthlyBreakdownDto {
    /// Month in ISO `YYYY-MM` format.
    pub month: String,
    /// Category and uncategorized totals for the month.
    pub breakdown: FinancialBreakdownDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// Complete all-time and monthly financial summary response.
pub struct FinancialSummaryDto {
    /// Totals across all transactions.
    pub breakdown: FinancialBreakdownDto,
    /// Aggregate totals for each month.
    pub monthly_totals: Vec<MonthlyTotalDto>,
    /// Detailed category breakdown for each month.
    pub monthly_breakdowns: Vec<MonthlyBreakdownDto>,
}

/// Loads the all-time and monthly financial summary.
#[tauri::command(async)]
pub fn get_financial_summary(state: State<'_, AppState>) -> Result<FinancialSummaryDto, AppError> {
    let database = connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    load_financial_summary_from(connection)
}

/// Display records that domain totals are joined back to.
struct SummaryColors<'a> {
    categories: &'a HashMap<i64, CategoryDto>,
    subcategories: &'a HashMap<i64, Option<String>>,
}

fn load_financial_summary_from(connection: &Connection) -> Result<FinancialSummaryDto, AppError> {
    let category_records = list_categories_from(connection)?;
    let categories = domain_categories(&category_records)?;
    let category_colors = category_records
        .into_iter()
        .map(|category| (category.id, category))
        .collect::<HashMap<_, _>>();
    let subcategory_records = list_subcategories_from(connection)?;
    let subcategories = subcategory_records
        .iter()
        .map(|subcategory| Subcategory {
            id: subcategory.id,
            category_id: subcategory.category_id,
            name: subcategory.name.clone(),
        })
        .collect::<Vec<_>>();
    let subcategory_colors = subcategory_records
        .into_iter()
        .map(|subcategory| (subcategory.id, subcategory.color))
        .collect::<HashMap<_, _>>();
    let colors = SummaryColors {
        categories: &category_colors,
        subcategories: &subcategory_colors,
    };
    let transactions = load_grouped_transactions(connection)?;
    let summary = create_financial_summary(&categories, &subcategories, &transactions)?;
    validate_summary_cents(&summary)?;

    Ok(FinancialSummaryDto {
        breakdown: to_breakdown(summary.breakdown, &colors),
        monthly_totals: summary
            .monthly_totals
            .into_iter()
            .map(|total| MonthlyTotalDto {
                month: total.month,
                income_cents: total.income_cents,
                expenses_cents: total.expenses_cents,
            })
            .collect(),
        monthly_breakdowns: summary
            .monthly_breakdowns
            .into_iter()
            .map(|monthly| MonthlyBreakdownDto {
                month: monthly.month,
                breakdown: to_breakdown(monthly.breakdown, &colors),
            })
            .collect(),
    })
}

fn validate_summary_cents(summary: &FinancialSummary) -> Result<(), AppError> {
    validate_breakdown_cents(&summary.breakdown)?;
    for total in &summary.monthly_totals {
        super::validate_safe_cents(total.income_cents)?;
        super::validate_safe_cents(total.expenses_cents)?;
    }
    for monthly in &summary.monthly_breakdowns {
        validate_breakdown_cents(&monthly.breakdown)?;
    }
    Ok(())
}

fn validate_breakdown_cents(breakdown: &FinancialBreakdown) -> Result<(), AppError> {
    for total in breakdown.income.iter().chain(&breakdown.expenses) {
        super::validate_safe_cents(total.amount_cents)?;
        for share in &total.subcategories {
            super::validate_safe_cents(share.amount_cents)?;
        }
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
        "SELECT substr(date, 1, 7) || '-01', category_id, subcategory_id, SUM(amount_cents),
                MAX(description)
         FROM transactions
         GROUP BY substr(date, 1, 7), category_id, subcategory_id, description COLLATE NOCASE
         , CASE WHEN category_id IS NULL THEN amount_cents > 0 ELSE 0 END
         ORDER BY substr(date, 1, 7), category_id, description COLLATE NOCASE",
    )?;
    let rows = statement
        .query_map([], |row| {
            let month_start: String = row.get(0)?;
            let category_id: Option<i64> = row.get(1)?;
            let subcategory_id: Option<i64> = row.get(2)?;
            let amount_cents: i64 = row.get(3)?;
            let description: Option<String> = row.get(4)?;
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
                subcategory_id,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn to_breakdown(
    breakdown: FinancialBreakdown,
    colors: &SummaryColors<'_>,
) -> FinancialBreakdownDto {
    let convert_totals = |totals: Vec<crate::domain::summary::CategoryTotal>| {
        totals
            .into_iter()
            .filter_map(|total| {
                let subcategories = total
                    .subcategories
                    .into_iter()
                    .map(|share| SubcategoryTotalDto {
                        color: share
                            .subcategory_id
                            .and_then(|id| colors.subcategories.get(&id).cloned())
                            .flatten(),
                        subcategory_id: share.subcategory_id,
                        name: share.name,
                        amount_cents: share.amount_cents,
                    })
                    .collect();
                colors
                    .categories
                    .get(&total.category.id)
                    .map(|category| CategoryTotalDto {
                        category: category.clone(),
                        amount_cents: total.amount_cents,
                        subcategories,
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
    use super::load_financial_summary_from;
    use crate::db::migrated_connection;

    #[test]
    fn summarizes_grouped_records_and_serializes_the_ipc_contract() {
        let connection = migrated_connection();
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
        let summary = load_financial_summary_from(&connection).unwrap();
        assert_eq!(summary.breakdown.uncategorized_cents, -800);
        assert_eq!(summary.breakdown.expenses[0].amount_cents, 5500);
        assert_eq!(summary.breakdown.largest_expenses[0].category_id, 2);
        assert_eq!(summary.breakdown.uncategorized_expenses_cents, 1000);
        assert_eq!(summary.breakdown.uncategorized_income_cents, 200);
        assert_eq!(summary.monthly_totals[0].income_cents, 200);
        assert_eq!(summary.monthly_totals[0].expenses_cents, 6500);

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
    fn serializes_subcategory_shares_including_general() {
        let connection = migrated_connection();
        connection
            .execute_batch(
                "INSERT INTO transactions (category_id, subcategory_id, amount_cents, date)
                 SELECT category_id, id, -300, '2026-01-01'
                 FROM subcategories WHERE name = 'Coffee';
                 INSERT INTO transactions (category_id, amount_cents, date)
                 SELECT category_id, -100, '2026-01-02'
                 FROM subcategories WHERE name = 'Coffee';",
            )
            .unwrap();

        let summary = load_financial_summary_from(&connection).unwrap();
        let value = serde_json::to_value(summary).unwrap();
        let shares = &value["breakdown"]["expenses"][0]["subcategories"];

        assert_eq!(value["breakdown"]["expenses"][0]["amountCents"], 400);
        assert_eq!(shares[0]["name"], "Coffee");
        assert_eq!(shares[0]["amountCents"], 300);
        assert!(shares[0]["subcategoryId"].is_number());
        assert_eq!(shares[1]["name"], "General");
        assert!(shares[1]["subcategoryId"].is_null());
    }

    #[test]
    fn rejects_totals_that_the_webview_cannot_represent_exactly() {
        let connection = migrated_connection();
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (2, 9007199254740992, '2026-01-01')",
                [],
            )
            .unwrap();

        let error = load_financial_summary_from(&connection).unwrap_err();

        assert!(error.to_string().contains("safe integer range"));
    }
}
