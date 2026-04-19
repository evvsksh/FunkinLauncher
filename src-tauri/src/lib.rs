use std::fs;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let path_resolver = app.path();
            let exe_dir = path_resolver
                .executable_dir()
                .expect("failed to get exe dir");
            let mods_dir = exe_dir.join("mods");

            if !mods_dir.exists() {
                fs::create_dir_all(&mods_dir).expect("failed to create mods directory");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
