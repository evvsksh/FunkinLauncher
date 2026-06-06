use std::path::Path;
use tauri::WebviewWindow;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::process::Command;

#[cfg(unix)]
fn is_executable(metadata: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(windows)]
fn is_executable(_: &std::fs::Metadata) -> bool {
    true
}

fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

async fn find_executable(dir: &Path) -> Option<std::path::PathBuf> {
    let mut stack = vec![dir.to_path_buf()];

    while let Some(current) = stack.pop() {
        let mut read = match fs::read_dir(&current).await {
            Ok(r) => r,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = read.next_entry().await {
            let path = entry.path();

            let file_type = match entry.file_type().await {
                Ok(t) => t,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                stack.push(path);
                continue;
            }

            let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("");

            if name.to_ascii_lowercase().contains("uninstall") {
                continue;
            }

            if is_windows() {
                if name.to_ascii_lowercase().ends_with(".exe") {
                    return Some(path);
                }

                continue;
            }

            let metadata = match fs::metadata(&path).await {
                Ok(m) => m,
                Err(_) => continue,
            };

            if !metadata.is_file() {
                continue;
            }

            if !is_executable(&metadata) {
                continue;
            }

            return Some(path);
        }
    }

    None
}

#[tauri::command]
pub async fn launch_mod(app: AppHandle, mod_id: String) -> Result<(), String> {
    let window: WebviewWindow = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mod_dir = base.join("mods").join(&mod_id);

    let exe = find_executable(&mod_dir)
        .await
        .ok_or("no executable found")?;

    let exe_parent = exe
        .parent()
        .ok_or("failed to determine executable directory")?
        .to_path_buf();

    window.hide().map_err(|e| e.to_string())?;

    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut child = match Command::new(&exe)
            .current_dir(&exe_parent)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to spawn process: {e}");
                return;
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let stdout_task = tokio::spawn(async move {
            if let Some(stdout) = stdout {
                use tokio::io::{AsyncBufReadExt, BufReader};

                let mut lines = BufReader::new(stdout).lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    println!("[GAME STDOUT] {line}");
                }
            }
        });

        let stderr_task = tokio::spawn(async move {
            if let Some(stderr) = stderr {
                use tokio::io::{AsyncBufReadExt, BufReader};

                let mut lines = BufReader::new(stderr).lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[GAME STDERR] {line}");
                }
            }
        });

        let _ = child.wait().await;
        let _ = stdout_task.await;
        let _ = stderr_task.await;

        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    });

    Ok(())
}
