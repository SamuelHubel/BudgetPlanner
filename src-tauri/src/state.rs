use std::sync::Mutex;

use rusqlite::Connection;

#[derive(Default)]
pub struct AppState {
    pub db: Mutex<Option<Connection>>,
}
