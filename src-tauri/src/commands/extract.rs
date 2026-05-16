use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::process::Command;

fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

#[tauri::command]
pub async fn extract_mod(app: AppHandle, zip_path: String, mod_id: String) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mods_dir = appdata.join("mods").join(&mod_id);

    fs::create_dir_all(&mods_dir)
        .await
        .map_err(|e| e.to_string())?;

    let exe_dir = app.path().resource_dir().map_err(|e| e.to_string())?;

    let seven_zip = if is_windows() {
        exe_dir.join("resources/7z/win/7z.exe")
    } else {
        exe_dir.join("resources/7z/linux/7z")
    };

    let status = Command::new(&seven_zip)
        .args([
            "x",
            &zip_path,
            &format!("-o{}", mods_dir.to_string_lossy()),
            "-y",
        ])
        .status()
        .await
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("extract failed".into());
    }

    Ok(())
}
