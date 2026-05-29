//! Lightweight folder watch mode for `.it` files.
//!
//! Uses polling to avoid platform-specific watcher complexity while keeping
//! the core contract simple and deterministic.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WatchEvent {
    pub kind: String,
    pub path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WatchOptions {
    pub poll_interval_ms: u64,
    pub include_hidden: bool,
}

impl Default for WatchOptions {
    fn default() -> Self {
        Self {
            poll_interval_ms: 800,
            include_hidden: false,
        }
    }
}

pub fn watch_folder<F>(root: &Path, options: WatchOptions, on_event: F) -> Result<(), std::io::Error>
where
    F: Fn(WatchEvent) + Send + Sync + 'static,
{
    let root = root.to_path_buf();
    let callback = std::sync::Arc::new(on_event);

    thread::Builder::new()
        .name("intenttext-watch".to_string())
        .spawn(move || {
            let mut prev = snapshot_it_files(&root, options.include_hidden).unwrap_or_default();

            loop {
                thread::sleep(Duration::from_millis(options.poll_interval_ms));
                let next = match snapshot_it_files(&root, options.include_hidden) {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                let prev_paths: HashSet<PathBuf> = prev.keys().cloned().collect();
                let next_paths: HashSet<PathBuf> = next.keys().cloned().collect();

                for added in next_paths.difference(&prev_paths) {
                    callback(WatchEvent {
                        kind: "added".to_string(),
                        path: Some(path_to_string(added)),
                    });
                }
                for removed in prev_paths.difference(&next_paths) {
                    callback(WatchEvent {
                        kind: "removed".to_string(),
                        path: Some(path_to_string(removed)),
                    });
                }
                for common in next_paths.intersection(&prev_paths) {
                    let p = common;
                    let old = prev.get(p).cloned().unwrap_or(SystemTime::UNIX_EPOCH);
                    let new = next.get(p).cloned().unwrap_or(SystemTime::UNIX_EPOCH);
                    if new > old {
                        callback(WatchEvent {
                            kind: "modified".to_string(),
                            path: Some(path_to_string(p)),
                        });
                    }
                }

                prev = next;
            }
        })
        .map(|_| ())
}

fn snapshot_it_files(root: &Path, include_hidden: bool) -> Result<HashMap<PathBuf, SystemTime>, std::io::Error> {
    let mut out = HashMap::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();

            if !include_hidden && name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("it") {
                let mtime = path
                    .metadata()?
                    .modified()
                    .unwrap_or(SystemTime::UNIX_EPOCH);
                out.insert(path, mtime);
            }
        }
    }

    Ok(out)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
