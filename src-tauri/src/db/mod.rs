use rusqlite::{Connection, TransactionBehavior};

use crate::error::AppError;

const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../../migrations/0001_initial_schema.sql")),
    (2, include_str!("../../migrations/0002_seed_categories.sql")),
    (
        3,
        include_str!("../../migrations/0003_seed_keyword_rules.sql"),
    ),
    (
        4,
        include_str!("../../migrations/0004_currency_setting.sql"),
    ),
];

pub fn run_migrations(connection: &mut Connection) -> Result<(), AppError> {
    let mut current_version: i64 =
        connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if current_version == 0 {
        let has_existing_tables: bool = connection.query_row(
            "SELECT EXISTS(
               SELECT 1 FROM sqlite_master
               WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
             )",
            [],
            |row| row.get(0),
        )?;
        if has_existing_tables {
            return Err(AppError::InvalidInput(
                "database contains an existing schema without Rust migration tracking; migrate or reset it before continuing"
                    .to_owned(),
            ));
        }
    }
    if current_version > MIGRATIONS.last().map_or(0, |(version, _)| *version) {
        return Err(AppError::InvalidInput(format!(
            "database schema version {current_version} is newer than this app supports"
        )));
    }

    for (version, sql) in MIGRATIONS {
        if *version <= current_version {
            continue;
        }
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        transaction.execute_batch(sql)?;
        transaction.pragma_update(None, "user_version", version)?;
        transaction.commit()?;
        current_version = *version;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::run_migrations;

    #[test]
    fn runs_migrations_in_order_and_is_idempotent() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();

        run_migrations(&mut connection).unwrap();
        run_migrations(&mut connection).unwrap();

        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        let category_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))
            .unwrap();
        let rule_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM keyword_category_map", [], |row| {
                row.get(0)
            })
            .unwrap();
        let has_app_lock: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_lock'
                 )",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let mut tables_statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .unwrap();
        let tables = tables_statement
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(version, 4);
        assert_eq!(category_count, 11);
        assert!(rule_count > 0);
        assert!(!has_app_lock);
        for expected in [
            "categories",
            "import_batches",
            "transactions",
            "goals",
            "keyword_category_map",
            "ai_insights_log",
            "settings",
        ] {
            assert!(tables.iter().any(|table| table == expected));
        }
        let currency: String = connection
            .query_row(
                "SELECT setting_value FROM settings WHERE setting_key = 'currency'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(currency, "USD");
    }

    #[test]
    fn failed_migration_does_not_advance_user_version() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("CREATE TABLE existing (id INTEGER);")
            .unwrap();
        connection.pragma_update(None, "user_version", 1).unwrap();

        assert!(run_migrations(&mut connection).is_err());
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
    }

    #[test]
    fn refuses_to_apply_initial_schema_over_an_untracked_database() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("CREATE TABLE legacy_transactions (id INTEGER);")
            .unwrap();

        let error = run_migrations(&mut connection).unwrap_err();

        assert!(error.to_string().contains("existing schema"));
        let table_exists: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'categories'
                 )",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!table_exists);
    }

    #[test]
    fn migrated_schema_enforces_money_dates_uniqueness_and_delete_rules() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        run_migrations(&mut connection).unwrap();

        assert!(connection
            .execute(
                "INSERT INTO categories (name, type) VALUES ('housing', 'expense')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO categories (name, type) VALUES ('Invalid', 'saving')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO categories (name, type, color) VALUES ('Invalid color', 'expense', 'blue')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO import_batches (file_name, imported_at, transaction_count)
                 VALUES ('bad.csv', '2026-01-01', -1)",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO transactions (amount_cents, date) VALUES (1.5, '2026-01-01')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO transactions (amount_cents, date) VALUES (1, '2026-1-01')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (999, 1, '2026-01-01')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO transactions (amount_cents, date, source) VALUES (1, '2026-01-01', 'imported')",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO transactions (amount_cents, date, source, import_batch_id)
                 VALUES (1, '2026-01-01', 'manual', 1)",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO keyword_category_map (keyword, category_id) VALUES ('  ', 1)",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO keyword_category_map (keyword, category_id) VALUES ('MORTGAGE', 1)",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO goals (title, target_amount_cents) VALUES ('Fractional goal', 1.5)",
                [],
            )
            .is_err());

        let category_id: i64 = connection
            .query_row(
                "SELECT id FROM categories WHERE name = 'Housing'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date, dedupe_hash)
                 VALUES (?1, -100, '2026-01-01', 'unique-hash')",
                [category_id],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO goals (title, target_amount_cents, category_id)
                 VALUES ('Emergency fund', 100000, ?1)",
                [category_id],
            )
            .unwrap();
        assert!(connection
            .execute(
                "INSERT INTO transactions (amount_cents, date, dedupe_hash)
                 VALUES (100, '2026-01-02', 'unique-hash')",
                [],
            )
            .is_err());
        connection
            .execute("DELETE FROM categories WHERE id = ?1", [category_id])
            .unwrap();
        let assigned_category: Option<i64> = connection
            .query_row(
                "SELECT category_id FROM transactions WHERE dedupe_hash = 'unique-hash'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(assigned_category, None);
        let goal_category: Option<i64> = connection
            .query_row(
                "SELECT category_id FROM goals WHERE title = 'Emergency fund'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(goal_category, None);

        connection
            .execute(
                "INSERT INTO import_batches (file_name, imported_at, transaction_count)
                 VALUES ('batch.csv', '2026-01-01T00:00:00Z', 1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO transactions (amount_cents, date, source, import_batch_id)
                 VALUES (100, '2026-01-01', 'imported', 1)",
                [],
            )
            .unwrap();
        connection
            .execute("DELETE FROM import_batches WHERE id = 1", [])
            .unwrap();
        let remaining: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE source = 'imported'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 0);
    }
}
