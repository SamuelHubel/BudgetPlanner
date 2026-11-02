mod commands;
mod db;
/// Domain types and pure financial-data operations.
pub mod domain;
mod error;
mod state;

use tauri::{App, Manager, WebviewWindowBuilder};

/// Folder name for app files, used instead of the bundle identifier so the
/// folders users see on disk stay readable.
pub(crate) const APP_DIRECTORY_NAME: &str = "BudgetPlanner";

/// Creates the configured windows, keeping webview files in the app's folder.
///
/// Tauri would otherwise name this folder after the bundle identifier. Windows
/// are marked `create: false` in `tauri.conf.json` so they are only built here.
fn create_windows(app: &App) -> tauri::Result<()> {
    let webview_directory = app.path().local_data_dir()?.join(APP_DIRECTORY_NAME);
    for window in &app.config().app.windows {
        WebviewWindowBuilder::from_config(app.handle(), window)?
            .data_directory(webview_directory.clone())
            .build()?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Configures and starts the Budget Planner Tauri application.
pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::default())
        .setup(|app| Ok(create_windows(app)?))
        .invoke_handler(tauri::generate_handler![
            commands::auth::is_initialized,
            commands::auth::create_password,
            commands::auth::unlock,
            commands::auth::lock,
            commands::auth::reset_vault,
            commands::budget::get_budget,
            commands::budget::save_budget,
            commands::budget::delete_budget,
            commands::categories::list_categories,
            commands::categories::list_subcategories,
            commands::goals::list_goals,
            commands::goals::create_goal,
            commands::goals::update_goal,
            commands::goals::delete_goal,
            commands::import::preview_import,
            commands::import::commit_import,
            commands::summary::get_financial_summary,
            commands::settings::get_currency,
            commands::settings::get_category_settings,
            commands::settings::update_category_settings,
            commands::maintenance::reset_financial_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
