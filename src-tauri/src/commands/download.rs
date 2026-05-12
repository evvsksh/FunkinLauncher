use reqwest::{redirect::Policy, Client, ClientBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

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

struct DownloadProgress {
    downloaded: u64,
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
        .user_agent("Mozilla/5.0 FunkinLauncher-Agent/2.0")
        .connect_timeout(Duration::from_secs(15))
        .pool_max_idle_per_host(10)
        .pool_idle_timeout(Duration::from_secs(30))
        .tcp_keepalive(Some(Duration::from_secs(30)))
        .http1_only()
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_mod(
    app: AppHandle,
    url: String,
    _mod_id: String,
    download_id: String,
) -> Result<(), String> {
    let client = http_client()?;

    let appdata = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let temp = appdata.join("temp");

    async_fs::create_dir_all(&temp)
        .await
        .map_err(|e| e.to_string())?;

    let file_path = temp.join(format!("{download_id}.zip"));

    let head = client.get(&url).send().await.map_err(|e| e.to_string())?;
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

    PROGRESS
        .lock()
        .await
        .insert(download_id.clone(), DownloadProgress { downloaded: 0 });

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

    let app_c = app.clone();
    let url_c = url.clone();
    let download_id_c = download_id.clone();

    let paused_c = paused.clone();
    let stopped_c = stopped.clone();

    let file_c = file.clone();

    let handle: JoinHandle<()> = tokio::spawn(async move {
        let mut downloaded = 0u64;
        let mut success = true;

        if ct.contains("text/html") {
            let _ = app_c.emit("download-failed", &download_id_c);
            return;
        }

        if !accept_ranges {
            let res = client.get(&url_c).send().await;

            if let Ok(mut res) = res {
                let mut f = file_c.lock().await;

                while let Ok(Some(chunk)) = res.chunk().await {
                    if *stopped_c.lock().await {
                        success = false;
                        break;
                    }

                    while *paused_c.lock().await {
                        tokio::time::sleep(Duration::from_millis(200)).await;
                        if *stopped_c.lock().await {
                            success = false;
                            break;
                        }
                    }

                    if f.write_all(&chunk).await.is_err() {
                        success = false;
                        break;
                    }

                    downloaded += chunk.len() as u64;

                    let percent = (downloaded as f64 / total as f64) * 100.0;

                    if let Some(p) = PROGRESS.lock().await.get_mut(&download_id_c) {
                        p.downloaded = downloaded;
                    }

                    let _ = app_c.emit("download-progress", (&download_id_c, percent));
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
                    if *stopped_c.lock().await {
                        success = false;
                        break;
                    }
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
                        if let Ok(bytes) = res.bytes().await {
                            let mut f = file_c.lock().await;
                            let _ = f.seek(std::io::SeekFrom::Start(start)).await;

                            if f.write_all(&bytes).await.is_ok() {
                                downloaded = start + bytes.len() as u64;
                                ok = true;

                                let percent = (downloaded as f64 / total as f64) * 100.0;

                                if let Some(p) = PROGRESS.lock().await.get_mut(&download_id_c) {
                                    p.downloaded = downloaded;
                                }

                                let _ = app_c.emit("download-progress", (&download_id_c, percent));
                                break;
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

        if !success {
            let _ = app_c.emit("download-failed", &download_id_c);
            return;
        }

        let _ = app_c.emit("download-complete", &download_id_c);
        PROGRESS.lock().await.remove(&download_id_c);
    });

    DOWNLOADS.lock().await.insert(
        download_id,
        DownloadTask {
            handle,
            paused,
            stopped,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn pause_download(download_id: String) -> Result<(), String> {
    if let Some(t) = DOWNLOADS.lock().await.get(&download_id) {
        *t.paused.lock().await = true;
    }
    Ok(())
}

#[tauri::command]
pub async fn resume_download(download_id: String) -> Result<(), String> {
    if let Some(t) = DOWNLOADS.lock().await.get(&download_id) {
        *t.paused.lock().await = false;
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_download(download_id: String) -> Result<(), String> {
    let mut d = DOWNLOADS.lock().await;

    if let Some(t) = d.remove(&download_id) {
        *t.stopped.lock().await = true;
        t.handle.abort();
    }

    Ok(())
}
