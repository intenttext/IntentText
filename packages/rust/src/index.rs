//! .it-index builder — fast file-level indexing for tooling.
//!
//! Parity target: packages/core/src/index.ts
//!
//! Uses simple_hash (polynomial, NOT SHA-256) to match the TypeScript simpleHash().

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::parser::parse;
use crate::types::IntentDocument;

/// An entry in the .it-index.
#[derive(Debug, Clone)]
pub struct IndexEntry {
    /// File path (relative to project root).
    pub path: String,
    /// Content hash (stable across runs for identical content).
    pub hash: String,
    /// Title extracted from the document, if any.
    pub title: Option<String>,
    /// Summary extracted from the document, if any.
    pub summary: Option<String>,
    /// Block type histogram.
    pub block_counts: Vec<(String, usize)>,
}

/// Build an index entry for a single file.
pub fn index_document(path: &str, source: &str, document: &IntentDocument) -> IndexEntry {
    let hash = simple_hash(source);
    let title = document.metadata.as_ref().and_then(|m| m.title.clone());
    let summary = document.metadata.as_ref().and_then(|m| m.summary.clone());

    // Count block types
    let mut type_counts: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    for block in &document.blocks {
        *type_counts.entry(block.block_type.as_str()).or_insert(0) += 1;
    }
    let mut block_counts: Vec<(String, usize)> =
        type_counts.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
    block_counts.sort();

    IndexEntry {
        path: path.to_string(),
        hash,
        title,
        summary,
        block_counts,
    }
}

/// Polynomial hash matching TypeScript's `simpleHash()`.
///
/// Exact parity with:
/// ```js
/// let h = 0;
/// for (let i = 0; i < content.length; i++) {
///   h = (Math.imul(31, h) + content.charCodeAt(i)) | 0;
/// }
/// return "hash:" + Math.abs(h).toString(16).padStart(8, "0");
/// ```
///
/// Uses UTF-16 code unit values (JS charCodeAt), 32-bit signed arithmetic, then abs.
///
/// ```
/// use intenttext::index::simple_hash;
/// assert_eq!(simple_hash("hello"), "hash:05e918d2");
/// ```
pub fn simple_hash(content: &str) -> String {
    let mut h: i32 = 0;
    // Encode as UTF-16 to match JS charCodeAt()
    for unit in content.encode_utf16() {
        h = (31i32.wrapping_mul(h)).wrapping_add(unit as i32);
    }
    let abs_h = (h as i64).unsigned_abs() as u32;
    format!("hash:{:08x}", abs_h)
}

/// Serialise an index to JSON-like string (simple key-value per line, tab-indented).
pub fn serialize_index(entries: &[IndexEntry]) -> String {
    let mut out = String::new();
    for entry in entries {
        out.push_str(&format!("{}\t{}\n", entry.path, entry.hash));
        if let Some(t) = &entry.title {
            out.push_str(&format!("\ttitle:{t}\n"));
        }
        if let Some(s) = &entry.summary {
            out.push_str(&format!("\tsummary:{s}\n"));
        }
        for (k, v) in &entry.block_counts {
            out.push_str(&format!("\t{k}:{v}\n"));
        }
    }
    out
}

