//! Keys for models through an API (ADR-005), kept in the operating system's
//! credential store: Windows Credential Manager, the macOS Keychain, the
//! Secret Service on Linux. Never in the state file or the WebView's storage.

use keyring::Entry;

const SERVICE: &str = "app.lifeui.desktop";

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

/// The secret kept under `name`, or None when there is none.
#[tauri::command]
pub fn secret_get(name: String) -> Result<Option<String>, String> {
    match entry(&name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    entry(&name)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_delete(name: String) -> Result<(), String> {
    match entry(&name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
