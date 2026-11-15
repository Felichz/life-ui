//! The persisted state as a JSON file in the app's data folder (ADR-003).
//! The frontend keeps the same serialized string it used to keep in
//! localStorage; Rust only reads and writes it, atomically.
//!
//! The portable build keeps everything next to the program instead: a folder
//! named `LifeUI-data` beside the executable turns that mode on.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// The folder that makes this a portable copy, when it sits beside the executable.
pub const PORTABLE_DIR: &str = "LifeUI-data";

/// The portable data folder, if this copy runs portable.
pub fn portable_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.join(PORTABLE_DIR);
    dir.is_dir().then_some(dir)
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match portable_dir() {
        Some(dir) => dir,
        None => app.path().app_data_dir().map_err(|e| e.to_string())?,
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("state.json"))
}

/// The saved state, or `None` on the first run.
#[tauri::command]
pub fn read_state(app: AppHandle) -> Result<Option<String>, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|e| e.to_string())
}

/// Writes to a temporary file first and renames it, so a crash mid-write
/// never leaves a half-written state.
#[tauri::command]
pub fn write_state(app: AppHandle, json: String) -> Result<(), String> {
    let path = state_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_state(app: AppHandle) -> Result<(), String> {
    let path = state_path(&app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
