use std::sync::Mutex;

use rusqlite::Connection;

#[derive(Default)]
/// Shared application state for the active encrypted database connection.
pub struct AppState {
    /// The active encrypted connection, absent while the app is locked.
    pub db: Mutex<Option<Connection>>,
}
