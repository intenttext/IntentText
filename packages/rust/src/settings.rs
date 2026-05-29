//! Settings persistence for desktop integrations.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IntentTextSettings {
    pub vault_path: Option<String>,
    pub theme: Option<String>,
    pub last_query: Option<String>,
}

pub fn settings_path() -> Result<PathBuf, SettingsError> {
    if let Ok(p) = std::env::var("INTENTTEXT_SETTINGS_PATH") {
        if !p.trim().is_empty() {
            return Ok(PathBuf::from(p));
        }
    }
    let base = dirs::config_dir().ok_or(SettingsError::NoConfigDir)?;
    Ok(base.join("intenttext").join("settings.json"))
}

pub fn load_settings() -> Result<IntentTextSettings, SettingsError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(IntentTextSettings::default());
    }
    let content = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&content)?)
}

pub fn save_settings(settings: &IntentTextSettings) -> Result<(), SettingsError> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(settings)?;
    std::fs::write(&path, content)?;
    Ok(())
}

pub fn save_vault_path(path: &Path) -> Result<(), SettingsError> {
    let mut settings = load_settings()?;
    settings.vault_path = Some(path.to_string_lossy().to_string());
    save_settings(&settings)
}

pub fn load_vault_path() -> Result<Option<PathBuf>, SettingsError> {
    let settings = load_settings()?;
    Ok(settings.vault_path.map(PathBuf::from))
}

#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("Could not find config directory")]
    NoConfigDir,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_round_trip_with_override_path() {
        let temp = std::env::temp_dir().join(format!("intenttext-settings-{}.json", uuid::Uuid::new_v4()));
        std::env::set_var("INTENTTEXT_SETTINGS_PATH", temp.to_string_lossy().to_string());

        let settings = IntentTextSettings {
            vault_path: Some("/tmp/vault".to_string()),
            theme: Some("minimal".to_string()),
            last_query: Some("type=task".to_string()),
        };
        save_settings(&settings).expect("save settings");
        let loaded = load_settings().expect("load settings");
        assert_eq!(loaded.vault_path, Some("/tmp/vault".to_string()));
        assert_eq!(loaded.theme, Some("minimal".to_string()));

        let _ = std::fs::remove_file(temp);
        std::env::remove_var("INTENTTEXT_SETTINGS_PATH");
    }
}
