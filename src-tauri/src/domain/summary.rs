use std::collections::HashMap;

use super::{Category, CategoryType, FinancialTransaction, ImportError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CategoryTotal {
    pub category: Category,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialSource {
    pub description: String,
    pub category_name: String,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonthlyTotal {
    pub month: String,
    pub income_cents: i64,
    pub expenses_cents: i64,
    pub uncategorized_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct FinancialBreakdown {
    pub income: Vec<CategoryTotal>,
    pub expenses: Vec<CategoryTotal>,
    pub largest_income_sources: Vec<FinancialSource>,
    pub largest_expenses: Vec<FinancialSource>,
    pub uncategorized_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonthlyBreakdown {
    pub month: String,
    pub breakdown: FinancialBreakdown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialSummary {
    pub breakdown: FinancialBreakdown,
    pub monthly_totals: Vec<MonthlyTotal>,
    pub monthly_breakdowns: Vec<MonthlyBreakdown>,
}

pub fn create_financial_summary(
    categories: &[Category],
    transactions: &[FinancialTransaction],
) -> Result<FinancialSummary, ImportError> {
    let category_by_id = categories
        .iter()
        .map(|category| (category.id, category))
        .collect::<HashMap<_, _>>();
    let mut all_time = Vec::new();
    let mut by_month = std::collections::BTreeMap::<String, Vec<FinancialTransaction>>::new();

    for transaction in transactions {
        let month = transaction.date.format("%Y-%m").to_string();
        by_month.entry(month).or_default().push(transaction.clone());
        all_time.push(transaction.clone());
    }

    let breakdown = create_breakdown(categories, &category_by_id, &all_time)?;
    let mut monthly_totals = Vec::with_capacity(by_month.len());
    let mut monthly_breakdowns = Vec::with_capacity(by_month.len());
    for (month, month_transactions) in by_month {
        let month_breakdown = create_breakdown(categories, &category_by_id, &month_transactions)?;
        let mut totals = MonthlyTotal {
            month: month.clone(),
            income_cents: 0,
            expenses_cents: 0,
            uncategorized_cents: month_breakdown.uncategorized_cents,
        };
        for total in &month_breakdown.income {
            totals.income_cents = checked_sum(totals.income_cents, total.amount_cents)?;
        }
        for total in &month_breakdown.expenses {
            totals.expenses_cents = checked_sum(totals.expenses_cents, total.amount_cents)?;
        }
        monthly_totals.push(totals);
        monthly_breakdowns.push(MonthlyBreakdown {
            month,
            breakdown: month_breakdown,
        });
    }

    Ok(FinancialSummary {
        breakdown,
        monthly_totals,
        monthly_breakdowns,
    })
}

fn create_breakdown(
    categories: &[Category],
    category_by_id: &HashMap<i64, &Category>,
    transactions: &[FinancialTransaction],
) -> Result<FinancialBreakdown, ImportError> {
    let mut category_totals = HashMap::<i64, i64>::new();
    let mut income_sources = HashMap::<(i64, String), FinancialSource>::new();
    let mut expense_sources = HashMap::<(i64, String), FinancialSource>::new();
    let mut uncategorized_cents = 0_i64;

    for transaction in transactions {
        let Some(category_id) = transaction.category_id else {
            uncategorized_cents = checked_sum(uncategorized_cents, transaction.amount_cents)?;
            continue;
        };
        let Some(category) = category_by_id.get(&category_id) else {
            continue;
        };
        let contribution = match category.category_type {
            CategoryType::Income => transaction.amount_cents,
            CategoryType::Expense => transaction
                .amount_cents
                .checked_neg()
                .ok_or(ImportError::NumericOverflow)?,
        };
        if contribution == 0 {
            continue;
        }
        let total = category_totals.entry(category.id).or_default();
        *total = checked_sum(*total, contribution)?;

        let Some(description) = transaction
            .description
            .as_deref()
            .map(str::trim)
            .filter(|description| !description.is_empty())
        else {
            continue;
        };
        let sources = match category.category_type {
            CategoryType::Income => &mut income_sources,
            CategoryType::Expense => &mut expense_sources,
        };
        let key = (category.id, description.to_lowercase());
        if let Some(source) = sources.get_mut(&key) {
            source.amount_cents = checked_sum(source.amount_cents, contribution)?;
        } else {
            sources.insert(
                key,
                FinancialSource {
                    description: description.to_owned(),
                    category_name: category.name.clone(),
                    amount_cents: contribution,
                },
            );
        }
    }

    let category_totals_for = |category_type| {
        categories
            .iter()
            .filter(|category| category.category_type == category_type)
            .filter_map(|category| {
                category_totals
                    .get(&category.id)
                    .map(|amount_cents| CategoryTotal {
                        category: category.clone(),
                        amount_cents: *amount_cents,
                    })
            })
            .collect::<Vec<_>>()
    };

    Ok(FinancialBreakdown {
        income: category_totals_for(CategoryType::Income),
        expenses: category_totals_for(CategoryType::Expense),
        largest_income_sources: largest_sources(income_sources),
        largest_expenses: largest_sources(expense_sources),
        uncategorized_cents,
    })
}

fn largest_sources(sources: HashMap<(i64, String), FinancialSource>) -> Vec<FinancialSource> {
    let mut sources = sources.into_values().collect::<Vec<_>>();
    sources.sort_by(|first, second| {
        second
            .amount_cents
            .cmp(&first.amount_cents)
            .then_with(|| first.description.cmp(&second.description))
    });
    sources.truncate(5);
    sources
}

fn checked_sum(first: i64, second: i64) -> Result<i64, ImportError> {
    first
        .checked_add(second)
        .ok_or(ImportError::NumericOverflow)
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;

    fn categories() -> Vec<Category> {
        vec![
            Category {
                id: 1,
                name: "Pay".into(),
                category_type: CategoryType::Income,
            },
            Category {
                id: 2,
                name: "Groceries".into(),
                category_type: CategoryType::Expense,
            },
            Category {
                id: 3,
                name: "Housing".into(),
                category_type: CategoryType::Expense,
            },
        ]
    }

    fn transaction(
        date: &str,
        category_id: Option<i64>,
        amount_cents: i64,
        description: &str,
    ) -> FinancialTransaction {
        FinancialTransaction {
            date: NaiveDate::parse_from_str(date, "%Y-%m-%d").unwrap(),
            amount_cents,
            description: Some(description.to_owned()),
            category_id,
        }
    }

    #[test]
    fn aggregates_signed_income_expenses_refunds_and_sources() {
        let summary = create_financial_summary(
            &categories(),
            &[
                transaction("2026-01-01", Some(1), 250_000, "Acme Payroll"),
                transaction("2026-01-02", Some(1), 250_000, "ACME PAYROLL"),
                transaction("2026-01-03", Some(2), -7_500, "Market"),
                transaction("2026-01-04", Some(2), -4_000, "Market"),
                transaction("2026-01-05", Some(2), 2_000, "Refund"),
                transaction("2026-01-06", Some(3), -90_000, "Rent"),
            ],
        )
        .unwrap();
        assert_eq!(
            summary
                .breakdown
                .income
                .iter()
                .map(|total| (&*total.category.name, total.amount_cents))
                .collect::<Vec<_>>(),
            [("Pay", 500_000)]
        );
        assert_eq!(
            summary
                .breakdown
                .expenses
                .iter()
                .map(|total| (&*total.category.name, total.amount_cents))
                .collect::<Vec<_>>(),
            [("Groceries", 9_500), ("Housing", 90_000)]
        );
        assert_eq!(
            summary.breakdown.largest_income_sources[0].amount_cents,
            500_000
        );
        assert_eq!(summary.breakdown.largest_expenses[0].description, "Rent");
        assert_eq!(summary.monthly_totals[0].expenses_cents, 99_500);
    }

    #[test]
    fn retains_uncategorized_totals_and_months_without_dropping_transactions() {
        let summary = create_financial_summary(
            &categories(),
            &[
                transaction("2026-02-01", None, -2_000, "Unknown purchase"),
                transaction("2026-03-01", Some(99), -1_000, "Deleted category"),
            ],
        )
        .unwrap();
        assert_eq!(summary.breakdown.uncategorized_cents, -2_000);
        assert_eq!(
            summary.monthly_totals,
            [
                MonthlyTotal {
                    month: "2026-02".into(),
                    income_cents: 0,
                    expenses_cents: 0,
                    uncategorized_cents: -2_000,
                },
                MonthlyTotal {
                    month: "2026-03".into(),
                    income_cents: 0,
                    expenses_cents: 0,
                    uncategorized_cents: 0,
                },
            ]
        );
        assert_eq!(summary.monthly_breakdowns.len(), 2);
    }

    #[test]
    fn rejects_overflow_in_summaries() {
        let error = create_financial_summary(
            &categories(),
            &[
                transaction("2026-01-01", Some(1), i64::MAX, "First"),
                transaction("2026-01-02", Some(1), 1, "Second"),
            ],
        )
        .unwrap_err();
        assert_eq!(error, ImportError::NumericOverflow);
    }
}
