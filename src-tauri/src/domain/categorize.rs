use std::collections::HashMap;

use regex::RegexSetBuilder;

use super::{Category, ImportError, ImportedTransaction, KeywordCategory, Subcategory};

/// Compiled size allowance for the keyword set. Each whole-word pattern carries
/// Unicode character classes, so the seeded library exceeds the default limit.
const KEYWORD_SET_SIZE_LIMIT: usize = 256 * 1024 * 1024;

/// Assigns categories through the fixed chain of statement label, then keyword
/// rules, leaving anything else uncategorized for the user to choose.
///
/// A label that names only a main category may still gain a subcategory from a
/// keyword rule under that same category.
pub fn categorize_transactions(
    transactions: &[ImportedTransaction],
    categories: &[Category],
    subcategories: &[Subcategory],
    keyword_categories: &[KeywordCategory],
) -> Result<Vec<ImportedTransaction>, ImportError> {
    let categories_by_id = categories
        .iter()
        .map(|category| (category.id, category))
        .collect::<HashMap<_, _>>();
    let categories_by_name = categories
        .iter()
        .map(|category| (normalize_category_name(&category.name), category))
        .collect::<HashMap<_, _>>();
    let subcategories_by_name = unique_subcategories_by_name(subcategories, &categories_by_id);

    let rules = keyword_categories
        .iter()
        .filter(|rule| !rule.keyword.trim().is_empty())
        .filter(|rule| categories_by_id.contains_key(&rule.category_id))
        .collect::<Vec<_>>();
    let keyword_set = RegexSetBuilder::new(rules.iter().map(|rule| {
        format!(
            r"(?:^|[^a-z0-9]){}(?:$|[^a-z0-9])",
            regex::escape(rule.keyword.trim())
        )
    }))
    .case_insensitive(true)
    .size_limit(KEYWORD_SET_SIZE_LIMIT)
    .build()
    .map_err(|error| ImportError::InvalidKeywordRule(error.to_string()))?;

    let categorized = transactions
        .iter()
        .map(|transaction| {
            let mut categorized = transaction.clone();
            categorized.category_id = None;
            categorized.subcategory_id = None;

            let label = transaction
                .category_name
                .as_deref()
                .map(normalize_category_name);
            // The class in the pattern is lowercase-only, so match on lowercase.
            let matches = keyword_set.matches(&transaction.description.to_lowercase());
            let matched_rules = matches.iter().map(|index| rules[index]);

            if let Some(category) = label.as_ref().and_then(|name| categories_by_name.get(name)) {
                categorized.category_id = Some(category.id);
                categorized.category_name = Some(category.name.clone());
                categorized.subcategory_id = longest_rule(matched_rules.filter(|rule| {
                    rule.category_id == category.id && rule.subcategory_id.is_some()
                }))
                .and_then(|rule| rule.subcategory_id);
            } else if let Some(subcategory) = label
                .as_ref()
                .and_then(|name| subcategories_by_name.get(name))
                .copied()
                .flatten()
            {
                categorized.category_id = Some(subcategory.category_id);
                categorized.subcategory_id = Some(subcategory.id);
                categorized.category_name = categories_by_id
                    .get(&subcategory.category_id)
                    .map(|category| category.name.clone());
            } else if let Some(rule) = longest_rule(matched_rules) {
                categorized.category_id = Some(rule.category_id);
                categorized.subcategory_id = rule.subcategory_id;
                categorized.category_name = categories_by_id
                    .get(&rule.category_id)
                    .map(|category| category.name.clone());
            }
            categorized
        })
        .collect();
    Ok(categorized)
}

/// Maps normalized names to subcategories, with `None` for a name shared by
/// several categories, because such a label cannot pick a parent.
fn unique_subcategories_by_name<'a>(
    subcategories: &'a [Subcategory],
    categories_by_id: &HashMap<i64, &Category>,
) -> HashMap<String, Option<&'a Subcategory>> {
    let mut by_name = HashMap::new();
    for subcategory in subcategories
        .iter()
        .filter(|subcategory| categories_by_id.contains_key(&subcategory.category_id))
    {
        by_name
            .entry(normalize_category_name(&subcategory.name))
            .and_modify(|entry| *entry = None)
            .or_insert(Some(subcategory));
    }
    by_name
}

