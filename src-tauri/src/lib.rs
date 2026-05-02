mod commands;

use tauri::generate_handler;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(generate_handler![
            commands::download::download_mod,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::stop_download,
            commands::download::is_mod_downloaded,
            commands::download::launch_mod
        ])
        .run(tauri::generate_context!())
        .expect("error while running app");
}
