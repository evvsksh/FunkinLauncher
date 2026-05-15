use std::path::Path;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::process::Command;

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

            if is_windows() {
                if name.ends_with(".exe") && !name.contains("uninstall") {
                    return Some(path);
                }
            } else {
                let ok = fs::metadata(&path)
                    .await
                    .map(|m| m.is_file())
                    .unwrap_or(false);

                if ok && !name.contains("uninstall") {
                    return Some(path);
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn launch_mod(app: AppHandle, mod_id: String) -> Result<(), String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mods_dir = base.join("mods");
    let mod_dir = mods_dir.join(&mod_id);

    let exe = find_executable(&mod_dir)
        .await
        .ok_or("no executable found")?;

    if is_windows() {
        Command::new(&exe).spawn().map_err(|e| e.to_string())?;
    } else {
        let _ = Command::new("chmod")
            .args(["+x", exe.to_str().unwrap()])
            .status()
            .await;

        Command::new(&exe).spawn().map_err(|e| e.to_string())?;
    }

    Ok(())
}

