use regex::Regex;

use super::{Category, ImportError, ImportedTransaction, KeywordCategory};

/// Assigns categories to parsed transactions using matching rules.
pub fn categorize_transactions(
    transactions: &[ImportedTransaction],
    categories: &[Category],
    keyword_categories: &[KeywordCategory],
) -> Result<Vec<ImportedTransaction>, ImportError> {
    let categories_by_id = categories
        .iter()
        .map(|category| (category.id, category))
        .collect::<std::collections::HashMap<_, _>>();
    let keyword_matchers = keyword_categories
        .iter()
        .filter(|rule| !rule.keyword.trim().is_empty())
        .filter_map(|rule| {
            categories_by_id
                .get(&rule.category_id)
                .map(|category| (rule, category))
        })
        .map(|(rule, category)| {
            let matcher = Regex::new(&format!(
                r"(?i)(?:^|[^a-z0-9]){}(?:$|[^a-z0-9])",
                regex::escape(rule.keyword.trim())
            ))
            .map_err(|_| ImportError::InvalidKeywordRule(rule.keyword.clone()))?;
            Ok((
                matcher,
                rule.keyword.chars().count(),
                category.id,
                category.name.clone(),
            ))
        })
        .collect::<Result<Vec<_>, ImportError>>()?;
    let categories_by_name = categories
        .iter()
        .map(|category| (normalize_category_name(&category.name), category))
        .collect::<std::collections::HashMap<_, _>>();

    let categorized = transactions
        .iter()
        .map(|transaction| {
            let statement_category = transaction
                .category_name
                .as_deref()
                .map(normalize_category_name)
                .and_then(|name| categories_by_name.get(&name).copied());
            if let Some(category) = statement_category {
                let mut categorized = transaction.clone();
                categorized.category_id = Some(category.id);
                categorized.category_name = Some(category.name.clone());
                return categorized;
            }

            let description = transaction.description.to_lowercase();
            let best_match = keyword_matchers
                .iter()
                .filter(|(matcher, _, _, _)| matcher.is_match(&description))
                .max_by_key(|(_, keyword_length, _, _)| *keyword_length);
            let mut categorized = transaction.clone();
            if let Some((_, _, category_id, category_name)) = best_match {
                categorized.category_id = Some(*category_id);
                categorized.category_name = Some(category_name.clone());
            } else {
                categorized.category_id = None;
            }
            categorized
        })
        .collect();
    Ok(categorized)
}

fn normalize_category_name(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;
    use crate::domain::{CategoryType, ImportedTransaction};

    #[test]
    fn statement_category_wins_and_longest_keyword_is_selected() {
        let categories = vec![
            Category {
                id: 1,
                name: "Transportation".into(),
                category_type: CategoryType::Expense,
            },
            Category {
                id: 2,
                name: "Dining Out".into(),
                category_type: CategoryType::Expense,
            },
            Category {
                id: 3,
                name: "Entertainment".into(),
                category_type: CategoryType::Expense,
            },
        ];
        let rules = vec![
            KeywordCategory {
                keyword: "uber".into(),
                category_id: 1,
            },
            KeywordCategory {
                keyword: "uber eats".into(),
                category_id: 2,
            },
            KeywordCategory {
                keyword: "netflix".into(),
                category_id: 3,
            },
        ];
        let date = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let transactions = vec![
            ImportedTransaction {
                date,
                description: "UBER EATS*ORDER".into(),
                amount_cents: -2_000,
                category_name: Some(" dining   out ".into()),
                category_id: None,
            },
            ImportedTransaction {
                date,
                description: "Netflix monthly subscription".into(),
                amount_cents: -1_500,
                category_name: None,
                category_id: None,
            },
            ImportedTransaction {
                date,
                description: "UBER EATS*ORDER".into(),
                amount_cents: -800,
                category_name: Some("Unrecognized".into()),
                category_id: None,
            },
            ImportedTransaction {
                date,
                description: "Superuber payment".into(),
                amount_cents: -800,
                category_name: None,
                category_id: None,
            },
        ];

        let categorized = categorize_transactions(&transactions, &categories, &rules).unwrap();
        assert_eq!(
            categorized
                .iter()
                .map(|transaction| (
                    transaction.category_id,
                    transaction.category_name.as_deref()
                ))
                .collect::<Vec<_>>(),
            [
                (Some(2), Some("Dining Out")),
                (Some(3), Some("Entertainment")),
                (Some(2), Some("Dining Out")),
                (None, None)
            ]
        );
    }
}
