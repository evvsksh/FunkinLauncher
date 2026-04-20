use futures_util::StreamExt;
use reqwest::Client;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs::{self as async_fs, File};
use tokio::io::AsyncWriteExt;

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn download_mod(app: AppHandle, url: String, mod_id: String) -> Result<(), String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let temp_dir = appdata.join("temp");
        let mods_dir = appdata.join("mods").join(&mod_id);

        async_fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| e.to_string())?;
        async_fs::create_dir_all(&mods_dir)
            .await
            .map_err(|e| e.to_string())?;

        let zip_path = temp_dir.join(format!("{mod_id}.zip"));
        let client = Client::new();
        let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
        let total = res.content_length().unwrap_or(0);

        let mut file = File::create(&zip_path).await.map_err(|e| e.to_string())?;
        let mut stream = res.bytes_stream();
        let mut downloaded: u64 = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;

            let percent = if total > 0 {
                ((downloaded as f64 / total as f64) * 100.0).floor()
            } else {
                0.0
            };
            app.emit("download-progress", (mod_id.clone(), percent))
                .map_err(|e| e.to_string())?;
        }

        file.flush().await.map_err(|e| e.to_string())?;
        drop(file);

        if total > 0 && downloaded != total {
            return Err("Download interrupted: file size mismatch".to_string());
        }

        extract(zip_path, mods_dir).await?;
        Ok(())
    }

    #[tauri::command]
    pub async fn is_mod_downloaded(app: AppHandle, mod_id: String) -> Result<bool, String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let mods_dir = appdata.join("mods").join(&mod_id);
        if !mods_dir.exists() {
            return Ok(false);
        }
        let mut entries = async_fs::read_dir(&mods_dir)
            .await
            .map_err(|e| e.to_string())?;
        Ok(entries
            .next_entry()
            .await
            .map_err(|e| e.to_string())?
            .is_some())
    }

    #[tauri::command]
    pub async fn launch_mod(
        window: tauri::Window,
        app: AppHandle,
        mod_id: String,
    ) -> Result<(), String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let mod_path = appdata.join("mods").join(&mod_id);
        let mut entries = async_fs::read_dir(&mod_path)
            .await
            .map_err(|e| e.to_string())?;
        let mut exe_path = None;

        while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if path.is_file()
                && path.extension().and_then(|s| s.to_str()) == Some("exe")
                && !name.contains("crashpad")
                && !name.contains("handler")
            {
                exe_path = Some(path);
                break;
            }
        }

        if let Some(path) = exe_path {
            window.hide().map_err(|e| e.to_string())?;
            tokio::task::spawn_blocking(move || {
                let mut child = std::process::Command::new(path)
                    .current_dir(&mod_path)
                    .spawn()
                    .map_err(|e| e.to_string())?;
                child.wait().map_err(|e| e.to_string())?;
                Ok::<(), String>(())
            })
            .await
            .map_err(|e| e.to_string())??;
            window.show().map_err(|e| e.to_string())?;
            let _ = window.set_focus();
            Ok(())
        } else {
            Err("No executable found in the mod folder".to_string())
        }
    }
}

async fn extract(zip_path: PathBuf, dest_dir: PathBuf) -> Result<(), String> {
    let extension = zip_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    tokio::task::spawn_blocking(move || match extension.as_str() {
        "zip" => {
            let file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
            zip_extract::extract(file, &dest_dir, false)
                .map_err(|e| format!("Zip extraction failed (file likely corrupted): {}", e))
        }
        "7z" => sevenz_rust::decompress_file(&zip_path, &dest_dir)
            .map_err(|e| format!("7z extraction failed: {}", e)),
        "rar" => {
            let mut archive = unrar::Archive::new(&zip_path)
                .open_for_processing()
                .map_err(|e| e.to_string())?;
            while let Some(header) = archive.read_header().map_err(|e| e.to_string())? {
                archive = if header.entry().is_file() {
                    header.extract_to(&dest_dir).map_err(|e| e.to_string())?
                } else {
                    header.skip().map_err(|e| e.to_string())?
                };
            }
            Ok(())
        }
        _ => Err(format!("Unsupported archive format: .{}", extension)),
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::download_mod,
            commands::is_mod_downloaded,
            commands::launch_mod
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
