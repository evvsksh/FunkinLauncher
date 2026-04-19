use std::{fs, io::Cursor};
use tauri::Manager;

#[tauri::command]
fn download_mod(app: tauri::AppHandle, url: String, mod_id: String) -> Result<(), String> {
    let appdata = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let temp_dir = appdata.join("temp");
    let mods_dir = appdata.join("mods");

    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    let response = reqwest::blocking::get(&url)
        .map_err(|e| e.to_string())?
        .bytes()
        .map_err(|e| e.to_string())?;

    let zip_path = temp_dir.join(format!("{mod_id}.zip"));
    fs::write(&zip_path, &response).map_err(|e| e.to_string())?;

    let reader = Cursor::new(response);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;

    let extract_path = mods_dir.join(&mod_id);
    fs::create_dir_all(&extract_path).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = extract_path.join(file.name());

        if file.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![download_mod])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
