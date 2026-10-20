use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // SQLCipher support is enabled at compile time using libsqlite3-sys bundled SQLCipher.
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "default_categories",
            sql: include_str!("../migrations/default_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "default_keyword_categories",
            sql: include_str!("../migrations/default_keyword_categories.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:budget.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
