use tauri::State;

use crate::{error::AppError, state::AppState};

#[tauri::command]
/// Atomically clears transactions and related financial records.
pub fn reset_financial_data(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut database = super::connection(&state)?;
    let connection = database.as_mut().ok_or(AppError::Locked)?;
    reset_in_connection(connection)
}

fn reset_in_connection(connection: &mut rusqlite::Connection) -> Result<(), AppError> {
    let transaction = connection.transaction()?;
    transaction.execute_batch(
        "DELETE FROM transactions;
         DELETE FROM goals;
         DELETE FROM budget_allocations;
         DELETE FROM budgets;
         DELETE FROM ai_insights_log;
         DELETE FROM import_batches;",
    )?;
    transaction.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::reset_in_connection;
    use crate::db::run_migrations;

    #[test]
    fn reset_is_atomic_and_clears_all_financial_records() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        run_migrations(&mut connection).unwrap();
        connection
            .execute(
                "INSERT INTO import_batches (file_name, imported_at, transaction_count)
                 VALUES ('statement.csv', '2026-01-01T00:00:00Z', 1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO transactions (amount_cents, date, source, import_batch_id)
                 VALUES (-500, '2026-01-01', 'imported', 1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO ai_insights_log (source, insight_type, response_text)
                 VALUES ('rules_engine', 'observation', 'test')",
                [],
            )
            .unwrap();
        connection
            .execute("INSERT INTO goals (title) VALUES ('Test goal')", [])
            .unwrap();
        connection
            .execute(
                "INSERT INTO budgets (month, expected_income_cents, input_mode)
                 VALUES ('2026-01', 500000, 'percent')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO budget_allocations (budget_id, category_id, amount_cents)
                 VALUES (1, 1, 150000)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "CREATE TRIGGER reject_goal_delete
                 BEFORE DELETE ON goals
                 BEGIN
                   SELECT RAISE(ABORT, 'forced test failure');
                 END;",
                [],
            )
            .unwrap();

        assert!(reset_in_connection(&mut connection).is_err());
        let transaction_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
            .unwrap();
        let batch_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM import_batches", [], |row| row.get(0))
            .unwrap();
        assert_eq!((transaction_count, batch_count), (1, 1));

        connection
            .execute_batch("DROP TRIGGER reject_goal_delete;")
            .unwrap();
        reset_in_connection(&mut connection).unwrap();
        for table in [
            "transactions",
            "goals",
            "ai_insights_log",
            "import_batches",
            "budget_allocations",
            "budgets",
        ] {
            let count: i64 = connection
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert_eq!(count, 0, "table {table} should be cleared");
        }
    }
}
