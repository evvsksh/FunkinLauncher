use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[tauri::command]
pub fn is_mod_downloaded(app: AppHandle, mod_id: String) -> bool {
    let app_data = app.path().app_data_dir().unwrap();
    let mod_path: PathBuf = app_data.join("mods").join(mod_id);

    mod_path.exists()
}