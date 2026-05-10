mod commands;

use tauri_plugin_log::{Builder, Target, TargetKind};

pub fn run() {
    tauri::Builder::default()
        .plugin(
            Builder::default()
                .target(Target::new(TargetKind::Stdout))
                .target(Target::new(TargetKind::Webview))
                .target(Target::new(TargetKind::LogDir {
                    file_name: Some("funkin-launcher.log".into()),
                }))
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::download::download_mod,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::stop_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running app");
}
