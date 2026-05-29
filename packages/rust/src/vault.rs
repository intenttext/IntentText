//! Vault lifecycle API — app/core contract.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use once_cell::sync::Lazy;

use crate::index::{load_or_build_index, ItDatabase};
use crate::query::{parse_query, QueryOptions};
use crate::settings;
#[cfg(feature = "watch")]
use crate::watch::{watch_folder, WatchOptions};

static VAULT: Lazy<Arc<Mutex<Option<VaultState>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

#[derive(Debug, Clone)]
struct VaultState {
    path: PathBuf,
    index: ItDatabase,
    updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultInfo {
    pub path: String,
    pub collection_count: usize,
    pub document_count: usize,
    pub updated_at: String,
    pub is_new: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WatchEvent {
    pub kind: String,
    pub path: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultQueryItem {
    pub file: String,
    pub matched: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultQueryResult {
    pub total_matches: usize,
    pub files: Vec<VaultQueryItem>,
}

pub fn register_vault<F>(path: &Path, on_change: F) -> Result<VaultInfo, VaultError>
where
    F: Fn(WatchEvent) + Send + Sync + 'static,
{
    if !path.exists() {
        return Err(VaultError::PathNotFound(path.to_string_lossy().to_string()));
    }
    let index = load_or_build_index(path).map_err(VaultError::Index)?;
    let updated_at = chrono::Utc::now().to_rfc3339();

    {
        let mut guard = VAULT.lock().map_err(|_| VaultError::LockPoisoned)?;
        *guard = Some(VaultState {
            path: path.to_path_buf(),
            index,
            updated_at: updated_at.clone(),
        });
    }

    settings::save_vault_path(path).map_err(VaultError::Settings)?;

    on_change(WatchEvent {
        kind: "vault_opened".to_string(),
        path: Some(path.to_string_lossy().to_string()),
    });

    start_vault_watch(path.to_path_buf(), on_change)?;
    vault_info_with_new_flag(true)
}

pub fn open_vault<F>(path: &Path, on_change: F) -> Result<VaultInfo, VaultError>
where
    F: Fn(WatchEvent) + Send + Sync + 'static,
{
    if !path.exists() {
        return Err(VaultError::PathNotFound(path.to_string_lossy().to_string()));
    }
    let index = load_or_build_index(path).map_err(VaultError::Index)?;
    let updated_at = chrono::Utc::now().to_rfc3339();

    {
        let mut guard = VAULT.lock().map_err(|_| VaultError::LockPoisoned)?;
        *guard = Some(VaultState {
            path: path.to_path_buf(),
            index,
            updated_at: updated_at.clone(),
        });
    }

    on_change(WatchEvent {
        kind: "vault_opened".to_string(),
        path: Some(path.to_string_lossy().to_string()),
    });

    start_vault_watch(path.to_path_buf(), on_change)?;
    vault_info_with_new_flag(false)
}

pub fn close_vault() -> Result<(), VaultError> {
    let mut guard = VAULT.lock().map_err(|_| VaultError::LockPoisoned)?;
    *guard = None;
    Ok(())
}

pub fn query_vault(query_string: &str) -> Result<VaultQueryResult, VaultError> {
    let guard = VAULT.lock().map_err(|_| VaultError::LockPoisoned)?;
    let state = guard.as_ref().ok_or(VaultError::NoVaultOpen)?;

    let opts = parse_query(query_string);
    let mut files = Vec::new();
    let mut total = 0usize;

    for collection in state.index.collections.values() {
        let matched = collection
            .documents
            .iter()
            .filter(|doc| matches_doc(doc, &opts))
            .count();
        if matched > 0 {
            total += matched;
            files.push(VaultQueryItem {
                file: collection.file.clone(),
                matched,
            });
        }
    }
    files.sort_by(|a, b| b.matched.cmp(&a.matched).then_with(|| a.file.cmp(&b.file)));

    Ok(VaultQueryResult {
        total_matches: total,
        files,
    })
}

pub fn query_vault_folder(
    query_string: &str,
    folder_prefix: &str,
) -> Result<VaultQueryResult, VaultError> {
    let mut result = query_vault(query_string)?;
    let prefix = folder_prefix.trim_matches('/');
    result.files.retain(|f| f.file.starts_with(prefix));
    result.total_matches = result.files.iter().map(|f| f.matched).sum();
    Ok(result)
}

pub fn vault_info() -> Result<VaultInfo, VaultError> {
    vault_info_with_new_flag(false)
}

pub fn is_vault_open() -> bool {
    VAULT
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|_| ()))
        .is_some()
}

pub fn vault_path() -> Option<PathBuf> {
    VAULT.lock().ok()?.as_ref().map(|s| s.path.clone())
}

fn vault_info_with_new_flag(is_new: bool) -> Result<VaultInfo, VaultError> {
    let guard = VAULT.lock().map_err(|_| VaultError::LockPoisoned)?;
    let state = guard.as_ref().ok_or(VaultError::NoVaultOpen)?;
    let collection_count = state.index.collections.len();
    let document_count: usize = state
        .index
        .collections
        .values()
        .map(|c| c.document_count)
        .sum();
    Ok(VaultInfo {
        path: state.path.to_string_lossy().to_string(),
        collection_count,
        document_count,
        updated_at: state.updated_at.clone(),
        is_new,
    })
}

#[cfg(feature = "watch")]
fn start_vault_watch<F>(vault_path: PathBuf, on_change: F) -> Result<(), VaultError>
where
    F: Fn(WatchEvent) + Send + Sync + 'static,
{
    let on_change = std::sync::Arc::new(on_change);
    let callback = on_change.clone();

    watch_folder(&vault_path, WatchOptions::default(), move |event| {
        // Refresh the single root .it-index on any .it file event.
        if let Ok(mut guard) = VAULT.lock() {
            if let Some(state) = guard.as_mut() {
                if let Ok(fresh) = load_or_build_index(&state.path) {
                    state.index = fresh;
                    state.updated_at = chrono::Utc::now().to_rfc3339();
                }
            }
        }

        callback(WatchEvent {
            kind: event.kind,
            path: event.path,
        });
    })
    .map_err(VaultError::Io)
}

#[cfg(not(feature = "watch"))]
fn start_vault_watch<F>(_vault_path: PathBuf, _on_change: F) -> Result<(), VaultError>
where
    F: Fn(WatchEvent) + Send + Sync + 'static,
{
    Ok(())
}

fn matches_doc(doc: &crate::index::ItDocument, opts: &QueryOptions) -> bool {
    if let Some(t) = &opts.block_type {
        if doc._type != *t {
            return false;
        }
    }

    if let Some(types) = &opts.types {
        if !types.iter().any(|t| t == &doc._type) {
            return false;
        }
    }

    if let Some(section) = &opts.section {
        let section_l = section.to_lowercase();
        let doc_section = doc._section.clone().unwrap_or_default().to_lowercase();
        if doc_section != section_l {
            return false;
        }
    }

    if let Some(props) = &opts.properties {
        for (k, v) in props {
            let actual = doc
                .get_str_value(k)
                .or_else(|| doc.properties.get(k).and_then(|p| p.as_str()))
                .unwrap_or_default();
            if !actual.eq_ignore_ascii_case(v) {
                return false;
            }
        }
    }

    if let Some(search) = &opts.search {
        let needle = search.to_lowercase();
        let content_match = doc._content.to_lowercase().contains(&needle);
        let props_match = doc.properties.values().any(|v| {
            v.as_str()
                .map(|s| s.to_lowercase().contains(&needle))
                .unwrap_or(false)
        });
        if !content_match && !props_match {
            return false;
        }
    }

    true
}

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("No vault is open - call register_vault or open_vault first")]
    NoVaultOpen,
    #[error("Vault lock poisoned")]
    LockPoisoned,
    #[error("Query error: {0}")]
    Query(String),
    #[error("Settings error: {0}")]
    Settings(#[from] crate::settings::SettingsError),
    #[error("Index error: {0}")]
    Index(#[from] crate::index::IndexError),
    #[error("Vault path does not exist: {0}")]
    PathNotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_and_query_vault() {
        let root = std::env::temp_dir().join(format!("intenttext-vault-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("contracts")).expect("mkdir");
        std::fs::write(
            root.join("contracts").join("a.it"),
            "title: Contract\ntask: Review terms | owner: legal",
        )
        .expect("write it file");

        // isolate settings write during test
        std::env::set_var(
            "INTENTTEXT_SETTINGS_PATH",
            root.join("settings.json").to_string_lossy().to_string(),
        );

        register_vault(&root, |_| {}).expect("register");
        let res = query_vault("type=task").expect("query");
        assert!(res.total_matches >= 1);
        assert!(is_vault_open());

        close_vault().expect("close");
        let _ = std::fs::remove_dir_all(root);
        std::env::remove_var("INTENTTEXT_SETTINGS_PATH");
    }
}
