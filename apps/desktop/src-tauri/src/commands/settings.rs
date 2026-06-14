// settings.rs — durable app settings (the multi-vault registry, recents, UI
// prefs) persisted as JSON in the OS app-config directory. Keeping this in Rust
// (rather than localStorage) means registered vaults survive a webview cache
// wipe and can be inspected/backed-up on disk like any native app's settings.

use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("No app config dir: {}", e))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    Ok(dir.join("settings.json"))
}

/// Returns the persisted settings object (an empty object when none saved yet).
#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<Value, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(Value::Object(Default::default()));
    }
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&text).map_err(|e| format!("Corrupt settings: {}", e))
}

/// Merges the given object into the persisted settings (atomic temp-file +
/// rename). Top-level keys present in `settings` overwrite their counterparts on
/// disk; keys absent from `settings` are preserved. This lets independent
/// callers (the vault registry under `vaults`, the UI prefs under `ui`, …) write
/// their own slice without clobbering each other.
#[tauri::command]
pub async fn save_settings(app: tauri::AppHandle, settings: Value) -> Result<(), String> {
    let path = settings_path(&app)?;

    // Read the current settings so we can merge rather than replace.
    let mut current = if path.exists() {
        let text = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str::<Value>(&text).unwrap_or_else(|_| Value::Object(Default::default()))
    } else {
        Value::Object(Default::default())
    };

    match (&mut current, settings) {
        (Value::Object(base), Value::Object(incoming)) => {
            for (k, v) in incoming {
                base.insert(k, v);
            }
        }
        // If either side isn't an object, fall back to a plain replace.
        (slot, incoming) => *slot = incoming,
    }

    let text = serde_json::to_string_pretty(&current)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, text).map_err(|e| format!("Failed to write settings: {}", e))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("Failed to commit settings: {}", e))
}
