//! identity.rs — custody of the desktop's signing identity.
//!
//! The user's Ed25519 signing identity (private key + name/role/public key, as a
//! JSON blob) is stored in the OS keychain — macOS Keychain / Windows Credential
//! Manager — via the `keyring` crate. The private key never lands in a plaintext
//! file or inside a document; only the resulting signature + public key do.

use keyring::Entry;

const SERVICE: &str = "qa.uts.dotit";
const ACCOUNT: &str = "signing-identity";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("keychain unavailable: {e}"))
}

/// Read the stored identity JSON, or `None` if no identity has been created yet.
#[tauri::command]
pub fn identity_get() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keychain read failed: {e}")),
    }
}

/// Store the identity JSON (overwrites any existing one).
#[tauri::command]
pub fn identity_set(value: String) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err("refusing to store an empty identity".into());
    }
    entry()?
        .set_password(&value)
        .map_err(|e| format!("keychain write failed: {e}"))
}

/// Remove the stored identity. Idempotent — succeeds even if none exists.
#[tauri::command]
pub fn identity_clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keychain delete failed: {e}")),
    }
}
