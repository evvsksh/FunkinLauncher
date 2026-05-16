mod commands;

use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};
use tauri_plugin_fs;

pub fn run() {
    tauri::Builder::default()
        .plugin(
            LogBuilder::default()
                .target(Target::new(TargetKind::Stdout))
                .target(Target::new(TargetKind::Webview))
                .target(Target::new(TargetKind::LogDir {
                    file_name: Some("funkin-launcher.log".into()),
                }))
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::download::download_mod,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::stop_download,
            commands::extract::extract_mod,
            commands::launch::launch_mod,
            commands::mods::is_mod_downloaded
        ])
        .run(tauri::generate_context!())
        .expect("error while running app");
}