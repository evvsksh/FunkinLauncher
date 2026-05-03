use reqwest::{redirect::Policy, Client, ClientBuilder};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

use tokio::fs::{self as async_fs, OpenOptions};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

const CHUNK_SIZE: u64 = 4 * 1024 * 1024;
const MAX_RETRIES: u8 = 5;

struct DownloadTask {
    handle: JoinHandle<()>,
    paused: Arc<Mutex<bool>>,
    stopped: Arc<Mutex<bool>>,
}

type DownloadMap = Arc<Mutex<HashMap<String, DownloadTask>>>;

lazy_static::lazy_static! {
    static ref DOWNLOADS: DownloadMap = Arc::new(Mutex::new(HashMap::new()));
}

fn http_client() -> Result<Client, String> {
    ClientBuilder::new()
        .redirect(Policy::limited(10))
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|e| e.to_string())
}

fn get_7z_path(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let rel = "resources/7z/win/7z.exe";

    #[cfg(target_os = "linux")]
    let rel = "resources/7z/linux/7z";

    app.path()
        .resolve(rel, BaseDirectory::Resource)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_mod(app: AppHandle, url: String, mod_id: String) -> Result<(), String> {
    let client = http_client()?;

    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let temp = appdata.join("temp");

    async_fs::create_dir_all(&temp)
        .await
        .map_err(|e| e.to_string())?;

    let file_path = temp.join(format!("{mod_id}.zip"));

    let head = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let total = head.content_length().ok_or("Missing content length")?;

    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let file = Arc::new(Mutex::new(file));

    let paused = Arc::new(Mutex::new(false));
    let stopped = Arc::new(Mutex::new(false));

    let paused_c = paused.clone();
    let stopped_c = stopped.clone();

    let app_c = app.clone();
    let mod_c = mod_id.clone();
    let file_c = file_path.clone();
    let url_c = url.clone();

    let handle = tokio::spawn(async move {
        let mut downloaded = 0u64;
        let mut success = true;

        while downloaded < total {
            if *stopped_c.lock().await {
                success = false;
                break;
            }

            while *paused_c.lock().await {
                tokio::time::sleep(Duration::from_millis(200)).await;
            }

            let start = downloaded;
            let mut end = start + CHUNK_SIZE - 1;

            if end >= total {
                end = total - 1;
            }

            let mut ok = false;

            for _ in 0..MAX_RETRIES {
                let res = client
                    .get(&url_c)
                    .header("Range", format!("bytes={}-{}", start, end))
                    .send()
                    .await;

                if let Ok(res) = res {
                    if !res.status().is_success() && res.status() != 206 {
                        continue;
                    }

                    if let Ok(bytes) = res.bytes().await {
                        let mut f = file.lock().await;
                        let _ = f.seek(std::io::SeekFrom::Start(start)).await;

                        if f.write_all(&bytes).await.is_ok() {
                            downloaded = end + 1;
                            ok = true;

                            let percent = (downloaded as f64 / total as f64) * 100.0;
                            let _ = app_c.emit("download-progress", (mod_c.clone(), percent));
                        }

                        break;
                    }
                }
            }

            if !ok {
                success = false;
                break;
            }
        }

        if !success || downloaded != total {
            let _ = app_c.emit("download-failed", mod_c.clone());
            return;
        }

        let _ = app_c.emit("download-verifying", mod_c.clone());

        if let Err(_) = extract(&app_c, file_c, mod_c.clone()).await {
            let _ = app_c.emit("download-failed", mod_c);
            return;
        }

        let _ = app_c.emit("download-complete", mod_c);
    });

    DOWNLOADS.lock().await.insert(
        mod_id,
        DownloadTask {
            handle,
            paused,
            stopped,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn pause_download(mod_id: String) -> Result<(), String> {
    if let Some(t) = DOWNLOADS.lock().await.get(&mod_id) {
        *t.paused.lock().await = true;
    }
    Ok(())
}

#[tauri::command]
pub async fn resume_download(mod_id: String) -> Result<(), String> {
    if let Some(t) = DOWNLOADS.lock().await.get(&mod_id) {
        *t.paused.lock().await = false;
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_download(mod_id: String) -> Result<(), String> {
    let mut d = DOWNLOADS.lock().await;
    if let Some(t) = d.remove(&mod_id) {
        *t.stopped.lock().await = true;
        t.handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn is_mod_downloaded(app: AppHandle, mod_id: String) -> Result<bool, String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file = appdata.join("temp").join(format!("{mod_id}.zip"));
    Ok(file.exists())
}

#[tauri::command]
pub async fn launch_mod(app: AppHandle, mod_id: String) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file = appdata.join("mods").join(&mod_id);

    if !file.exists() {
        return Err("Mod not installed".into());
    }

    Command::new("cmd")
        .arg(file.to_str().unwrap())
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

async fn extract(app: &AppHandle, file_path: PathBuf, mod_id: String) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let output_dir = appdata.join("mods").join(&mod_id);

    async_fs::create_dir_all(&output_dir)
        .await
        .map_err(|e| e.to_string())?;

    let seven_zip = get_7z_path(app)?;

    let status = Command::new(seven_zip)
        .args([
            "x",
            file_path.to_str().unwrap(),
            &format!("-o{}", output_dir.to_str().unwrap()),
            "-y",
        ])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("Extraction failed".into());
    }

    Ok(())
}
