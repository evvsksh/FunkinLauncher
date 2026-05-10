mod commands;
use tauri::generate_handler;
use tauri_plugin_log::{Builder, Target, TargetKind};

pub fn run() {
    tauri::Builder::default()
        .plugin(
            Builder::default()
                .target(Target::new(TargetKind::Stdout))
                .target(Target::new(tauri_plugin_log::TargetKind::Webview))
                .target(Target::new(tauri_plugin_log::TargetKind::LogDir {
                    file_name: Some("funkin-launcher.log".into()),
                }))
                .build(),
        )
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
