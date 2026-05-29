use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Default)]
pub struct ItIndex {
    pub folder: String,
    pub files: Vec<IndexEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct IndexEntry {
    pub name: String,
    pub path: String,
    pub title: Option<String>,
    pub domain: Option<String>,
    pub is_frozen: bool,
    pub keywords: Vec<String>,
    pub deadlines: Vec<DeadlineEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeadlineEntry {
    pub file: String,
    pub relative_path: String,
    pub line: usize,
    pub date: String,
    pub label: String,
}

/// Parse a .it file to extract metadata for the index
fn parse_it_file(path: &Path) -> Option<IndexEntry> {
    let content = std::fs::read_to_string(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    let file_path = path.to_string_lossy().to_string();

    let mut title = None;
    let mut domain = None;
    let mut is_frozen = false;
    let mut keywords = Vec::new();
    let mut deadlines = Vec::new();

    for (i, line) in content.lines().enumerate() {
        let trimmed = line.trim();

        // Extract keyword
        if let Some(kw) = trimmed.split(':').next() {
            let kw = kw.trim().to_lowercase();
            if !kw.is_empty()
                && !kw.starts_with("//")
                && !kw.starts_with('#')
                && !keywords.contains(&kw)
            {
                keywords.push(kw.clone());
            }

            match kw.as_str() {
                "title" => {
                    if title.is_none() {
                        title = trimmed.strip_prefix("title:").map(|s| s.trim().to_string());
                    }
                }
                "domain" => {
                    if domain.is_none() {
                        domain = trimmed
                            .strip_prefix("domain:")
                            .map(|s| s.trim().to_string());
                    }
                }
                "freeze" => {
                    is_frozen = true;
                }
                "deadline" => {
                    // Try to extract date and label from deadline line
                    if let Some(rest) = trimmed.strip_prefix("deadline:") {
                        let rest = rest.trim();
                        // Simple extraction: look for | date: pattern
                        let mut date_val = String::new();
                        let mut label_val = rest.to_string();

                        for part in rest.split('|') {
                            let part = part.trim();
                            if let Some(d) = part.strip_prefix("date:") {
                                date_val = d.trim().to_string();
                            } else if !part.contains(':') {
                                label_val = part.to_string();
                            }
                        }

                        if label_val.contains('|') {
                            label_val =
                                label_val.split('|').next().unwrap_or("").trim().to_string();
                        }

                        deadlines.push(DeadlineEntry {
                            file: file_path.clone(),
                            relative_path: name.clone(),
                            line: i + 1,
                            date: date_val,
                            label: label_val,
                        });
                    }
                }
                _ => {}
            }
        }
    }

    Some(IndexEntry {
        name,
        path: file_path,
        title,
        domain,
        is_frozen,
        keywords,
        deadlines,
    })
}

#[tauri::command]
pub async fn build_index(dir: String) -> Result<ItIndex, String> {
    let root = Path::new(&dir);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let mut index = ItIndex {
        folder: dir.clone(),
        files: Vec::new(),
    };

    let read_dir =
        std::fs::read_dir(root).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "it").unwrap_or(false) {
            if let Some(entry) = parse_it_file(&path) {
                index.files.push(entry);
            }
        }
    }

    Ok(index)
}

#[tauri::command]
pub async fn build_index_recursive(root: String) -> Result<ItIndex, String> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let mut index = ItIndex {
        folder: root.clone(),
        files: Vec::new(),
    };

    for entry in WalkDir::new(&root)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.') && name != "node_modules"
        })
        .flatten()
    {
        if entry.file_type().is_dir() {
            continue;
        }

        let path = entry.path();
        if path.extension().map(|e| e == "it").unwrap_or(false) {
            if let Some(mut idx_entry) = parse_it_file(path) {
                // Update relative_path for deadlines
                let relative = path
                    .strip_prefix(&root)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| idx_entry.name.clone());

                for dl in &mut idx_entry.deadlines {
                    dl.relative_path = relative.clone();
                }

                index.files.push(idx_entry);
            }
        }
    }

    Ok(index)
}

#[tauri::command]
pub async fn read_index(dir: String) -> Result<Option<ItIndex>, String> {
    // Check for .it-index file
    let index_path = Path::new(&dir).join(".it-index");
    if !index_path.exists() {
        return Ok(None);
    }

    let content =
        std::fs::read_to_string(&index_path).map_err(|e| format!("Failed to read index: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse index: {}", e))
}
