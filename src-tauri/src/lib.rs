use serde::Serialize;
use std::{fs, path::PathBuf};

const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
const CANCELLED: &str = "CANCELLED";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePayload {
    path: String,
    name: String,
    content: String,
    size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    path: String,
    name: String,
    size_bytes: u64,
}

#[tauri::command]
fn open_json_file() -> Result<FilePayload, String> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json", "jsonc"])
        .add_filter("All files", &["*"])
        .pick_file()
        .ok_or_else(|| CANCELLED.to_string())?;

    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err("文件超过 10MB，v1 暂不支持打开。".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|error| format!("无法读取文件：{error}"))?;
    Ok(file_payload(path, content))
}

#[tauri::command]
fn open_json_file_at(path: String) -> Result<FilePayload, String> {
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err("文件超过 10MB，v1 暂不支持打开。".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|error| format!("无法读取文件：{error}"))?;
    Ok(file_payload(path, content))
}

#[tauri::command]
fn save_json_file(path: String, content: String) -> Result<SaveResult, String> {
    let path = PathBuf::from(path);
    fs::write(&path, content.as_bytes()).map_err(|error| format!("无法保存文件：{error}"))?;
    Ok(save_result(path, content.as_bytes().len() as u64))
}

#[tauri::command]
fn save_json_file_as(content: String) -> Result<FilePayload, String> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json", "jsonc"])
        .set_file_name("untitled.json")
        .save_file()
        .ok_or_else(|| CANCELLED.to_string())?;

    fs::write(&path, content.as_bytes()).map_err(|error| format!("无法保存文件：{error}"))?;
    Ok(file_payload(path, content))
}

fn file_payload(path: PathBuf, content: String) -> FilePayload {
    let name = file_name(&path);
    let size_bytes = content.as_bytes().len() as u64;

    FilePayload {
        path: path.to_string_lossy().to_string(),
        name,
        content,
        size_bytes,
    }
}

fn save_result(path: PathBuf, size_bytes: u64) -> SaveResult {
    SaveResult {
        path: path.to_string_lossy().to_string(),
        name: file_name(&path),
        size_bytes,
    }
}

fn file_name(path: &PathBuf) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled.json")
        .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_json_file,
            open_json_file_at,
            save_json_file,
            save_json_file_as
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
