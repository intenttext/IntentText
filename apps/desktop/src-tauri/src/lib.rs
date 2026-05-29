pub mod commands;

use tauri::Emitter;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Handle file association — open file passed as CLI arg
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = &args[1];
                if file_path.ends_with(".it") {
                    if let Some(window) = app.get_webview_window("main") {
                        let path = file_path.to_string();
                        // Emit after window is ready
                        let window_clone = window.clone();
                        std::thread::spawn(move || {
                            // Small delay to ensure frontend is ready
                            std::thread::sleep(std::time::Duration::from_millis(500));
                            let _ = window_clone.emit("open-file", path);
                        });
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_files,
            commands::fs::file_metadata,
            commands::fs::delete_file,
            commands::fs::rename_file,
            commands::workspace::open_folder,
            commands::workspace::watch_folder,
            commands::workspace::unwatch_folder,
            commands::vault::app_startup,
            commands::vault::register_vault_cmd,
            commands::vault::open_vault_cmd,
            commands::vault::vault_info_cmd,
            commands::vault::search_vault_cmd,
            commands::vault::search_vault_folder_cmd,
            commands::index::build_index,
            commands::index::build_index_recursive,
            commands::index::read_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
