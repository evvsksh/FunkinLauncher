use futures_util::StreamExt;
use reqwest::Client;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn download_mod(app: AppHandle, url: String, mod_id: String) -> Result<(), String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let temp_dir = appdata.join("temp");
        let mods_dir = appdata.join("mods").join(&mod_id);

        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

        let zip_path = temp_dir.join(format!("{mod_id}.zip"));

        let client = Client::new();
        let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
        let total = res.content_length().unwrap_or(0);

        let should_download = if zip_path.exists() {
            let metadata = fs::metadata(&zip_path).map_err(|e| e.to_string())?;
            metadata.len() != total
        } else {
            true
        };

        if should_download {
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
        }

        extract_zip(zip_path, mods_dir).await?;
        Ok(())
    }

    #[tauri::command]
    pub async fn is_mod_downloaded(app: AppHandle, mod_id: String) -> Result<bool, String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let mods_dir = appdata.join("mods").join(&mod_id);
        Ok(mods_dir.exists()
            && fs::read_dir(&mods_dir)
                .map(|mut d| d.next().is_some())
                .unwrap_or(false))
    }

    #[tauri::command]
    pub async fn launch_mod(app: AppHandle, mod_id: String) -> Result<(), String> {
        let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let mod_path = appdata.join("mods").join(&mod_id);

        app.opener()
            .open_path(mod_path.to_string_lossy().to_string(), None::<String>)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

async fn extract_zip(zip_path: PathBuf, dest_dir: PathBuf) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => dest_dir.join(path),
                None => continue,
            };

            if (*file.name()).ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p).map_err(|e| e.to_string())?;
                    }
                }
                let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
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
