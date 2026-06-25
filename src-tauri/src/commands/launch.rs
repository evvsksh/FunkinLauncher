use std::path::Path;
use tauri::WebviewWindow;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[cfg(unix)]
fn is_executable_permissions(metadata: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(windows)]
fn is_executable_permissions(_: &std::fs::Metadata) -> bool {
    true
}

fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

async fn is_actual_binary(path: &Path) -> bool {
    let mut file = match fs::File::open(path).await {
        Ok(f) => f,
        Err(_) => return false,
    };

    let mut buffer = [0u8; 4];
    let bytes_read = match file.read(&mut buffer).await {
        Ok(n) => n,
        Err(_) => return false,
    };

    if bytes_read < 4 {
        return false;
    }

    let is_elf = buffer == [0x7F, b'E', b'L', b'F'];
    let is_macho = buffer == [0xFE, 0xED, 0xFA, 0xED]
        || buffer == [0xFE, 0xED, 0xFA, 0xEC]
        || buffer == [0xCE, 0xFA, 0xED, 0xFE]
        || buffer == [0xCF, 0xFA, 0xED, 0xFE];

    is_elf || is_macho
}

async fn find_executable(dir: &Path) -> Option<std::path::PathBuf> {
    let mut stack = vec![(dir.to_path_buf(), 0)];

    while let Some((current, depth)) = stack.pop() {
        if depth > 2 {
            continue;
        }

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
                stack.push((path, depth + 1));
                continue;
            }

            let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("");
            let name_lower = name.to_ascii_lowercase();

            if name_lower.contains("uninstall") {
                continue;
            }

            if is_windows() {
                if name_lower.ends_with(".exe") {
                    return Some(path);
                }
                continue;
            }

            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let blacklisted_extensions = [
                "txt", "json", "png", "jpg", "zip", "tar", "gz", "cfg", "ini", "toml", "md", "so",
                "dylib", "dll", "ndll", "conf", "pack",
            ];
            if blacklisted_extensions.contains(&ext.to_ascii_lowercase().as_str()) {
                continue;
            }

            let metadata = match fs::metadata(&path).await {
                Ok(m) => m,
                Err(_) => continue,
            };

            if !metadata.is_file() || !is_executable_permissions(&metadata) {
                continue;
            }

            if is_actual_binary(&path).await {
                return Some(path);
            }
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
        println!("[LAUNCHER] Attempting to launch: {}", exe.display());
        println!("[LAUNCHER] Working directory: {}", exe_parent.display());

        let mut child = match Command::new(&exe)
            .current_dir(&exe_parent)
            .envs(std::env::vars())
            .env("SDL_VIDEODRIVER", "x11")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[LAUNCHER ERROR] Failed to spawn process: {e}");
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
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

        match child.wait().await {
            Ok(status) => {
                println!("[LAUNCHER] Process exited with status: {status}");
            }
            Err(e) => {
                eprintln!("[LAUNCHER ERROR] Failed while waiting for process: {e}");
            }
        }

        let _ = stdout_task.await;
        let _ = stderr_task.await;

        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    });

    Ok(())
}
