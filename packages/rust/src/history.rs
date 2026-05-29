//! History section parsing and update helpers.
//!
//! Parity target: packages/core/src/history.ts

use regex::Regex;

use crate::parser::parse;

use crate::types::{RegistryEntry, RevisionEntry};

#[derive(Debug, Clone)]
pub struct ParsedHistory {
    pub registry: Vec<RegistryEntry>,
    pub revisions: Vec<RevisionEntry>,
    pub registry_intact: bool,
}

pub fn parse_history_section(raw: &str) -> ParsedHistory {
    let mut registry = Vec::new();
    let mut revisions = Vec::new();
    let mut registry_intact = true;

    let registry_line_re = Regex::new(r"^[a-z0-9]{5}\s*\|").expect("valid history regex");

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") {
            continue;
        }

        if let Some(rest) = trimmed.strip_prefix("revision:") {
            revisions.push(parse_revision_line(rest));
            continue;
        }

        if let Some(rest) = trimmed.strip_prefix("registry:") {
            let props = parse_props(rest);
            registry.push(RegistryEntry {
                id: props.get("id").cloned().unwrap_or_default(),
                block_type: props.get("type").cloned().unwrap_or_default(),
                section: props.get("section").cloned().unwrap_or_default(),
                fingerprint: props.get("fingerprint").cloned().unwrap_or_default(),
                dead: props.get("dead").map(|v| v == "true" || v == "dead"),
            });
            continue;
        }

        if registry_line_re.is_match(trimmed) {
            let parts: Vec<&str> = trimmed.split('|').map(|p| p.trim()).collect();
            if parts.len() >= 4 {
                registry.push(RegistryEntry {
                    id: parts[0].to_string(),
                    block_type: parts[1].to_string(),
                    section: parts[2].to_string(),
                    fingerprint: parts[3].to_string(),
                    dead: parts.get(4).map(|v| *v == "dead"),
                });
            } else {
                registry_intact = false;
            }
        }
    }

    ParsedHistory {
        registry,
        revisions,
        registry_intact,
    }
}

pub fn update_history(
    previous_source: &str,
    current_source: &str,
    by: &str,
) -> Result<String, String> {
    let prev_doc = parse(previous_source, None);
    if prev_doc
        .metadata
        .as_ref()
        .and_then(|m| m.freeze.as_ref())
        .is_some()
    {
        return Err("Document is sealed and frozen. Cannot save modifications.".to_string());
    }

    let curr_doc = parse(current_source, None);
    let curr_no_hist = strip_history_section(current_source);
    let prev_no_hist = strip_history_section(previous_source);
    if curr_no_hist.trim() == prev_no_hist.trim() {
        return Ok(current_source.to_string());
    }

    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let version = curr_doc
        .metadata
        .as_ref()
        .and_then(|m| m.tracking.as_ref())
        .map(|t| t.version.clone())
        .unwrap_or_else(|| "1.0".to_string());

    let mut out = curr_no_hist.trim_end().to_string();
    out.push('\n');
    out.push_str("history:\n");
    out.push_str(&format!(
        "revision: | version: {version} | at: {now} | by: {} | change: modified | id: system | block: document | section: root\n",
        if by.trim().is_empty() { "system" } else { by.trim() }
    ));
    Ok(out)
}

fn parse_revision_line(raw: &str) -> RevisionEntry {
    let props = parse_props(raw);
    RevisionEntry {
        version: props.get("version").cloned().unwrap_or_default(),
        at: props.get("at").cloned().unwrap_or_default(),
        by: props.get("by").cloned().unwrap_or_default(),
        change: props
            .get("change")
            .cloned()
            .unwrap_or_else(|| "modified".to_string()),
        id: props.get("id").cloned().unwrap_or_default(),
        block: props.get("block").cloned().unwrap_or_default(),
        section: props.get("section").cloned(),
    }
}

fn parse_props(rest: &str) -> std::collections::HashMap<String, String> {
    let mut props = std::collections::HashMap::new();
    let clean = rest.trim().trim_start_matches('|').trim();
    for seg in clean.split(" | ") {
        if let Some(pos) = seg.find(':') {
            let k = seg[..pos].trim();
            let v = seg[pos + 1..].trim();
            if !k.is_empty() {
                props.insert(k.to_string(), v.to_string());
            }
        }
    }
    props
}

fn strip_history_section(source: &str) -> String {
    let mut lines_out = Vec::new();
    let mut in_history = false;
    for line in source.lines() {
        if line.trim() == "history:" {
            in_history = true;
            continue;
        }
        if !in_history {
            lines_out.push(line);
        }
    }
    lines_out.join("\n")
}
