use futures_util::StreamExt;
use reqwest::Client;
use std::fs;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn download_mod(app: AppHandle, url: String, mod_id: String) -> Result<(), String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;

        let temp_dir = appdata.join("temp");
        let mods_dir = appdata.join("mods");

        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

        let client = Client::new();
        let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

        let total = res.content_length().unwrap_or(0);

        let zip_path = temp_dir.join(format!("{mod_id}.zip"));
        let mut file = File::create(&zip_path).await.map_err(|e| e.to_string())?;

        let mut stream = res.bytes_stream();
        let mut downloaded: u64 = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;

            let percent = if total > 0 {
                (downloaded as f64 / total as f64) * 100.0
            } else {
                0.0
            };

            app.emit("download-progress", (mod_id.clone(), percent))
                .map_err(|e| e.to_string())?;
        }

        file.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::download_mod]) // Note the commands:: prefix
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

