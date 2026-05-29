use serde::Serialize;
use std::cmp::Ordering;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
enum Op {
    Eq,
    Ne,
    Lt,
    Gt,
}

#[derive(Debug, Clone)]
struct FilterToken {
    field: String,
    op: Op,
    value: String,
}

#[derive(Debug, Clone)]
struct ParsedQuery {
    filters: Vec<FilterToken>,
    words: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct VaultSearchHit {
    pub file: String,
    pub file_abs: String,
    pub line: usize,
    pub block_type: String,
    pub content: String,
}

#[derive(Serialize, Clone)]
pub struct VaultSearchResult {
    pub total_matches: usize,
    pub files: usize,
    pub hits: Vec<VaultSearchHit>,
}

#[tauri::command]
pub async fn app_startup() -> Result<Option<intenttext::VaultInfo>, String> {
    let path = match intenttext::load_vault_path().map_err(|e| e.to_string())? {
        Some(saved) if saved.exists() => saved,
        _ => ensure_default_vault_dir().map_err(|e| e.to_string())?,
    };

    let info = intenttext::register_vault(&path, |_| {}).map_err(|e| e.to_string())?;
    // Ensure .it-index is created under the selected vault root.
    let _ = intenttext::load_or_build_index(&path).map_err(|e| e.to_string())?;
    Ok(Some(info))
}

fn ensure_default_vault_dir() -> Result<PathBuf, std::io::Error> {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let root = base.join("IntentText");
    std::fs::create_dir_all(&root)?;
    Ok(root)
}

#[tauri::command]
pub async fn register_vault_cmd(path: String) -> Result<intenttext::VaultInfo, String> {
    intenttext::register_vault(Path::new(&path), |_| {}).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_vault_cmd(path: String) -> Result<intenttext::VaultInfo, String> {
    intenttext::open_vault(Path::new(&path), |_| {}).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn vault_info_cmd() -> Result<Option<intenttext::VaultInfo>, String> {
    if !intenttext::is_vault_open() {
        return Ok(None);
    }
    intenttext::vault_info()
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_vault_cmd(query: String) -> Result<VaultSearchResult, String> {
    search_internal(&query, None)
}

#[tauri::command]
pub async fn search_vault_folder_cmd(
    query: String,
    folder: String,
) -> Result<VaultSearchResult, String> {
    search_internal(&query, Some(folder.trim_matches('/').to_string()))
}

fn search_internal(
    query: &str,
    folder_prefix: Option<String>,
) -> Result<VaultSearchResult, String> {
    let Some(vault_root) = intenttext::vault_path() else {
        return Err("No vault is open".to_string());
    };

    let db = intenttext::load_or_build_index(&vault_root).map_err(|e| e.to_string())?;
    let parsed = parse_query(query);

    let mut hits: Vec<VaultSearchHit> = Vec::new();

    for c in db.collections.values() {
        if let Some(prefix) = &folder_prefix {
            if !c.file.starts_with(prefix) {
                continue;
            }
        }

        for d in &c.documents {
            if !matches_doc(d, &parsed) {
                continue;
            }
            hits.push(VaultSearchHit {
                file: c.file.clone(),
                file_abs: c.file_abs.clone(),
                line: d._line,
                block_type: d._type.clone(),
                content: d._content.clone(),
            });
        }
    }

    hits.sort_by(|a, b| {
        a.file
            .cmp(&b.file)
            .then_with(|| a.line.cmp(&b.line))
            .then_with(|| a.block_type.cmp(&b.block_type))
    });

    if hits.len() > 500 {
        hits.truncate(500);
    }

    let files = hits
        .iter()
        .map(|h| h.file.clone())
        .collect::<std::collections::BTreeSet<_>>()
        .len();

    Ok(VaultSearchResult {
        total_matches: hits.len(),
        files,
        hits,
    })
}

fn parse_query(query: &str) -> ParsedQuery {
    let mut filters = Vec::new();
    let mut words = Vec::new();

    for token in query.split_whitespace() {
        let parsed = if let Some(i) = token.find("!=") {
            Some((&token[..i], Op::Ne, &token[i + 2..]))
        } else if let Some(i) = token.find('=') {
            Some((&token[..i], Op::Eq, &token[i + 1..]))
        } else if let Some(i) = token.find('<') {
            Some((&token[..i], Op::Lt, &token[i + 1..]))
        } else if let Some(i) = token.find('>') {
            Some((&token[..i], Op::Gt, &token[i + 1..]))
        } else {
            None
        };

        if let Some((field, op, value)) = parsed {
            let field = field.trim().to_lowercase();
            let value = value.trim().to_string();
            if !field.is_empty() && !value.is_empty() {
                filters.push(FilterToken { field, op, value });
            }
        } else {
            let w = token.trim().to_lowercase();
            if !w.is_empty() {
                words.push(w);
            }
        }
    }

    ParsedQuery { filters, words }
}

fn compare_values(left: &str, op: &Op, right: &str) -> bool {
    let ll = left.trim().to_lowercase();
    let rr = right.trim().to_lowercase();

    match op {
        Op::Eq => ll == rr,
        Op::Ne => ll != rr,
        Op::Lt | Op::Gt => {
            if let (Some(ld), Some(rd)) = (to_date_score(&ll), to_date_score(&rr)) {
                return match op {
                    Op::Lt => ld < rd,
                    Op::Gt => ld > rd,
                    _ => false,
                };
            }

            match ll.cmp(&rr) {
                Ordering::Less => matches!(op, Op::Lt),
                Ordering::Greater => matches!(op, Op::Gt),
                Ordering::Equal => false,
            }
        }
    }
}

fn to_date_score(v: &str) -> Option<i32> {
    // YYYY-MM-DD
    let p: Vec<&str> = v.split('-').collect();
    if p.len() == 3
        && p[0].len() == 4
        && p[1].len() == 2
        && p[2].len() == 2
        && p.iter().all(|x| x.chars().all(|c| c.is_ascii_digit()))
    {
        let y = p[0].parse::<i32>().ok()?;
        let m = p[1].parse::<i32>().ok()?;
        let d = p[2].parse::<i32>().ok()?;
        return Some(y * 10_000 + m * 100 + d);
    }

    // DD/MM/YYYY
    let p: Vec<&str> = v.split('/').collect();
    if p.len() == 3
        && p[0].len() == 2
        && p[1].len() == 2
        && p[2].len() == 4
        && p.iter().all(|x| x.chars().all(|c| c.is_ascii_digit()))
    {
        let d = p[0].parse::<i32>().ok()?;
        let m = p[1].parse::<i32>().ok()?;
        let y = p[2].parse::<i32>().ok()?;
        return Some(y * 10_000 + m * 100 + d);
    }

    None
}

fn field_value(doc: &intenttext::ItDocument, field: &str) -> String {
    match field {
        "type" | "_type" => doc._type.clone(),
        "content" | "_content" => doc._content.clone(),
        "section" | "_section" => doc._section.clone().unwrap_or_default(),
        "collection" | "_collection" => doc._collection.clone(),
        "line" | "_line" => doc._line.to_string(),
        _ => doc
            .properties
            .get(field)
            .map(|v| {
                if let Some(s) = v.as_str() {
                    s.to_string()
                } else {
                    v.to_string()
                }
            })
            .unwrap_or_default(),
    }
}

fn matches_doc(doc: &intenttext::ItDocument, parsed: &ParsedQuery) -> bool {
    for f in &parsed.filters {
        let left = field_value(doc, &f.field);
        if !compare_values(&left, &f.op, &f.value) {
            return false;
        }
    }

    if !parsed.words.is_empty() {
        let haystack = format!(
            "{} {} {} {}",
            doc._type,
            doc._content,
            doc._section.clone().unwrap_or_default(),
            doc.properties
                .values()
                .map(|v| v
                    .as_str()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| v.to_string()))
                .collect::<Vec<_>>()
                .join(" ")
        )
        .to_lowercase();

        for w in &parsed.words {
            if !haystack.contains(w) {
                return false;
            }
        }
    }

    true
}
