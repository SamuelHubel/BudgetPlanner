mod commands;
mod db;
pub mod domain;
mod error;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::auth::is_initialized,
            commands::auth::create_password,
            commands::auth::unlock,
            commands::auth::lock,
            commands::categories::list_categories,
            commands::import::preview_import,
            commands::import::commit_import,
            commands::summary::get_financial_summary,
            commands::settings::get_currency,
            commands::maintenance::reset_financial_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
