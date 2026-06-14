use serde::Serialize;
use std::path::{Component, Path};

/// Largest file the app will read into memory. Real `.it` documents are tiny;
/// this stops a malformed/hostile multi-hundred-MB file (or a binary masquerading
/// as `.it`) from exhausting memory on open. Mirrors core's 10 MB parse cap with
/// headroom for embedded assets.
const MAX_READ_BYTES: u64 = 64 * 1024 * 1024;

/// Extensions `open_external` is allowed to hand to the OS. It exists only to open
/// print/export artifacts in the default app — never arbitrary executables.
const OPEN_EXTERNAL_ALLOWED: &[&str] = &["html", "htm", "pdf"];

/// Reject empty paths, embedded NUL bytes, and parent-directory (`..`) traversal
/// components. Absolute, clean paths (what the app passes from dialogs/vault
/// listings) pass through unchanged; a constructed path that tries to climb out
/// of its directory is refused. Checked component-wise so a filename merely
/// *containing* ".." (e.g. "my..notes.it") is fine.
fn guard_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Empty path".into());
    }
    if path.contains('\0') {
        return Err("Invalid path".into());
    }
    if Path::new(path)
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return Err("Path traversal is not allowed".into());
    }
    Ok(())
}

/// Reject a file larger than MAX_READ_BYTES before reading it into memory.
fn guard_read_size(p: &Path) -> Result<(), String> {
    if let Ok(meta) = std::fs::metadata(p) {
        if meta.len() > MAX_READ_BYTES {
            return Err(format!(
                "File too large to open ({} bytes; limit {} bytes)",
                meta.len(),
                MAX_READ_BYTES
            ));
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize)]
pub struct FileMetadataInfo {
    pub size: u64,
    pub modified: u64,
    pub is_readonly: bool,
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    guard_path(&path)?;
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    guard_read_size(p)?;
    std::fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    guard_path(&path)?;
    let p = Path::new(&path);
    // Ensure parent directory exists
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    std::fs::write(p, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub async fn write_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    guard_path(&path)?;
    let p = Path::new(&path);
    // Ensure parent directory exists
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    std::fs::write(p, contents).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub async fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    guard_path(&path)?;
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    guard_read_size(p)?;
    std::fs::read(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn list_files(dir: String) -> Result<Vec<FileEntry>, String> {
    guard_path(&dir)?;
    let p = Path::new(&dir);
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let mut entries = Vec::new();
    let read_dir =
        std::fs::read_dir(p).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.flatten() {
        let meta = entry.metadata().ok();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

        // Only include .it files and directories
        if !is_dir && !name.ends_with(".it") {
            continue;
        }

        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            size,
            modified,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub async fn file_metadata(path: String) -> Result<FileMetadataInfo, String> {
    guard_path(&path)?;
    let meta =
        std::fs::metadata(&path).map_err(|e| format!("Failed to read metadata: {}", e))?;

    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(FileMetadataInfo {
        size: meta.len(),
        modified,
        is_readonly: meta.permissions().readonly(),
    })
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    guard_path(&path)?;
    trash::delete(&path).map_err(|e| format!("Failed to move to trash: {}", e))
}

#[tauri::command]
pub async fn rename_file(from: String, to: String) -> Result<(), String> {
    guard_path(&from)?;
    guard_path(&to)?;
    let from_path = Path::new(&from);
    let to_path = Path::new(&to);

    if !from_path.exists() {
        return Err(format!("Source file not found: {}", from));
    }
    if to_path.exists() {
        return Err(format!("Destination already exists: {}", to));
    }

    std::fs::rename(from_path, to_path)
        .map_err(|e| format!("Failed to rename file: {}", e))
}

/// Open a path with the OS default handler (a .html in the default browser, etc.).
/// Used by Print/PDF: we render to a temp .html and open it so the user can print
/// or Save-as-PDF from the browser — reliable, unlike WKWebView's window.print().
#[tauri::command]
pub fn open_external(path: String) -> Result<(), String> {
    guard_path(&path)?;
    // Resolve symlinks and confirm the target is a real, existing file — never a
    // directory, device, or symlink pointing at something unexpected.
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| format!("Cannot resolve path: {}", e))?;
    if !canonical.is_file() {
        return Err("Refusing to open: not a regular file".into());
    }
    // Restrict to print/export artifact types — this command must not be a way to
    // launch arbitrary executables (e.g. a crafted .app / .exe / .sh).
    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !OPEN_EXTERNAL_ALLOWED.contains(&ext.as_str()) {
        return Err(format!("Refusing to open files of type: .{}", ext));
    }

    let canonical_str = canonical.to_string_lossy().to_string();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open")
        .arg(&canonical_str)
        .spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("cmd")
        .args(["/C", "start", "", &canonical_str])
        .spawn();
    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open")
        .arg(&canonical_str)
        .spawn();
    result
        .map(|_| ())
        .map_err(|e| format!("Failed to open {}: {}", canonical_str, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guard_path_rejects_traversal() {
        assert!(guard_path("../../etc/passwd").is_err());
        assert!(guard_path("/Users/me/vault/../../etc/passwd").is_err());
        assert!(guard_path("foo/../bar").is_err());
    }

    #[test]
    fn guard_path_rejects_empty_and_nul() {
        assert!(guard_path("").is_err());
        assert!(guard_path("a\0b").is_err());
    }

    #[test]
    fn guard_path_allows_clean_absolute_and_dotty_names() {
        assert!(guard_path("/Users/me/vault/contract.it").is_ok());
        // ".." inside a filename (not a path component) is fine.
        assert!(guard_path("/Users/me/vault/my..notes.it").is_ok());
        assert!(guard_path("notes.it").is_ok());
    }

    #[test]
    fn open_external_allowlist_is_print_artifacts_only() {
        assert!(OPEN_EXTERNAL_ALLOWED.contains(&"html"));
        assert!(OPEN_EXTERNAL_ALLOWED.contains(&"pdf"));
        assert!(!OPEN_EXTERNAL_ALLOWED.contains(&"app"));
        assert!(!OPEN_EXTERNAL_ALLOWED.contains(&"exe"));
        assert!(!OPEN_EXTERNAL_ALLOWED.contains(&"sh"));
    }
}
