mod commands;
mod db;
/// Domain types and pure financial-data operations.
pub mod domain;
mod error;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Configures and starts the Budget Planner Tauri application.
pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::auth::is_initialized,
            commands::auth::create_password,
            commands::auth::unlock,
            commands::auth::lock,
            commands::categories::list_categories,
            commands::goals::list_goals,
            commands::goals::create_goal,
            commands::goals::update_goal,
            commands::goals::delete_goal,
            commands::import::preview_import,
            commands::import::commit_import,
            commands::summary::get_financial_summary,
            commands::settings::get_currency,
            commands::maintenance::reset_financial_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
