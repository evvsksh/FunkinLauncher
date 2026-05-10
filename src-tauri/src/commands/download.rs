use reqwest::{redirect::Policy, Client, ClientBuilder};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

use tokio::fs::{self as async_fs, OpenOptions};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::interval;

const CHUNK_SIZE: u64 = 4 * 1024 * 1024;
const MAX_RETRIES: u8 = 5;

struct DownloadTask {
    handle: JoinHandle<()>,
    paused: Arc<Mutex<bool>>,
    stopped: Arc<Mutex<bool>>,
}

struct DownloadProgress {
    id: String,
    downloaded: u64,
    total: u64,
    started: Instant,
}

type DownloadMap = Arc<Mutex<HashMap<String, DownloadTask>>>;
type ProgressMap = Arc<Mutex<HashMap<String, DownloadProgress>>>;

lazy_static::lazy_static! {
    static ref DOWNLOADS: DownloadMap = Arc::new(Mutex::new(HashMap::new()));
    static ref PROGRESS: ProgressMap = Arc::new(Mutex::new(HashMap::new()));
}

fn http_client() -> Result<Client, String> {
    ClientBuilder::new()
        .redirect(Policy::limited(10))
        .user_agent("Mozilla/5.0 FunkinLauncher-Agent/1.1")
        .connect_timeout(Duration::from_secs(15))
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

pub fn start_cli_progress() {
    tokio::spawn(async move {
        let mut tick = interval(Duration::from_millis(500));

        loop {
            tick.tick().await;

            let map = PROGRESS.lock().await;

            if map.is_empty() {
                continue;
            }

            print!("\x1B[2J\x1B[H");
            println!("Funkin Launcher Downloads\n");

            for (_, p) in map.iter() {
                let percent = if p.total == 0 {
                    0.0
                } else {
                    (p.downloaded as f64 / p.total as f64) * 100.0
                };

                let elapsed = p.started.elapsed().as_secs_f64().max(1.0);
                let speed = p.downloaded as f64 / elapsed;
                let speed_mb = speed / 1_048_576.0;

                let remaining = if speed > 0.0 {
                    (p.total - p.downloaded) as f64 / speed
                } else {
                    0.0
                };

                println!(
                    "{} - {:.2}% - {:.2} MB/s - {:.0}s left",
                    p.id, percent, speed_mb, remaining
                );
            }
        }
    });
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

    let head = client.head(&url).send().await.map_err(|e| e.to_string())?;
    if !head.status().is_success() {
        return Err(format!("HEAD failed: {}", head.status()));
    }

    let headers = head.headers().clone();

    let total = headers
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .ok_or("Missing content length")?;

    let ct = headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let accept_ranges = headers
        .get(reqwest::header::ACCEPT_RANGES)
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "bytes")
        .unwrap_or(false);

    PROGRESS.lock().await.insert(
        mod_id.clone(),
        DownloadProgress {
            id: mod_id.clone(),
            downloaded: 0,
            total,
            started: Instant::now(),
        },
    );

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
    let client = Arc::new(client);

    let paused_c = paused.clone();
    let stopped_c = stopped.clone();
    let app_c = app.clone();
    let mod_c = mod_id.clone();
    let file_c = file_path.clone();
    let url_c = url.clone();
    let client_c = client.clone();

    let handle = tokio::spawn(async move {
        let mut downloaded = 0u64;
        let mut success = true;

        if ct.contains("text/html") {
            let _ = app_c.emit("download-failed", &mod_c);
            return;
        }

        if !accept_ranges {
            let res = client_c.get(&url_c).send().await;
            if let Ok(mut res) = res {
                let mut f = file.lock().await;
                while let Ok(Some(chunk)) = res.chunk().await {
                    if *stopped_c.lock().await {
                        success = false;
                        break;
                    }
                    if f.write_all(&chunk).await.is_err() {
                        success = false;
                        break;
                    }
                    downloaded += chunk.len() as u64;
                    if let Some(p) = PROGRESS.lock().await.get_mut(&mod_c) {
                        p.downloaded = downloaded;
                    }
                    let _ = app_c.emit("download-progress", (&mod_c, downloaded));
                }
            } else {
                success = false;
            }
        } else {
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
                    let res = client_c
                        .get(&url_c)
                        .header("Range", format!("bytes={}-{}", start, end))
                        .send()
                        .await;

                    if let Ok(res) = res {
                        if res.status() == 200 || res.status() == 206 {
                            if let Ok(bytes) = res.bytes().await {
                                let mut f = file.lock().await;
                                let _ = f.seek(std::io::SeekFrom::Start(start)).await;

                                if f.write_all(&bytes).await.is_ok() {
                                    downloaded = start + bytes.len() as u64;
                                    ok = true;

                                    if let Some(p) = PROGRESS.lock().await.get_mut(&mod_c) {
                                        p.downloaded = downloaded;
                                    }

                                    let _ = app_c.emit("download-progress", (&mod_c, downloaded));
                                    break;
                                }
                            }
                        }
                    }

                    tokio::time::sleep(Duration::from_secs(1)).await;
                }

                if !ok {
                    success = false;
                    break;
                }
            }
        }

        if !success || (accept_ranges && downloaded < total) {
            let _ = app_c.emit("download-failed", &mod_c);
            return;
        }

        let _ = app_c.emit("download-verifying", &mod_c);

        if extract(&app_c, file_c, mod_c.clone()).await.is_err() {
            let _ = app_c.emit("download-failed", &mod_c);
        } else {
            let _ = app_c.emit("download-complete", &mod_c);
        }

        PROGRESS.lock().await.remove(&mod_c);
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

    let _ = async_fs::remove_file(file_path).await;
    Ok(())
}
