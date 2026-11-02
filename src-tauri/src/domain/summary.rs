use std::collections::HashMap;

use super::{Category, CategoryType, FinancialTransaction, ImportError, Subcategory};

const TOP_SOURCES_LIMIT: usize = 5;

/// Label for activity in a main category with no subcategory.
pub const GENERAL_SUBCATEGORY_NAME: &str = "General";

/// A total amount for one category.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CategoryTotal {
    /// Category represented by this total.
    pub category: Category,
    /// Signed amount in integer cents.
    pub amount_cents: i64,
    /// Parts of the total, largest first. These add up to `amount_cents`.
    pub subcategories: Vec<SubcategoryTotal>,
}

/// A share of a category total.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubcategoryTotal {
    /// Subcategory identifier, or `None` for the General share.
    pub subcategory_id: Option<i64>,
    /// User-facing subcategory name.
    pub name: String,
    /// Signed amount in integer cents.
    pub amount_cents: i64,
}

/// A large individual transaction source within a category.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialSource {
    /// Database identifier of the source category.
    pub category_id: i64,
    /// Transaction description.
    pub description: String,
    /// User-facing category name.
    pub category_name: String,
    /// Signed transaction amount in integer cents.
    pub amount_cents: i64,
}

/// Income and expense totals for a month, including uncategorized activity.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonthlyTotal {
    /// Month in ISO `YYYY-MM` format.
    pub month: String,
    /// Income amount in integer cents.
    pub income_cents: i64,
    /// Expense amount in integer cents.
    pub expenses_cents: i64,
}

/// Categorized and uncategorized activity over a period.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct FinancialBreakdown {
    /// Totals grouped by income category.
    pub income: Vec<CategoryTotal>,
    /// Totals grouped by expense category.
    pub expenses: Vec<CategoryTotal>,
    /// Largest categorized income transactions.
    pub largest_income_sources: Vec<FinancialSource>,
    /// Largest categorized expense transactions.
    pub largest_expenses: Vec<FinancialSource>,
    /// Net amount of all uncategorized transactions.
    pub uncategorized_cents: i64,
    /// Income amount of uncategorized transactions.
    pub uncategorized_income_cents: i64,
    /// Expense amount of uncategorized transactions.
    pub uncategorized_expenses_cents: i64,
}

/// A financial breakdown associated with one month.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonthlyBreakdown {
    /// Month in ISO `YYYY-MM` format.
    pub month: String,
    /// Financial values for the month.
    pub breakdown: FinancialBreakdown,
}

/// Financial totals across all time and by month.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialSummary {
    /// Financial values across all transactions.
    pub breakdown: FinancialBreakdown,
    /// Totals for each month.
    pub monthly_totals: Vec<MonthlyTotal>,
    /// Detailed category breakdown for each month.
    pub monthly_breakdowns: Vec<MonthlyBreakdown>,
}

