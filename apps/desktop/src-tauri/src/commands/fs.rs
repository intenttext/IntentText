use serde::Serialize;
use std::path::Path;

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
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    std::fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    // Ensure parent directory exists
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    std::fs::write(p, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub async fn list_files(dir: String) -> Result<Vec<FileEntry>, String> {
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
    trash::delete(&path).map_err(|e| format!("Failed to move to trash: {}", e))
}

#[tauri::command]
pub async fn rename_file(from: String, to: String) -> Result<(), String> {
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