fn longest_rule<'a>(
    rules: impl Iterator<Item = &'a KeywordCategory>,
) -> Option<&'a KeywordCategory> {
    rules.max_by_key(|rule| rule.keyword.chars().count())
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
                subcategory_id: None,
            },
            KeywordCategory {
                keyword: "uber eats".into(),
                category_id: 2,
                subcategory_id: None,
            },
            KeywordCategory {
                keyword: "netflix".into(),
                category_id: 3,
                subcategory_id: None,
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
                subcategory_id: None,
            },
            ImportedTransaction {
                date,
                description: "Netflix monthly subscription".into(),
                amount_cents: -1_500,
                category_name: None,
                category_id: None,
                subcategory_id: None,
            },
            ImportedTransaction {
                date,
                description: "UBER EATS*ORDER".into(),
                amount_cents: -800,
                category_name: Some("Unrecognized".into()),
                category_id: None,
                subcategory_id: None,
            },
            ImportedTransaction {
                date,
                description: "Superuber payment".into(),
                amount_cents: -800,
                category_name: None,
                category_id: None,
                subcategory_id: None,
            },
        ];

        let categorized = categorize_transactions(&transactions, &categories, &[], &rules).unwrap();
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

    fn category(id: i64, name: &str) -> Category {
        Category {
            id,
            name: name.into(),
            category_type: CategoryType::Expense,
        }
    }

    fn subcategory(id: i64, category_id: i64, name: &str) -> Subcategory {
        Subcategory {
            id,
            category_id,
            name: name.into(),
        }
    }

    fn rule(keyword: &str, category_id: i64, subcategory_id: Option<i64>) -> KeywordCategory {
        KeywordCategory {
            keyword: keyword.into(),
            category_id,
            subcategory_id,
        }
    }

    fn row(description: &str, label: Option<&str>) -> ImportedTransaction {
        ImportedTransaction {
            date: NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
            description: description.into(),
            amount_cents: -500,
            category_name: label.map(str::to_owned),
            category_id: None,
            subcategory_id: None,
        }
    }

    fn ids(
        rows: &[ImportedTransaction],
        subcategories: &[Subcategory],
        rules: &[KeywordCategory],
    ) -> Vec<(Option<i64>, Option<i64>)> {
        let categories = [category(1, "Dining Out"), category(2, "Transportation")];
        categorize_transactions(rows, &categories, subcategories, rules)
            .unwrap()
            .iter()
            .map(|transaction| (transaction.category_id, transaction.subcategory_id))
            .collect()
    }

    #[test]
    fn a_keyword_sets_both_the_category_and_subcategory() {
        let result = ids(
            &[row("STARBUCKS 123", None)],
            &[subcategory(10, 1, "Coffee")],
            &[rule("starbucks", 1, Some(10))],
        );
        assert_eq!(result, [(Some(1), Some(10))]);
    }

    #[test]
    fn a_csv_subcategory_label_sets_its_parent_too() {
        let result = ids(
            &[row("Unknown shop", Some(" coffee "))],
            &[subcategory(10, 1, "Coffee")],
            &[],
        );
        assert_eq!(result, [(Some(1), Some(10))]);
    }

    #[test]
    fn a_csv_main_label_is_refined_by_a_keyword_under_the_same_category() {
        let result = ids(
            &[row("STARBUCKS 123", Some("Dining Out"))],
            &[subcategory(10, 1, "Coffee")],
            &[rule("starbucks", 1, Some(10))],
        );
        assert_eq!(result, [(Some(1), Some(10))]);
    }

    #[test]
    fn a_keyword_from_another_category_never_refines_a_csv_label() {
        let result = ids(
            &[row("UBER trip", Some("Dining Out"))],
            &[subcategory(20, 2, "Rideshare")],
            &[rule("uber", 2, Some(20))],
        );
        assert_eq!(result, [(Some(1), None)]);
    }

    #[test]
    fn an_ambiguous_subcategory_label_falls_through_to_keywords() {
        let result = ids(
            &[row("UBER trip", Some("Misc"))],
            &[
                subcategory(10, 1, "Misc"),
                subcategory(20, 2, "Misc"),
                subcategory(21, 2, "Rideshare"),
            ],
            &[rule("uber", 2, Some(21))],
        );
        assert_eq!(result, [(Some(2), Some(21))]);
    }

    #[test]
    fn an_unmatched_row_stays_uncategorized_and_keeps_its_statement_label() {
        let categories = [category(1, "Dining Out")];
        let result =
            categorize_transactions(&[row("Mystery", Some("Weird"))], &categories, &[], &[])
                .unwrap();
        assert_eq!(result[0].category_id, None);
        assert_eq!(result[0].subcategory_id, None);
        assert_eq!(result[0].category_name.as_deref(), Some("Weird"));
    }
}
