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
    (5, include_str!("../../migrations/0005_budgets.sql")),
    (6, include_str!("../../migrations/0006_subcategories.sql")),
    (7, include_str!("../../migrations/0007_keyword_library.sql")),
];

/// Applies any pending numbered database migrations.
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

/// Opens an in-memory database with foreign keys on and all migrations applied.
#[cfg(test)]
pub(crate) fn migrated_connection() -> Connection {
    let mut connection = Connection::open_in_memory().unwrap();
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .unwrap();
    run_migrations(&mut connection).unwrap();
    connection
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{migrated_connection, run_migrations, MIGRATIONS};

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
        assert_eq!(version, 7);
        assert_eq!(category_count, 18);
        assert!(rule_count > 300);
        assert!(!has_app_lock);
        for expected in [
            "categories",
            "import_batches",
            "transactions",
            "goals",
            "keyword_category_map",
            "ai_insights_log",
            "settings",
            "budgets",
            "budget_allocations",
            "subcategories",
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

    fn subcategory_id(connection: &Connection, category: &str, name: &str) -> i64 {
        connection
            .query_row(
                "SELECT s.id FROM subcategories s
                 JOIN categories c ON c.id = s.category_id
                 WHERE c.name = ?1 AND s.name = ?2",
                [category, name],
                |row| row.get(0),
            )
            .unwrap()
    }

    fn category_id(connection: &Connection, name: &str) -> i64 {
        connection
            .query_row("SELECT id FROM categories WHERE name = ?1", [name], |row| {
                row.get(0)
            })
            .unwrap()
    }

    #[test]
    fn upgrading_a_version_5_database_keeps_transactions_on_their_main_category() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        for (version, sql) in MIGRATIONS.iter().filter(|(version, _)| *version <= 5) {
            connection.execute_batch(sql).unwrap();
            connection
                .pragma_update(None, "user_version", version)
                .unwrap();
        }
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 SELECT id, -500, '2026-01-01' FROM categories WHERE name = 'Groceries'",
                [],
            )
            .unwrap();

        run_migrations(&mut connection).unwrap();

        let (category, subcategory): (i64, Option<i64>) = connection
            .query_row(
                "SELECT category_id, subcategory_id FROM transactions",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(category, category_id(&connection, "Groceries"));
        assert_eq!(subcategory, None);
    }

    #[test]
    fn seeded_rules_point_at_subcategories_of_their_own_category() {
        let connection = migrated_connection();

        let mismatched: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM keyword_category_map k
                 JOIN subcategories s ON s.id = k.subcategory_id
                 WHERE s.category_id <> k.category_id",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let (category, subcategory): (i64, Option<i64>) = connection
            .query_row(
                "SELECT category_id, subcategory_id FROM keyword_category_map
                 WHERE keyword = 'starbucks'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(mismatched, 0);
        assert_eq!(category, category_id(&connection, "Dining Out"));
        assert_eq!(
            subcategory,
            Some(subcategory_id(&connection, "Dining Out", "Coffee"))
        );
    }

    #[test]
    fn every_main_category_except_other_has_subcategories() {
        let connection = migrated_connection();

        let missing = connection
            .prepare(
                "SELECT name FROM categories c
                 WHERE NOT EXISTS (SELECT 1 FROM subcategories s WHERE s.category_id = c.id)",
            )
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(missing, ["Other"]);
    }

    #[test]
    fn rejects_a_subcategory_from_another_category() {
        let connection = migrated_connection();
        let coffee = subcategory_id(&connection, "Dining Out", "Coffee");
        let housing = category_id(&connection, "Housing");

        let insert = connection.execute(
            "INSERT INTO transactions (category_id, subcategory_id, amount_cents, date)
             VALUES (?1, ?2, -100, '2026-01-01')",
            [housing, coffee],
        );
        connection
            .execute(
                "INSERT INTO transactions (category_id, amount_cents, date)
                 VALUES (?1, -100, '2026-01-01')",
                [housing],
            )
            .unwrap();
        let update = connection.execute("UPDATE transactions SET subcategory_id = ?1", [coffee]);
        let rule = connection.execute(
            "INSERT INTO keyword_category_map (keyword, category_id, subcategory_id)
             VALUES ('mismatched rule', ?1, ?2)",
            [housing, coffee],
        );

        assert!(insert.is_err());
        assert!(update.is_err());
        assert!(rule.is_err());
    }

    #[test]
    fn deleting_a_category_clears_both_ids_on_its_transactions() {
        let connection = migrated_connection();
        let dining = category_id(&connection, "Dining Out");
        let coffee = subcategory_id(&connection, "Dining Out", "Coffee");
        connection
            .execute(
                "INSERT INTO transactions (category_id, subcategory_id, amount_cents, date)
                 VALUES (?1, ?2, -100, '2026-01-01')",
                [dining, coffee],
            )
            .unwrap();

        connection
            .execute("DELETE FROM categories WHERE id = ?1", [dining])
            .unwrap();

        let ids: (Option<i64>, Option<i64>) = connection
            .query_row(
                "SELECT category_id, subcategory_id FROM transactions",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(ids, (None, None));
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
