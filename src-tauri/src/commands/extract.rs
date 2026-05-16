use compress_tools::{uncompress_archive, Ownership};
use tauri::{AppHandle, Manager};
use tokio::fs;

#[tauri::command]
pub async fn extract_mod(
    app: AppHandle,
    archive_path: String,
    mod_id: String,
) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let mods_dir = appdata.join("mods").join(&mod_id);

    fs::create_dir_all(&mods_dir)
        .await
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let file = std::fs::File::open(&archive_path).map_err(|e| e.to_string())?;

        uncompress_archive(file, &mods_dir, Ownership::Ignore).map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(())
}
