use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // SQLCipher support is enabled at compile time using libsqlite3-sys bundled SQLCipher.
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/0001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_categories",
            sql: include_str!("../migrations/0002_seed_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "seed_keyword_rules",
            sql: include_str!("../migrations/0003_seed_keyword_rules.sql"),
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
