use futures_util::StreamExt;
use reqwest::{redirect::Policy, Client, ClientBuilder};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    fs::{self as async_fs, File, OpenOptions},
    io::{AsyncSeekExt, AsyncWriteExt},
    sync::{Mutex, Semaphore},
    task::JoinHandle,
};

const CHUNK_SIZE: u64 = 4 * 1024 * 1024;
const MAX_RETRIES: u8 = 5;

struct DownloadTask {
    handle: JoinHandle<()>,
    paused: Arc<Mutex<bool>>,
    stop: Arc<Mutex<bool>>,
}

type DownloadMap = Arc<Mutex<HashMap<String, DownloadTask>>>;

lazy_static::lazy_static! {
    static ref DOWNLOADS: DownloadMap = Arc::new(Mutex::new(HashMap::new()));
    static ref SEMAPHORE: Arc<Semaphore> = Arc::new(Semaphore::new(5));
}

fn http_client() -> Result<Client, String> {
    ClientBuilder::new()
        .redirect(Policy::limited(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .pool_idle_timeout(Duration::from_secs(30))
        .tcp_keepalive(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())
}

async fn find_exe_recursive(dir: &Path, current_depth: u32, max_depth: u32) -> Option<PathBuf> {
    if current_depth > max_depth {
        return None;
    }

    let mut entries = async_fs::read_dir(dir).await.ok()?;
    let mut subfolders = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        let name = path.file_name()?.to_str()?.to_lowercase();

        if path.is_file() {
            if path.extension().and_then(|s| s.to_str()) == Some("exe")
                && !name.contains("crashpad")
                && !name.contains("handler")
            {
                return Some(path);
            }
        } else if path.is_dir() {
            subfolders.push(path);
        }
    }

    for folder in subfolders {
        if let Some(found) =
            Box::pin(find_exe_recursive(&folder, current_depth + 1, max_depth)).await
        {
            return Some(found);
        }
    }

    None
}

async fn extract(app: &AppHandle, archive_path: PathBuf, mod_id: String) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dest_dir = appdata.join("mods").join(&mod_id);

    let sevenzip = app
        .path()
        .resolve("resources/7z.exe", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        let status = std::process::Command::new(sevenzip)
            .args([
                "x",
                archive_path.to_str().ok_or("Invalid archive path")?,
                &format!("-o{}", dest_dir.to_str().ok_or("Invalid dest path")?),
                "-y",
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("7z extraction failed".to_string());
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn download_mod(app: AppHandle, url: String, mod_id: String) -> Result<(), String> {
    let permit = SEMAPHORE.clone().acquire_owned().await.map_err(|e| e.to_string())?;

    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let temp_dir = appdata.join("temp");
    async_fs::create_dir_all(&temp_dir).await.map_err(|e| e.to_string())?;

    let file_path = temp_dir.join(format!("{mod_id}.zip"));
    let client = http_client()?;

    let head = client.get(&url).send().await.map_err(|e| e.to_string())?;

    let total_size = head
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);

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

    let app_c = app.clone();
    let mod_id_c = mod_id.clone();

    let handle = tokio::spawn(async move {
        let _permit = permit;

        let mut downloaded: u64 = 0;

        while downloaded < total_size {
            if *stopped.lock().await {
                return;
            }

            while *paused.lock().await {
                tokio::time::sleep(Duration::from_millis(200)).await;
            }

            let start = downloaded;
            let mut end = start + CHUNK_SIZE - 1;

            if total_size > 0 && end >= total_size {
                end = total_size - 1;
            }

            let mut success = false;

            for _ in 0..MAX_RETRIES {
                let res = client
                    .get(&url)
                    .header("Range", format!("bytes={}-{}", start, end))
                    .send()
                    .await;

                if let Ok(res) = res {
                    if let Ok(bytes) = res.bytes().await {
                        let mut f = file.lock().await;

                        let _ = f
                            .seek(std::io::SeekFrom::Start(start))
                            .await;

                        if f.write_all(&bytes).await.is_ok() {
                            downloaded = end + 1;
                            success = true;

                            let percent = if total_size > 0 {
                                ((downloaded as f64 / total_size as f64) * 100.0).floor()
                            } else {
                                0.0
                            };

                            let _ = app_c.emit("download-progress", (mod_id_c.clone(), percent));
                        }

                        break;
                    }
                }

                tokio::time::sleep(Duration::from_millis(300)).await;
            }

            if !success {
                return;
            }
        }

        let _ = extract(&app_c, file_path, mod_id_c).await;
    });

    DOWNLOADS.lock().await.insert(
        mod_id,
        DownloadTask {
            handle,
            paused,
            stop: stopped,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn pause_download(mod_id: String) -> Result<(), String> {
    if let Some(task) = DOWNLOADS.lock().await.get(&mod_id) {
        *task.paused.lock().await = true;
    }
    Ok(())
}

#[tauri::command]
pub async fn resume_download(mod_id: String) -> Result<(), String> {
    if let Some(task) = DOWNLOADS.lock().await.get(&mod_id) {
        *task.paused.lock().await = false;
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_download(mod_id: String) -> Result<(), String> {
    let mut downloads = DOWNLOADS.lock().await;

    if let Some(task) = downloads.remove(&mod_id) {
        *task.stop.lock().await = true;
        task.handle.abort();
    }

    Ok(())
}

#[tauri::command]
pub async fn is_mod_downloaded(app: AppHandle, mod_id: String) -> Result<bool, String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mods_dir = appdata.join("mods").join(&mod_id);

    if !mods_dir.exists() {
        return Ok(false);
    }

    let mut entries = async_fs::read_dir(&mods_dir).await.map_err(|e| e.to_string())?;
    Ok(entries.next_entry().await.map_err(|e| e.to_string())?.is_some())
}

#[tauri::command]
pub async fn launch_mod(
    window: tauri::Window,
    app: AppHandle,
    mod_id: String,
) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mod_root = appdata.join("mods").join(&mod_id);

    if let Some(path) = find_exe_recursive(&mod_root, 0, 3).await {
        let exe_dir = path.parent().unwrap_or(&mod_root).to_path_buf();

        window.hide().map_err(|e| e.to_string())?;

        tokio::task::spawn_blocking(move || {
            let mut child = std::process::Command::new(path)
                .current_dir(exe_dir)
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
        Err("No executable found in the mod folder (searched 3 levels deep)".to_string())
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            download_mod,
            pause_download,
            resume_download,
            stop_download,
            is_mod_downloaded,
            launch_mod
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
