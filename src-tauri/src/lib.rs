use serde::Serialize;
use std::{
    ffi::OsString,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process,
    sync::atomic::{AtomicU64, Ordering},
};

const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
const CANCELLED: &str = "CANCELLED";
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

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
    write_atomic(&path, content.as_bytes())?;
    Ok(save_result(path, content.as_bytes().len() as u64))
}

#[tauri::command]
fn save_json_file_as(content: String) -> Result<FilePayload, String> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json", "jsonc"])
        .set_file_name("untitled.json")
        .save_file()
        .ok_or_else(|| CANCELLED.to_string())?;

    write_atomic(&path, content.as_bytes())?;
    Ok(file_payload(path, content))
}

fn write_atomic(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| "无法解析保存目录。".to_string())?;

    if !parent.exists() {
        return Err(format!(
            "保存目录不存在：{}",
            parent.to_string_lossy()
        ));
    }

    let tmp_path = build_tmp_path(target);
    write_file(&tmp_path, bytes).map_err(|error| {
        let _ = fs::remove_file(&tmp_path);
        format!("无法保存文件：{error}")
    })?;

    if let Err(error) = fs::rename(&tmp_path, target) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("无法保存文件：{error}"));
    }

    Ok(())
}

fn write_file(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = fs::File::create(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}

fn build_tmp_path(target: &Path) -> PathBuf {
    let counter = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let pid = process::id();
    let base = target
        .file_name()
        .map(|name| name.to_os_string())
        .unwrap_or_else(|| OsString::from("untitled"));

    let mut tmp_name = OsString::new();
    tmp_name.push(".");
    tmp_name.push(&base);
    tmp_name.push(format!(".{pid}.{counter}.jsondraft-tmp"));

    target
        .parent()
        .map(|parent| parent.join(&tmp_name))
        .unwrap_or_else(|| PathBuf::from(tmp_name))
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
