//! IntentText shallow index builder (v2.10 parity surface).

use std::collections::HashMap;

use crate::index::simple_hash;
use crate::types::{IntentBlock, IntentDocument};

#[derive(Debug, Clone, Default)]
pub struct IndexBlockEntry {
    pub block_type: String,
    pub content: String,
    pub section: Option<String>,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Default)]
pub struct IndexFileMetadata {
    pub title: Option<String>,
    pub doc_type: Option<String>,
    pub domain: Option<String>,
    pub track: HashMap<String, String>,
}

#[derive(Debug, Clone, Default)]
pub struct IndexFileEntry {
    pub hash: String,
    pub modified_at: String,
    pub metadata: IndexFileMetadata,
    pub blocks: Vec<IndexBlockEntry>,
}

#[derive(Debug, Clone, Default)]
pub struct ItIndex {
    pub version: String,
    pub scope: String,
    pub folder: String,
    pub built_at: String,
    pub core_version: String,
    pub files: HashMap<String, IndexFileEntry>,
}

#[derive(Debug, Clone, Default)]
pub struct ComposedResult {
    pub file: String,
    pub block: IndexBlockEntry,
}

pub fn build_index_entry(doc: &IntentDocument, source: &str, modified_at: &str) -> IndexFileEntry {
    let mut metadata = IndexFileMetadata::default();
    if let Some(m) = &doc.metadata {
        metadata.title = m.title.clone();
        if let Some(meta) = &m.meta {
            metadata.doc_type = meta.get("type").cloned();
            metadata.domain = meta.get("domain").cloned();
        }
        if let Some(t) = &m.tracking {
            metadata.track.insert("version".to_string(), t.version.clone());
            metadata.track.insert("by".to_string(), t.by.clone());
        }
    }

    let mut flat = Vec::new();
    flatten_blocks(&doc.blocks, &mut flat);

    let mut current_section = String::new();
    let mut blocks = Vec::new();
    for block in flat {
        if block.block_type == "section" {
            current_section = block.content.clone();
        }
        if matches!(
            block.block_type.as_str(),
            "font" | "page" | "header" | "footer" | "watermark" | "meta" | "break" | "toc"
        ) {
            continue;
        }
        blocks.push(IndexBlockEntry {
            block_type: block.block_type,
            content: block.content,
            section: if current_section.is_empty() {
                None
            } else {
                Some(current_section.clone())
            },
            properties: block.properties.unwrap_or_default(),
        });
    }

    IndexFileEntry {
        hash: simple_hash(source),
        modified_at: modified_at.to_string(),
        metadata,
        blocks,
    }
}

pub fn build_shallow_index(
    folder: &str,
    files: &HashMap<String, (String, IntentDocument, String)>,
    core_version: &str,
) -> ItIndex {
    let mut out = ItIndex {
        version: "1".to_string(),
        scope: "shallow".to_string(),
        folder: folder.to_string(),
        built_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        core_version: core_version.to_string(),
        files: HashMap::new(),
    };
    for (filename, (source, doc, modified_at)) in files {
        out.files
            .insert(filename.clone(), build_index_entry(doc, source, modified_at));
    }
    out
}

pub fn check_staleness(
    existing: &ItIndex,
    current_files: &HashMap<String, (String, String)>,
) -> (Vec<String>, Vec<String>, Vec<String>, Vec<String>) {
    let mut stale = Vec::new();
    let mut added = Vec::new();
    let mut removed = Vec::new();
    let mut unchanged = Vec::new();

    for (filename, (source, modified_at)) in current_files {
        match existing.files.get(filename) {
            None => added.push(filename.clone()),
            Some(entry) => {
                if entry.modified_at != *modified_at || entry.hash != simple_hash(source) {
                    stale.push(filename.clone());
                } else {
                    unchanged.push(filename.clone());
                }
            }
        }
    }
    for filename in existing.files.keys() {
        if !current_files.contains_key(filename) {
            removed.push(filename.clone());
        }
    }
    stale.sort();
    added.sort();
    removed.sort();
    unchanged.sort();
    (stale, added, removed, unchanged)
}

pub fn update_index(
    existing: &ItIndex,
    updates: &HashMap<String, (String, IntentDocument, String)>,
    removed_files: &[String],
) -> ItIndex {
    let mut next = existing.clone();
    next.built_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    for filename in removed_files {
        next.files.remove(filename);
    }
    for (filename, (source, doc, modified_at)) in updates {
        next.files
            .insert(filename.clone(), build_index_entry(doc, source, modified_at));
    }
    next
}

pub fn compose_indexes(indexes: &[ItIndex]) -> Vec<ComposedResult> {
    let mut out = Vec::new();
    for index in indexes {
        if index.scope != "shallow" {
            continue;
        }
        for (filename, entry) in &index.files {
            let file = if index.folder.is_empty() {
                filename.clone()
            } else {
                format!("{}/{}", index.folder, filename)
            };
            for block in &entry.blocks {
                out.push(ComposedResult {
                    file: file.clone(),
                    block: block.clone(),
                });
            }
        }
    }
    out
}

pub fn query_composed(
    results: &[ComposedResult],
    filters: &HashMap<String, String>,
) -> Vec<ComposedResult> {
    results
        .iter()
        .filter(|r| {
            if let Some(t) = filters.get("type") {
                if r.block.block_type != *t {
                    return false;
                }
            }
            if let Some(c) = filters.get("content") {
                if !r.block.content.to_lowercase().contains(&c.to_lowercase()) {
                    return false;
                }
            }
            if let Some(by) = filters.get("by") {
                let v = r.block.properties.get("by").cloned().unwrap_or_default();
                if v.to_lowercase() != by.to_lowercase() {
                    return false;
                }
            }
            if let Some(status) = filters.get("status") {
                let v = r.block
                    .properties
                    .get("status")
                    .cloned()
                    .unwrap_or_default();
                if v.to_lowercase() != status.to_lowercase() {
                    return false;
                }
            }
            if let Some(section) = filters.get("section") {
                let s = r.block.section.clone().unwrap_or_default().to_lowercase();
                if !s.contains(&section.to_lowercase()) {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect()
}

pub fn format_table(results: &[ComposedResult]) -> String {
    if results.is_empty() {
        return "No results".to_string();
    }
    let mut out = String::from("FILE | TYPE | CONTENT\n");
    out.push_str("---- | ---- | -------\n");
    for r in results {
        out.push_str(&format!("{} | {} | {}\n", r.file, r.block.block_type, r.block.content));
    }
    out.trim_end().to_string()
}

pub fn format_json(results: &[ComposedResult]) -> String {
    let mut arr = Vec::new();
    for r in results {
        arr.push(serde_json::json!({
            "file": r.file,
            "block": {
                "type": r.block.block_type,
                "content": r.block.content,
                "section": r.block.section,
                "properties": r.block.properties,
            }
        }));
    }
    serde_json::to_string_pretty(&arr).unwrap_or_else(|_| "[]".to_string())
}

pub fn format_csv(results: &[ComposedResult]) -> String {
    if results.is_empty() {
        return String::new();
    }
    let mut out = String::from("file,type,content\n");
    for r in results {
        out.push_str(&format!(
            "{},{},{}\n",
            csv_escape(&r.file),
            csv_escape(&r.block.block_type),
            csv_escape(&r.block.content)
        ));
    }
    out.trim_end().to_string()
}

fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_string()
    }
}

fn flatten_blocks(blocks: &[IntentBlock], out: &mut Vec<IntentBlock>) {
    for b in blocks {
        out.push(b.clone());
        if let Some(children) = &b.children {
            flatten_blocks(children, out);
        }
    }
}