/// Aggregates transactions into all-time and monthly financial summaries.
pub fn create_financial_summary(
    categories: &[Category],
    subcategories: &[Subcategory],
    transactions: &[FinancialTransaction],
) -> Result<FinancialSummary, ImportError> {
    let category_by_id = categories
        .iter()
        .map(|category| (category.id, category))
        .collect::<HashMap<_, _>>();
    let subcategory_by_id = subcategories
        .iter()
        .map(|subcategory| (subcategory.id, subcategory))
        .collect::<HashMap<_, _>>();
    let mut by_month = std::collections::BTreeMap::<String, Vec<FinancialTransaction>>::new();

    for transaction in transactions {
        let month = transaction.date.format("%Y-%m").to_string();
        by_month.entry(month).or_default().push(transaction.clone());
    }

    let breakdown = create_breakdown(
        categories,
        &category_by_id,
        &subcategory_by_id,
        transactions,
    )?;
    let mut monthly_totals = Vec::with_capacity(by_month.len());
    let mut monthly_breakdowns = Vec::with_capacity(by_month.len());
    for (month, month_transactions) in by_month {
        let month_breakdown = create_breakdown(
            categories,
            &category_by_id,
            &subcategory_by_id,
            &month_transactions,
        )?;
        let mut totals = MonthlyTotal {
            month: month.clone(),
            income_cents: month_breakdown.uncategorized_income_cents,
            expenses_cents: month_breakdown.uncategorized_expenses_cents,
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
    subcategory_by_id: &HashMap<i64, &Subcategory>,
    transactions: &[FinancialTransaction],
) -> Result<FinancialBreakdown, ImportError> {
    let mut category_totals = HashMap::<i64, i64>::new();
    let mut subcategory_totals = HashMap::<(i64, Option<i64>), i64>::new();
    let mut income_sources = HashMap::<(i64, String), FinancialSource>::new();
    let mut expense_sources = HashMap::<(i64, String), FinancialSource>::new();
    let mut uncategorized_cents = 0_i64;
    let mut uncategorized_income_cents = 0_i64;
    let mut uncategorized_expenses_cents = 0_i64;

    for transaction in transactions {
        let Some(category_id) = transaction.category_id else {
            uncategorized_cents = checked_sum(uncategorized_cents, transaction.amount_cents)?;
            if transaction.amount_cents > 0 {
                uncategorized_income_cents =
                    checked_sum(uncategorized_income_cents, transaction.amount_cents)?;
            } else {
                uncategorized_expenses_cents = checked_sum(
                    uncategorized_expenses_cents,
                    transaction
                        .amount_cents
                        .checked_neg()
                        .ok_or(ImportError::NumericOverflow)?,
                )?;
            }
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
        let subcategory_id = transaction
            .subcategory_id
            .filter(|id| subcategory_by_id.contains_key(id));
        let subcategory_total = subcategory_totals
            .entry((category.id, subcategory_id))
            .or_default();
        *subcategory_total = checked_sum(*subcategory_total, contribution)?;

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
                    category_id: category.id,
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
                        subcategories: subcategory_shares(
                            category.id,
                            &subcategory_totals,
                            subcategory_by_id,
                        ),
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
        uncategorized_income_cents,
        uncategorized_expenses_cents,
    })
}

fn subcategory_shares(
    category_id: i64,
    totals: &HashMap<(i64, Option<i64>), i64>,
    subcategory_by_id: &HashMap<i64, &Subcategory>,
) -> Vec<SubcategoryTotal> {
    let mut shares = totals
        .iter()
        .filter(|((category, _), amount_cents)| *category == category_id && **amount_cents != 0)
        .map(|((_, subcategory_id), amount_cents)| SubcategoryTotal {
            subcategory_id: *subcategory_id,
            name: subcategory_id
                .and_then(|id| subcategory_by_id.get(&id))
                .map_or(GENERAL_SUBCATEGORY_NAME, |subcategory| &subcategory.name)
                .to_owned(),
            amount_cents: *amount_cents,
        })
        .collect::<Vec<_>>();
    shares.sort_by(|first, second| {
        second
            .amount_cents
            .cmp(&first.amount_cents)
            .then_with(|| first.name.cmp(&second.name))
    });
    shares
}

fn largest_sources(sources: HashMap<(i64, String), FinancialSource>) -> Vec<FinancialSource> {
    let mut sources = sources.into_values().collect::<Vec<_>>();
    sources.sort_by(|first, second| {
        second
            .amount_cents
            .cmp(&first.amount_cents)
            .then_with(|| first.description.cmp(&second.description))
    });
    sources.truncate(TOP_SOURCES_LIMIT);
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
            subcategory_id: None,
        }
    }

    #[test]
    fn splits_a_category_total_into_subcategories_and_general() {
        let subcategories = [
            Subcategory {
                id: 20,
                category_id: 2,
                name: "Produce".into(),
            },
            Subcategory {
                id: 21,
                category_id: 2,
                name: "Bakery".into(),
            },
        ];
        let tagged = |subcategory_id, amount_cents, description| FinancialTransaction {
            subcategory_id: Some(subcategory_id),
            ..transaction("2026-01-01", Some(2), amount_cents, description)
        };

        let summary = create_financial_summary(
            &categories(),
            &subcategories,
            &[
                tagged(20, -3_000, "Farm stand"),
                tagged(20, 500, "Farm refund"),
                tagged(21, -4_000, "Loaf"),
                transaction("2026-01-02", Some(2), -1_000, "Old import"),
                tagged(99, -200, "Removed subcategory"),
            ],
        )
        .unwrap();

        let total = &summary.breakdown.expenses[0];
        assert_eq!(total.amount_cents, 7_700);
        assert_eq!(
            total
                .subcategories
                .iter()
                .map(|share| (share.subcategory_id, &*share.name, share.amount_cents))
                .collect::<Vec<_>>(),
            [
                (Some(21), "Bakery", 4_000),
                (Some(20), "Produce", 2_500),
                (None, GENERAL_SUBCATEGORY_NAME, 1_200),
            ]
        );
    }

    #[test]
    fn aggregates_signed_income_expenses_refunds_and_sources() {
        let summary = create_financial_summary(
            &categories(),
            &[],
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
            &[],
            &[
                transaction("2026-02-01", None, -2_000, "Unknown purchase"),
                transaction("2026-03-01", Some(99), -1_000, "Deleted category"),
            ],
        )
        .unwrap();
        assert_eq!(summary.breakdown.uncategorized_cents, -2_000);
        assert_eq!(summary.breakdown.uncategorized_income_cents, 0);
        assert_eq!(summary.breakdown.uncategorized_expenses_cents, 2_000);
        assert_eq!(
            summary.monthly_totals,
            [
                MonthlyTotal {
                    month: "2026-02".into(),
                    income_cents: 0,
                    expenses_cents: 2_000,
                },
                MonthlyTotal {
                    month: "2026-03".into(),
                    income_cents: 0,
                    expenses_cents: 0,
                },
            ]
        );
        assert_eq!(summary.monthly_breakdowns.len(), 2);
    }

    #[test]
    fn splits_uncategorized_income_and_expense_for_chart_breakdowns() {
        let summary = create_financial_summary(
            &categories(),
            &[],
            &[
                transaction("2026-02-01", None, 500, "Unknown income"),
                transaction("2026-02-01", None, -1_500, "Unknown expense"),
            ],
        )
        .unwrap();

        assert_eq!(summary.breakdown.uncategorized_cents, -1_000);
        assert_eq!(summary.breakdown.uncategorized_income_cents, 500);
        assert_eq!(summary.breakdown.uncategorized_expenses_cents, 1_500);
    }

    #[test]
    fn monthly_totals_add_uncategorized_activity_to_categorized_totals() {
        let summary = create_financial_summary(
            &categories(),
            &[],
            &[
                transaction("2026-02-01", Some(1), 100_000, "Payroll"),
                transaction("2026-02-02", None, 500, "Unknown income"),
                transaction("2026-02-03", Some(2), -7_500, "Market"),
                transaction("2026-02-04", None, -1_500, "Unknown expense"),
            ],
        )
        .unwrap();

        assert_eq!(
            summary.monthly_totals,
            [MonthlyTotal {
                month: "2026-02".into(),
                income_cents: 100_500,
                expenses_cents: 9_000,
            }]
        );
    }

    #[test]
    fn rejects_overflow_in_summaries() {
        let error = create_financial_summary(
            &categories(),
            &[],
            &[
                transaction("2026-01-01", Some(1), i64::MAX, "First"),
                transaction("2026-01-02", Some(1), 1, "Second"),
            ],
        )
        .unwrap_err();
        assert_eq!(error, ImportError::NumericOverflow);
    }
}
