use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;
use walkdir::WalkDir;

static WATCHER: Mutex<Option<notify::RecommendedWatcher>> = Mutex::new(None);

#[derive(Serialize)]
pub struct WorkspaceInfo {
    pub name: String,
    pub path: String,
    pub files: Vec<WorkspaceFile>,
}

#[derive(Serialize)]
pub struct WorkspaceFile {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub depth: usize,
    pub size: u64,
    pub modified: u64,
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<WorkspaceInfo, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let mut files = Vec::new();

    for entry in WalkDir::new(&path)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.') && name != "node_modules"
        })
        .flatten()
    {
        let is_dir = entry.file_type().is_dir();
        let entry_name = entry.file_name().to_string_lossy().to_string();

        // Only include .it files and directories
        if !is_dir && !entry_name.ends_with(".it") {
            continue;
        }

        let entry_path = entry.path().to_string_lossy().to_string();
        let relative = entry
            .path()
            .strip_prefix(&path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| entry_name.clone());

        let meta = entry.metadata().ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        files.push(WorkspaceFile {
            name: entry_name,
            path: entry_path,
            relative_path: relative,
            is_dir,
            depth: entry.depth(),
            size,
            modified,
        });
    }

    // Sort: directories first at each level, then alphabetically
    files.sort_by(|a, b| {
        a.depth
            .cmp(&b.depth)
            .then_with(|| b.is_dir.cmp(&a.is_dir))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(WorkspaceInfo {
        name,
        path: path.clone(),
        files,
    })
}

#[tauri::command]
pub async fn watch_folder(path: String, window: tauri::Window) -> Result<(), String> {
    // Stop existing watcher
    {
        let mut guard = WATCHER.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }

    let watch_path = path.clone();
    let watcher = recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let paths: Vec<String> = event
                .paths
                .iter()
                .filter(|p| p.extension().map(|e| e == "it").unwrap_or(false))
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            if paths.is_empty() {
                return;
            }

            let event_name = match event.kind {
                EventKind::Create(_) => "file-created",
                EventKind::Modify(_) => "file-modified",
                EventKind::Remove(_) => "file-deleted",
                _ => return,
            };

            #[derive(serde::Serialize, Clone)]
            struct FsEvent {
                paths: Vec<String>,
                folder: String,
            }

            let folder = paths
                .first()
                .and_then(|p| Path::new(p).parent())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let _ = window.emit(event_name, FsEvent { paths, folder });
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    let mut guard = WATCHER.lock().map_err(|e| e.to_string())?;
    let w = guard.insert(watcher);
    w.watch(Path::new(&watch_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch folder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn unwatch_folder(_path: String) -> Result<(), String> {
    let mut guard = WATCHER.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