// ── Vault-wide recursive index model ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItDatabase {
    pub version: String,
    pub vault: String,
    pub created_at: String,
    pub updated_at: String,
    pub collections: HashMap<String, ItCollection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItCollection {
    pub name: String,
    pub file: String,
    pub file_abs: String,
    pub modified: String,
    pub document_count: usize,
    pub documents: Vec<ItDocument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItDocument {
    pub _id: String,
    pub _line: usize,
    #[serde(rename = "type")]
    pub _type: String,
    pub _content: String,
    pub _section: Option<String>,
    pub _collection: String,
    #[serde(flatten)]
    pub properties: HashMap<String, Value>,
}

impl ItDocument {
    pub fn get_value(&self, field: &str) -> Option<Value> {
        match field {
            "_id" => Some(Value::String(self._id.clone())),
            "_line" => Some(Value::Number((self._line as u64).into())),
            "type" | "_type" => Some(Value::String(self._type.clone())),
            "_content" | "content" => Some(Value::String(self._content.clone())),
            "_section" => self._section.clone().map(Value::String),
            "_collection" => Some(Value::String(self._collection.clone())),
            _ => self.properties.get(field).cloned(),
        }
    }

    pub fn get_str_value(&self, field: &str) -> Option<&str> {
        match field {
            "type" | "_type" => Some(&self._type),
            "_content" | "content" => Some(&self._content),
            "_collection" => Some(&self._collection),
            _ => self.properties.get(field).and_then(|v| v.as_str()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub collection_count: usize,
    pub document_count: usize,
    pub index_path: String,
}

pub fn build_index(vault_root: &Path) -> Result<ItDatabase, IndexError> {
    let mut collections = HashMap::new();
    for file in collect_it_files(vault_root)? {
        let collection = build_collection(&file, vault_root)?;
        collections.insert(collection.name.clone(), collection);
    }

    let now = chrono::Utc::now().to_rfc3339();
    Ok(ItDatabase {
        version: env!("CARGO_PKG_VERSION").to_string(),
        vault: normalize_path(vault_root),
        created_at: now.clone(),
        updated_at: now,
        collections,
    })
}

pub fn load_index(folder: &Path) -> Result<ItDatabase, IndexError> {
    let content = std::fs::read_to_string(folder.join(".it-index")).map_err(IndexError::Io)?;
    serde_json::from_str(&content).map_err(IndexError::Json)
}

pub fn save_index(db: &ItDatabase, folder: &Path) -> Result<(), IndexError> {
    let index_path = folder.join(".it-index");
    let temp_path = folder.join(format!(".it-index.tmp.{}", uuid::Uuid::new_v4()));
    let content = serde_json::to_string_pretty(db).map_err(IndexError::Json)?;
    std::fs::write(&temp_path, content).map_err(IndexError::Io)?;
    std::fs::rename(&temp_path, &index_path).map_err(IndexError::Io)
}

pub fn load_or_build_index(folder: &Path) -> Result<ItDatabase, IndexError> {
    let index_path = folder.join(".it-index");
    if !index_path.exists() {
        let db = build_index(folder)?;
        save_index(&db, folder)?;
        return Ok(db);
    }

    let mut db = match load_index(folder) {
        Ok(db) => db,
        Err(_) => {
            let rebuilt = build_index(folder)?;
            save_index(&rebuilt, folder)?;
            return Ok(rebuilt);
        }
    };

    let mut changed = false;
    let disk_files = collect_it_files(folder)?;
    let mut seen = HashSet::new();

    for file in &disk_files {
        let key = relative_stem(file, folder)?;
        seen.insert(key.clone());
        let modified = file_modified_iso(file)?;
        let stale = db
            .collections
            .get(&key)
            .map(|c| c.modified != modified)
            .unwrap_or(true);
        if stale {
            let collection = build_collection(file, folder)?;
            db.collections.insert(key, collection);
            changed = true;
        }
    }

    let removed: Vec<String> = db
        .collections
        .keys()
        .filter(|k| !seen.contains(*k))
        .cloned()
        .collect();
    for key in removed {
        db.collections.remove(&key);
        changed = true;
    }

    if changed {
        db.updated_at = chrono::Utc::now().to_rfc3339();
        save_index(&db, folder)?;
    }

    Ok(db)
}

pub fn register_workspace(folder: &Path) -> Result<WorkspaceInfo, IndexError> {
    let db = build_index(folder)?;
    save_index(&db, folder)?;
    Ok(workspace_info(folder, &db))
}

pub fn unregister_workspace(folder: &Path) -> Result<(), IndexError> {
    let path = folder.join(".it-index");
    if path.exists() {
        std::fs::remove_file(path).map_err(IndexError::Io)?;
    }
    Ok(())
}

pub fn is_workspace(folder: &Path) -> bool {
    folder.join(".it-index").exists()
}

pub fn rebuild_collection(db: &mut ItDatabase, file: &Path, folder: &Path) -> Result<(), IndexError> {
    let key = relative_stem(file, folder)?;
    if file.exists() {
        let collection = build_collection(file, folder)?;
        db.collections.insert(key, collection);
    } else {
        db.collections.remove(&key);
    }
    db.updated_at = chrono::Utc::now().to_rfc3339();
    Ok(())
}

fn workspace_info(folder: &Path, db: &ItDatabase) -> WorkspaceInfo {
    WorkspaceInfo {
        path: normalize_path(folder),
        collection_count: db.collections.len(),
        document_count: db.collections.values().map(|c| c.document_count).sum(),
        index_path: normalize_path(&folder.join(".it-index")),
    }
}

fn build_collection(file: &Path, vault_root: &Path) -> Result<ItCollection, IndexError> {
    let source = std::fs::read_to_string(file).map_err(IndexError::Io)?;
    let rel_file = relative_file(file, vault_root)?;
    let key = relative_stem(file, vault_root)?;
    let modified = file_modified_iso(file)?;
    let parsed = parse(&source, None);
    let documents = blocks_to_documents(&parsed, &key);

    Ok(ItCollection {
        name: key,
        file: rel_file,
        file_abs: normalize_path(file),
        modified,
        document_count: documents.len(),
        documents,
    })
}

fn blocks_to_documents(doc: &IntentDocument, collection_name: &str) -> Vec<ItDocument> {
    let mut out = Vec::new();
    let mut current_section: Option<String> = None;

    for (idx, block) in doc.blocks.iter().enumerate() {
        if block.block_type == "section" {
            current_section = Some(block.content.clone());
        }

        if matches!(
            block.block_type.as_str(),
            "body-text" | "history" | "extension" | "columns"
        ) {
            continue;
        }

        let mut properties = HashMap::new();
        if let Some(props) = &block.properties {
            for (k, v) in props {
                properties.insert(k.clone(), parse_property_value(v));
            }
        }

        out.push(ItDocument {
            _id: block.id.clone(),
            _line: idx + 1,
            _type: block.block_type.clone(),
            _content: block.content.clone(),
            _section: current_section.clone(),
            _collection: collection_name.to_string(),
            properties,
        });
    }

    out
}

fn parse_property_value(v: &str) -> Value {
    if let Ok(n) = v.parse::<i64>() {
        return Value::Number(n.into());
    }
    if let Ok(f) = v.parse::<f64>() {
        if let Some(num) = serde_json::Number::from_f64(f) {
            return Value::Number(num);
        }
    }
    match v {
        "true" => Value::Bool(true),
        "false" => Value::Bool(false),
        _ => Value::String(v.to_string()),
    }
}

fn collect_it_files(root: &Path) -> Result<Vec<PathBuf>, IndexError> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir).map_err(IndexError::Io)? {
            let entry = entry.map_err(IndexError::Io)?;
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();

            if path.is_dir() {
                if !name.starts_with('.') {
                    stack.push(path);
                }
            } else if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("it") {
                out.push(path);
            }
        }
    }
    out.sort();
    Ok(out)
}

fn relative_file(path: &Path, root: &Path) -> Result<String, IndexError> {
    let rel = path
        .strip_prefix(root)
        .map_err(|_| IndexError::Path(format!("{} is outside vault root", normalize_path(path))))?;
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

fn relative_stem(path: &Path, root: &Path) -> Result<String, IndexError> {
    let rel = path
        .strip_prefix(root)
        .map_err(|_| IndexError::Path(format!("{} is outside vault root", normalize_path(path))))?;
    Ok(rel.with_extension("").to_string_lossy().replace('\\', "/"))
}

fn file_modified_iso(path: &Path) -> Result<String, IndexError> {
    let modified = path
        .metadata()
        .map_err(IndexError::Io)?
        .modified()
        .map_err(IndexError::Io)?;
    let dt: chrono::DateTime<chrono::Utc> = modified.into();
    Ok(dt.to_rfc3339())
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[derive(Debug, thiserror::Error)]
pub enum IndexError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Path error: {0}")]
    Path(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_hash_matches_typescript() {
        // Verified against TypeScript simpleHash("hello"):
        // node: Math.abs((31*...) | 0).toString(16) == "05e918d2"
        assert_eq!(simple_hash("hello"), "hash:05e918d2");
    }

    #[test]
    fn hash_is_stable() {
        let h1 = simple_hash("content");
        let h2 = simple_hash("content");
        assert_eq!(h1, h2);
    }

    #[test]
    fn hash_differs_for_different_content() {
        assert_ne!(simple_hash("abc"), simple_hash("xyz"));
    }

    #[test]
    fn empty_string_hash() {
        assert_eq!(simple_hash(""), "hash:00000000");
    }

    #[test]
    fn index_entry_built() {
        use crate::parser::parse;
        let source = "title: My Doc\ntext: Hello";
        let doc = parse(source, None);
        let entry = index_document("docs/my-doc.it", source, &doc);
        assert_eq!(entry.path, "docs/my-doc.it");
        assert_eq!(entry.title, Some("My Doc".to_string()));
        assert!(!entry.hash.is_empty());
    }

    #[test]
    fn workspace_index_roundtrip() {
        let root = std::env::temp_dir().join(format!("intenttext-index-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("contracts")).expect("mkdir");
        std::fs::write(
            root.join("contracts/a.it"),
            "title: A\nsection: Ops\ntask: Ship | owner: emad",
        )
        .expect("write");

        let info = register_workspace(&root).expect("register");
        assert_eq!(info.collection_count, 1);
        assert!(root.join(".it-index").exists());

        let db = load_or_build_index(&root).expect("load");
        assert!(db.collections.contains_key("contracts/a"));

        std::fs::remove_dir_all(root).expect("cleanup");
    }
}
