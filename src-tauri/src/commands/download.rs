use reqwest::{redirect::Policy, Client, ClientBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::Manager;
use tauri::{AppHandle, Emitter};

use tokio::fs::{self as async_fs, OpenOptions};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use futures_util::StreamExt;

use crate::commands::extract::extract_mod;

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
        .pool_max_idle_per_host(50)
        .pool_idle_timeout(Duration::from_secs(120))
        .tcp_keepalive(Some(Duration::from_secs(60)))
        .http1_only()
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_mod(
    app: AppHandle,
    url: String,
    mod_id: String,
    download_id: String,
) -> Result<(), String> {
    let client = Arc::new(http_client()?);

    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let temp = appdata.join("temp");
    let mods_dir = appdata.join("mods");

    async_fs::create_dir_all(&temp)
        .await
        .map_err(|e| e.to_string())?;
    async_fs::create_dir_all(&mods_dir)
        .await
        .map_err(|e| e.to_string())?;

    let zip_path = temp.join(format!("{mod_id}.zip"));

    PROGRESS
        .lock()
        .await
        .insert(download_id.clone(), DownloadProgress { downloaded: 0 });

    let paused = Arc::new(Mutex::new(false));
    let stopped = Arc::new(Mutex::new(false));

    let app_c = app.clone();
    let url_c = url.clone();
    let download_id_c = download_id.clone();
    let mod_id_c = mod_id.clone();

    let paused_c = paused.clone();
    let stopped_c = stopped.clone();
    let client_c = client.clone();

    let handle: JoinHandle<()> = tokio::spawn(async move {
        let res = match client_c.get(&url_c).send().await {
            Ok(r) => r,
            Err(_) => {
                let _ = app_c.emit("download-failed", &download_id_c);
                return;
            }
        };

        if !res.status().is_success() {
            let _ = app_c.emit("download-failed", &download_id_c);
            return;
        }

        let final_url = res.url().clone();

        let total = res.content_length().unwrap_or(0);

        let accept_ranges = res
            .headers()
            .get(reqwest::header::ACCEPT_RANGES)
            .and_then(|v| v.to_str().ok())
            .map(|v| v == "bytes")
            .unwrap_or(false);

        let mut file = match OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&zip_path)
            .await
        {
            Ok(f) => f,
            Err(_) => {
                let _ = app_c.emit("download-failed", &download_id_c);
                return;
            }
        };

        let mut downloaded: u64 = 0;
        let mut last_emit = Instant::now();
        let mut last_bytes = 0u64;

        if !accept_ranges {
            let mut stream = client_c
                .get(final_url.as_str())
                .send()
                .await
                .unwrap()
                .bytes_stream();

            while let Some(chunk) = stream.next().await {
                if *stopped_c.lock().await {
                    let _ = app_c.emit("download-failed", &download_id_c);
                    return;
                }

                while *paused_c.lock().await {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }

                let chunk = match chunk {
                    Ok(c) => c,
                    Err(_) => break,
                };

                if file.write_all(&chunk).await.is_err() {
                    let _ = app_c.emit("download-failed", &download_id_c);
                    return;
                }

                downloaded += chunk.len() as u64;

                if let Some(p) = PROGRESS.lock().await.get_mut(&download_id_c) {
                    p.downloaded = downloaded;
                }

                let now = Instant::now();
                let elapsed = now.duration_since(last_emit).as_secs_f64();

                if elapsed >= 0.2 {
                    let delta = downloaded - last_bytes;
                    let speed = delta as f64 / elapsed;

                    let percent = if total > 0 {
                        (downloaded as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };

                    let _ = app_c.emit(
                        "download-progress",
                        serde_json::json!({
                            "downloadId": download_id_c,
                            "downloadedBytes": downloaded,
                            "totalBytes": total,
                            "percent": percent,
                            "speed": speed
                        }),
                    );

                    last_emit = now;
                    last_bytes = downloaded;
                }
            }
        } else {
            while downloaded < total {
                let mut ok = false;

                for _ in 0..MAX_RETRIES {
                    if *stopped_c.lock().await {
                        let _ = app_c.emit("download-failed", &download_id_c);
                        return;
                    }

                    while *paused_c.lock().await {
                        tokio::time::sleep(Duration::from_millis(200)).await;
                    }

                    let start = downloaded;
                    let mut end = start + CHUNK_SIZE - 1;

                    if end >= total {
                        end = total - 1;
                    }

                    let res = client_c
                        .get(final_url.as_str())
                        .header("Range", format!("bytes={}-{}", start, end))
                        .send()
                        .await;

                    if let Ok(res) = res {
                        if let Ok(bytes) = res.bytes().await {
                            if file.seek(std::io::SeekFrom::Start(start)).await.is_ok()
                                && file.write_all(&bytes).await.is_ok()
                            {
                                downloaded = start + bytes.len() as u64;
                                ok = true;

                                if let Some(p) = PROGRESS.lock().await.get_mut(&download_id_c) {
                                    p.downloaded = downloaded;
                                }

                                let now = Instant::now();
                                let elapsed = now.duration_since(last_emit).as_secs_f64();

                                if elapsed >= 0.2 {
                                    let delta = downloaded - last_bytes;
                                    let speed = delta as f64 / elapsed;

                                    let percent = (downloaded as f64 / total as f64) * 100.0;

                                    let _ = app_c.emit(
                                        "download-progress",
                                        serde_json::json!({
                                            "downloadId": download_id_c,
                                            "downloadedBytes": downloaded,
                                            "totalBytes": total,
                                            "percent": percent,
                                            "speed": speed
                                        }),
                                    );

                                    last_emit = now;
                                    last_bytes = downloaded;
                                }

                                break;
                            }
                        }
                    }

                    tokio::time::sleep(Duration::from_secs(1)).await;
                }

                if !ok {
                    let _ = app_c.emit("download-failed", &download_id_c);
                    return;
                }
            }
        }

        let _ = app_c.emit(
            "download-complete",
            serde_json::json!({
                "downloadId": download_id_c
            }),
        );

        let _ = extract_mod(
            app_c.clone(),
            zip_path.to_string_lossy().to_string(),
            mod_id_c,
        )
        .await;

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
