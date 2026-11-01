use std::collections::HashMap;

use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    commands::{categories::load_domain_categories, connection},
    domain::{
        categorize::categorize_transactions,
        csv_import::{parse_bank_csv, CsvImportOptions, MAX_TRANSACTION_ROWS},
        hash::dedupe_hash,
        AmountLocaleHint, DateOrder, KeywordCategory,
    },
    error::AppError,
    state::AppState,
};

const MAX_FILE_NAME_BYTES: usize = 255;
const MAX_DESCRIPTION_BYTES: usize = 10_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// A parsed transaction with category and duplicate metadata for review.
pub struct ImportPreviewRow {
    /// Normalized ISO transaction date.
    pub date: String,
    /// Signed transaction amount in integer cents.
    pub amount_cents: i64,
    /// Transaction description.
    pub description: String,
    /// Matched or selected category identifier.
    pub category_id: Option<i64>,
    /// Category label supplied in the source statement, if any.
    pub statement_category_name: Option<String>,
    /// Whether an equivalent transaction already exists.
    pub is_duplicate: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
/// A reviewed transaction row submitted for import.
pub struct ImportRow {
    /// Normalized ISO transaction date.
    pub date: String,
    /// Signed transaction amount in integer cents.
    pub amount_cents: i64,
    /// Transaction description.
    pub description: String,
    /// Selected category identifier, or `None` for uncategorized.
    pub category_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
/// Counts inserted and duplicate rows from an import commit.
pub struct CommitImportResult {
    /// Number of newly inserted transactions.
    pub inserted: usize,
    /// Number of rows skipped as duplicates.
    pub skipped_duplicates: usize,
}

/// Parses and categorizes a CSV statement for frontend review.
#[tauri::command(async)]
pub fn preview_import(
    state: State<'_, AppState>,
    csv_text: String,
    file_name: String,
    date_order: Option<String>,
    amount_format: Option<String>,
) -> Result<Vec<ImportPreviewRow>, AppError> {
    let database = connection(&state)?;
    let connection = database.as_ref().ok_or(AppError::Locked)?;
    preview_import_from(
        connection,
        &csv_text,
        &file_name,
        date_order.as_deref(),
        amount_format.as_deref(),
    )
}

fn preview_import_from(
    connection: &rusqlite::Connection,
    csv_text: &str,
    file_name: &str,
    date_order: Option<&str>,
    amount_format: Option<&str>,
) -> Result<Vec<ImportPreviewRow>, AppError> {
    validate_file_name(file_name)?;
    let date_order = parse_date_order(date_order)?;
    let amount_locale = parse_amount_format(amount_format)?;
    let categories = load_domain_categories(connection)?;
    let rules = load_keyword_categories(connection)?;
    let parsed = parse_bank_csv(
        csv_text,
        CsvImportOptions {
            amount_locale,
            date_order,
        },
    )?;
    let categorized = categorize_transactions(&parsed, &categories, &rules)?;
    let mut occurrences = HashMap::<(String, i64, String), u32>::new();
    let mut existing_hash =
        connection.prepare("SELECT 1 FROM transactions WHERE dedupe_hash = ?1 LIMIT 1")?;
    categorized
        .into_iter()
        .map(|transaction| {
            let date = transaction.date.format("%Y-%m-%d").to_string();
            let occurrence = next_occurrence(
                &mut occurrences,
                &date,
                transaction.amount_cents,
                &transaction.description,
            );
            let hash = dedupe_hash(
                &date,
                transaction.amount_cents,
                &transaction.description,
                occurrence,
            );
            super::validate_safe_cents(transaction.amount_cents)?;
            let is_duplicate = existing_hash.exists([hash])?;
            Ok(ImportPreviewRow {
                date,
                amount_cents: transaction.amount_cents,
                description: transaction.description,
                category_id: transaction.category_id,
                statement_category_name: transaction.category_name,
                is_duplicate,
            })
        })
        .collect()
}

/// Atomically saves the reviewed rows from an import batch.
#[tauri::command(async)]
pub fn commit_import(
    state: State<'_, AppState>,
    file_name: String,
    rows: Vec<ImportRow>,
) -> Result<CommitImportResult, AppError> {
    let mut database = connection(&state)?;
    let connection = database.as_mut().ok_or(AppError::Locked)?;
    commit_import_in_connection(connection, &file_name, &rows)
}

fn commit_import_in_connection(
    connection: &mut rusqlite::Connection,
    file_name: &str,
    rows: &[ImportRow],
) -> Result<CommitImportResult, AppError> {
    validate_file_name(file_name)?;
    if rows.is_empty() {
        return Err(AppError::InvalidInput(
            "there are no transactions to import".to_owned(),
        ));
    }
    if rows.len() > MAX_TRANSACTION_ROWS {
        return Err(AppError::InvalidInput(format!(
            "import exceeds the {MAX_TRANSACTION_ROWS}-row transaction limit"
        )));
    }

    validate_rows(connection, rows)?;

    let imported_at = Utc::now().to_rfc3339();
    let transaction = connection.transaction()?;
    transaction.execute(
        "INSERT INTO import_batches (file_name, imported_at, transaction_count) VALUES (?1, ?2, 0)",
        (file_name, &imported_at),
    )?;
    let batch_id = transaction.last_insert_rowid();

    let mut occurrences = HashMap::<(String, i64, String), u32>::new();
    let mut inserted = 0;
    for row in rows {
        let occurrence = next_occurrence(
            &mut occurrences,
            &row.date,
            row.amount_cents,
            &row.description,
        );
        let hash = dedupe_hash(&row.date, row.amount_cents, &row.description, occurrence);
        inserted += transaction.execute(
            "INSERT OR IGNORE INTO transactions
             (category_id, amount_cents, description, date, source, import_batch_id, dedupe_hash)
             VALUES (?1, ?2, ?3, ?4, 'imported', ?5, ?6)",
            (
                row.category_id,
                row.amount_cents,
                row.description.trim(),
                &row.date,
                batch_id,
                hash,
            ),
        )?;
    }
    if inserted == 0 {
        // Dropping the transaction rolls back, so an all-duplicate file leaves
        // no empty batch behind.
        return Ok(CommitImportResult {
            inserted,
            skipped_duplicates: rows.len(),
        });
    }
    transaction.execute(
        "UPDATE import_batches SET transaction_count = ?1 WHERE id = ?2",
        (inserted, batch_id),
    )?;
    transaction.commit()?;

    Ok(CommitImportResult {
        inserted,
        skipped_duplicates: rows.len() - inserted,
    })
}

fn validate_file_name(file_name: &str) -> Result<(), AppError> {
    let file_name = file_name.trim();
    if file_name.is_empty() || file_name.len() > MAX_FILE_NAME_BYTES {
        return Err(AppError::InvalidInput(format!(
            "file name must be between 1 and {MAX_FILE_NAME_BYTES} bytes"
        )));
    }
    Ok(())
}

fn parse_date_order(value: Option<&str>) -> Result<DateOrder, AppError> {
    match value {
        None | Some("auto") => Ok(DateOrder::Auto),
        Some("mdy") => Ok(DateOrder::Mdy),
        Some("dmy") => Ok(DateOrder::Dmy),
        Some(_) => Err(AppError::InvalidInput(
            "date order must be auto, mdy, or dmy".to_owned(),
        )),
    }
}

fn parse_amount_format(value: Option<&str>) -> Result<Option<AmountLocaleHint>, AppError> {
    match value {
        None | Some("auto") => Ok(None),
        Some("decimalDot") => Ok(Some(AmountLocaleHint::DecimalDot)),
        Some("decimalComma") => Ok(Some(AmountLocaleHint::DecimalComma)),
        Some(_) => Err(AppError::InvalidInput(
            "amount format must be auto, decimalDot, or decimalComma".to_owned(),
        )),
    }
}

fn load_keyword_categories(
    connection: &rusqlite::Connection,
) -> Result<Vec<KeywordCategory>, AppError> {
    let mut statement =
        connection.prepare("SELECT keyword, category_id FROM keyword_category_map ORDER BY id")?;
    let categories = statement
        .query_map([], |row| {
            Ok(KeywordCategory {
                keyword: row.get(0)?,
                category_id: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(categories)
}

fn validate_rows(connection: &rusqlite::Connection, rows: &[ImportRow]) -> Result<(), AppError> {
    let mut category_exists =
        connection.prepare("SELECT 1 FROM categories WHERE id = ?1 LIMIT 1")?;
    for row in rows {
        super::validate_safe_cents(row.amount_cents)?;
        let date = NaiveDate::parse_from_str(&row.date, "%Y-%m-%d")
            .ok()
            .filter(|date| date.format("%Y-%m-%d").to_string() == row.date);
        if date.is_none() {
            return Err(AppError::InvalidInput(
                "transaction date must be a valid ISO date".to_owned(),
            ));
        }
        if row.description.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "transaction description cannot be empty".to_owned(),
            ));
        }
        if row.description.len() > MAX_DESCRIPTION_BYTES {
            return Err(AppError::InvalidInput(format!(
                "transaction description exceeds the {MAX_DESCRIPTION_BYTES}-byte limit"
            )));
        }
        if let Some(category_id) = row.category_id {
            if !category_exists.exists([category_id])? {
                return Err(AppError::InvalidInput(format!(
                    "category {category_id} does not exist"
                )));
            }
        }
    }
    Ok(())
}

fn next_occurrence(
    occurrences: &mut HashMap<(String, i64, String), u32>,
    date: &str,
    amount_cents: i64,
    description: &str,
) -> u32 {
    let key = (
        date.to_owned(),
        amount_cents,
        description
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase(),
    );
    let occurrence = occurrences.entry(key).or_default();
    let current = *occurrence;
    *occurrence = occurrence.saturating_add(1);
    current
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrated_connection as test_connection;

    #[test]
    fn validates_file_names_and_date_order() {
        assert!(validate_file_name("  ").is_err());
        assert!(validate_file_name("statement.csv").is_ok());
        assert!(parse_date_order(Some("mdy")).is_ok());
        assert!(parse_date_order(Some("unexpected")).is_err());
    }

    #[test]
    fn rejects_invalid_rows_and_empty_commits() {
        let mut connection = test_connection();
        let error = commit_import_in_connection(&mut connection, "statement.csv", &[]).unwrap_err();
        assert!(error.to_string().contains("no transactions"));

        let invalid_category = [ImportRow {
            date: "2026-01-01".into(),
            amount_cents: -500,
            description: "Coffee".into(),
            category_id: Some(i64::MAX),
        }];
        assert!(validate_rows(&connection, &invalid_category).is_err());
        let unsafe_amount = [ImportRow {
            date: "2026-01-01".into(),
            amount_cents: 9_007_199_254_740_992,
            description: "Coffee".into(),
            category_id: None,
        }];
        assert!(validate_rows(&connection, &unsafe_amount).is_err());
        let invalid_date = [ImportRow {
            date: "01/01/2026".into(),
            amount_cents: -500,
            description: "Coffee".into(),
            category_id: None,
        }];
        assert!(validate_rows(&connection, &invalid_date).is_err());
    }

    #[test]
    fn duplicate_detection_and_commit_are_idempotent() {
        let mut connection = test_connection();
        let categories = load_domain_categories(&connection).unwrap();
        let rows = vec![ImportRow {
            date: "2026-01-01".into(),
            amount_cents: -500,
            description: "Coffee".into(),
            category_id: Some(categories[0].id),
        }];

        let first = commit_import_in_connection(&mut connection, "statement.csv", &rows).unwrap();
        let second = commit_import_in_connection(&mut connection, "statement.csv", &rows).unwrap();
        assert_eq!(first.inserted, 1);
        assert_eq!(second.inserted, 0);
        assert_eq!(second.skipped_duplicates, 1);

        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let batch_counts = connection
            .prepare("SELECT transaction_count FROM import_batches ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get::<_, i64>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(batch_counts, [1]);
    }

    #[test]
    fn preview_detects_a_committed_row_using_the_same_dedupe_hash() {
        let mut connection = test_connection();
        let csv = "Date,Description,Amount\n2026-01-01,Coffee,-5.00";
        let first_preview =
            preview_import_from(&connection, csv, "statement.csv", None, None).unwrap();
        assert!(!first_preview[0].is_duplicate);
        let rows = first_preview
            .iter()
            .map(|row| ImportRow {
                date: row.date.clone(),
                amount_cents: row.amount_cents,
                description: row.description.clone(),
                category_id: row.category_id,
            })
            .collect::<Vec<_>>();
        commit_import_in_connection(&mut connection, "statement.csv", &rows).unwrap();

        let second_preview =
            preview_import_from(&connection, csv, "statement.csv", None, None).unwrap();
        assert!(second_preview[0].is_duplicate);
    }

    #[test]
    fn ambiguous_amounts_are_resolved_by_the_chosen_format() {
        let connection = test_connection();
        let csv = "Date,Description,Amount\n2026-01-15,Rent,\"1,234\"\n";

        let error = preview_import_from(&connection, csv, "statement.csv", None, None).unwrap_err();
        assert_eq!(error.code(), "ambiguousAmount");
        assert!(error.to_string().starts_with("row 2:"));

        let preview = |format| {
            preview_import_from(&connection, csv, "statement.csv", None, Some(format)).unwrap()
        };
        assert_eq!(preview("decimalDot")[0].amount_cents, 123_400);
        assert_eq!(preview("decimalComma")[0].amount_cents, 123);
    }

    #[test]
    fn rejects_an_unknown_amount_format() {
        assert!(parse_amount_format(Some("unexpected")).is_err());
        assert!(matches!(parse_amount_format(Some("auto")), Ok(None)));
    }

    #[test]
    fn preview_rejects_amounts_that_the_webview_cannot_represent_exactly() {
        let connection = test_connection();
        let csv = "Date,Description,Amount\n2026-01-01,Expensive,90071992547409.92";

        let error = preview_import_from(&connection, csv, "statement.csv", None, None).unwrap_err();

        assert!(error.to_string().contains("safe integer range"));
    }

    #[test]
    fn a_failed_import_rolls_back_its_batch_and_prior_rows() {
        let mut connection = test_connection();
        connection
            .execute_batch(
                "CREATE TRIGGER reject_selected_transaction
                 BEFORE INSERT ON transactions
                 WHEN NEW.description = 'Fail'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced test failure');
                 END;",
            )
            .unwrap();
        let rows = [
            ImportRow {
                date: "2026-01-01".into(),
                amount_cents: -500,
                description: "Okay".into(),
                category_id: None,
            },
            ImportRow {
                date: "2026-01-02".into(),
                amount_cents: -100,
                description: "Fail".into(),
                category_id: None,
            },
        ];

        assert!(commit_import_in_connection(&mut connection, "statement.csv", &rows).is_err());
        let batches: i64 = connection
            .query_row("SELECT COUNT(*) FROM import_batches", [], |row| row.get(0))
            .unwrap();
        let transactions: i64 = connection
            .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
            .unwrap();
        assert_eq!((batches, transactions), (0, 0));
    }

    #[test]
    fn duplicate_occurrences_in_one_file_get_distinct_hashes() {
        let mut occurrences = HashMap::new();
        let first = next_occurrence(&mut occurrences, "2026-01-01", -500, "Coffee");
        let second = next_occurrence(&mut occurrences, "2026-01-01", -500, " COFFEE ");
        assert_eq!((first, second), (0, 1));
    }

    #[test]
    fn import_results_serialize_with_the_typed_api_field_names() {
        let preview = serde_json::to_value(ImportPreviewRow {
            date: "2026-01-01".into(),
            amount_cents: -500,
            description: "Coffee".into(),
            category_id: Some(2),
            statement_category_name: Some("Dining Out".into()),
            is_duplicate: true,
        })
        .unwrap();
        let commit = serde_json::to_value(CommitImportResult {
            inserted: 1,
            skipped_duplicates: 2,
        })
        .unwrap();

        assert_eq!(preview["amountCents"], -500);
        assert_eq!(preview["categoryId"], 2);
        assert_eq!(preview["statementCategoryName"], "Dining Out");
        assert!(preview["isDuplicate"].as_bool().unwrap());
        assert_eq!(commit["skippedDuplicates"], 2);
        assert!(preview.get("amount_cents").is_none());
    }
}
