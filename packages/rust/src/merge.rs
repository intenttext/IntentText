//! Template merge engine — {{variable}} interpolation.
//!
//! Parity target: packages/core/src/merge.ts

use std::collections::HashMap;
use crate::types::{IntentBlock, IntentDocument};
use crate::parser::parse;

// Property/path keys that must never be traversed — prototype pollution guard.
const DANGEROUS_PATH_KEYS: &[&str] = &["__proto__", "constructor", "prototype"];

// Maximum dot-path depth (mirrors TS MAX_PATH_DEPTH = 20).
const MAX_PATH_DEPTH: usize = 20;

// Maximum path string length before we refuse to resolve.
const MAX_PATH_LEN: usize = 200;

/// Traverse a dot-separated path through a `serde_json::Value`.
/// Returns `None` for any dangerous key segment, negative array index,
/// out-of-bounds index, or path that exceeds MAX_PATH_DEPTH.
fn get_by_path<'a>(root: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let keys: Vec<&str> = path.split('.').collect();
    if keys.len() > MAX_PATH_DEPTH {
        return None;
    }
    let mut current = root;
    for key in &keys {
        if DANGEROUS_PATH_KEYS.contains(key) {
            return None;
        }
        match current {
            serde_json::Value::Object(map) => {
                current = map.get(*key)?;
            }
            serde_json::Value::Array(arr) => {
                let idx: i64 = key.parse().ok()?;
                if idx < 0 || idx as usize >= arr.len() {
                    return None;
                }
                current = &arr[idx as usize];
            }
            _ => return None,
        }
    }
    Some(current)
}

/// Merge deep template variables into a document using a JSON value tree.
///
/// Supports dot-notation paths (`{{a.b.c}}`), dangerous key blocking,
/// negative index rejection, and path length limits.
pub fn merge_value(document: &IntentDocument, data: &serde_json::Value) -> IntentDocument {
    if !data.is_object() && !data.is_array() {
        return document.clone();
    }
    let mut merged = document.clone();
    for block in &mut merged.blocks {
        block.content = interpolate_value(&block.content, data);
        if let Some(props) = &mut block.properties {
            for value in props.values_mut() {
                *value = interpolate_value(value, data);
            }
        }
    }
    merged
}

/// Interpolate `{{path}}` references using a JSON value tree.
fn interpolate_value(text: &str, data: &serde_json::Value) -> String {
    if !text.contains("{{") {
        return text.to_string();
    }
    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '{' && chars.peek() == Some(&'{') {
            chars.next();
            let mut name = String::new();
            let mut closed = false;
            while let Some(inner) = chars.next() {
                if inner == '}' && chars.peek() == Some(&'}') {
                    chars.next();
                    closed = true;
                    break;
                }
                name.push(inner);
            }
            if closed {
                let path = name.trim();
                // Reject over-length paths
                let resolved = if path.len() > MAX_PATH_LEN {
                    None
                } else {
                    get_by_path(data, path).and_then(|v| match v {
                        serde_json::Value::String(s) => Some(s.clone()),
                        serde_json::Value::Number(n) => Some(n.to_string()),
                        serde_json::Value::Bool(b) => Some(b.to_string()),
                        serde_json::Value::Null => Some(String::new()),
                        _ => None,
                    })
                };
                match resolved {
                    Some(val) => result.push_str(&val),
                    None => result.push_str(&format!("{{{{{path}}}}}")),
                }
            } else {
                result.push_str(&format!("{{{{{name}"));
            }
        } else {
            result.push(ch);
        }
    }
    result
}

/// Merge template variables into a document.
///
/// Finds all `{{variable_name}}` patterns in block content and property values,
/// and replaces them with values from `vars`. Unresolved variables are left as-is.
pub fn merge(document: &IntentDocument, vars: &HashMap<String, String>) -> IntentDocument {
    let mut merged = document.clone();

    // Also merge in context variables from the document itself
    let mut all_vars = HashMap::new();
    if let Some(meta) = &document.metadata {
        if let Some(ctx) = &meta.context {
            for (k, v) in ctx {
                all_vars.insert(k.clone(), v.clone());
            }
        }
    }
    // Caller vars override document context
    for (k, v) in vars {
        all_vars.insert(k.clone(), v.clone());
    }

    for block in &mut merged.blocks {
        merge_block(block, &all_vars);
    }

    merged
}

fn merge_block(block: &mut IntentBlock, vars: &HashMap<String, String>) {
    block.content = interpolate(&block.content, vars);

    if let Some(props) = &mut block.properties {
        for value in props.values_mut() {
            *value = interpolate(value, vars);
        }
    }
}

/// Replace all `{{name}}` references in `text` with values from `vars`.
/// Unresolved references are left unchanged.
pub fn interpolate(text: &str, vars: &HashMap<String, String>) -> String {
    if !text.contains("{{") {
        return text.to_string();
    }

    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '{' && chars.peek() == Some(&'{') {
            chars.next(); // consume second {
            let mut name = String::new();
            let mut closed = false;
            while let Some(inner) = chars.next() {
                if inner == '}' && chars.peek() == Some(&'}') {
                    chars.next(); // consume second }
                    closed = true;
                    break;
                }
                name.push(inner);
            }
            if closed {
                let key = name.trim();
                if let Some(val) = vars.get(key) {
                    result.push_str(val);
                } else {
                    result.push_str(&format!("{{{{{key}}}}}"));
                }
            } else {
                result.push_str(&format!("{{{{{name}"));
            }
        } else {
            result.push(ch);
        }
    }

    result
}

/// Find all `{{variable_name}}` references in a document.
/// Returns a list of variable names (deduplicated).
pub fn find_template_variables(document: &IntentDocument) -> Vec<String> {
    let mut vars = std::collections::HashSet::new();

    for block in &document.blocks {
        find_vars_in_str(&block.content, &mut vars);
        if let Some(props) = &block.properties {
            for v in props.values() {
                find_vars_in_str(v, &mut vars);
            }
        }
    }

    let mut result: Vec<String> = vars.into_iter().collect();
    result.sort();
    result
}

/// Parse source and merge template variables from a JSON data object.
pub fn parse_and_merge(source: &str, data: &serde_json::Value) -> IntentDocument {
    let doc = parse(source, None);
    merge_value(&doc, data)
}

fn find_vars_in_str(s: &str, out: &mut std::collections::HashSet<String>) {
    let mut i = 0;
    while i < s.len() {
        if let Some(start) = s[i..].find("{{") {
            let start = i + start;
            if let Some(end) = s[start + 2..].find("}}") {
                let name = s[start + 2..start + 2 + end].trim().to_string();
                if !name.is_empty() {
                    out.insert(name);
                }
                i = start + 2 + end + 2;
            } else {
                break;
            }
        } else {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_interpolation() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "Ahmed".to_string());
        assert_eq!(interpolate("Hello {{name}}!", &vars), "Hello Ahmed!");
    }

    #[test]
    fn unresolved_left_unchanged() {
        let vars = HashMap::new();
        assert_eq!(interpolate("Hello {{name}}!", &vars), "Hello {{name}}!");
    }

    #[test]
    fn find_variables() {
        use crate::parser::parse;
        let doc = parse("text: Dear {{recipient}}, please review {{document}}.", None);
        let vars = find_template_variables(&doc);
        assert!(vars.contains(&"recipient".to_string()));
        assert!(vars.contains(&"document".to_string()));
    }

    // ── Security hardening (merge_value with JSON paths) ─────────────────────

    #[test]
    fn merge_value_nested_dot_path() {
        use crate::parser::parse;
        let doc = parse("note: {{a.b.c.d.e.f}}", None);
        let data = serde_json::json!({ "a": { "b": { "c": { "d": { "e": { "f": "found" } } } } } });
        let result = merge_value(&doc, &data);
        assert_eq!(result.blocks[0].content, "found");
    }

    #[test]
    fn merge_value_blocks_constructor_path() {
        use crate::parser::parse;
        let doc = parse("note: {{constructor.polluted}}", None);
        let data = serde_json::json!({ "constructor": { "polluted": "hacked" } });
        let result = merge_value(&doc, &data);
        assert_eq!(result.blocks[0].content, "{{constructor.polluted}}");
    }

    #[test]
    fn merge_value_blocks_proto_path() {
        use crate::parser::parse;
        let doc = parse("note: {{__proto__.x}}", None);
        let data = serde_json::json!({ "__proto__": { "x": "bad" } });
        let result = merge_value(&doc, &data);
        assert_eq!(result.blocks[0].content, "{{__proto__.x}}");
    }

    #[test]
    fn merge_value_rejects_long_path() {
        use crate::parser::parse;
        let long_path = vec!["a"; 201].join(".");
        let src = format!("note: {{{{{}}}}}", long_path);
        let doc = parse(&src, None);
        let data = serde_json::json!({});
        let result = merge_value(&doc, &data);
        // Path too long — left unresolved
        assert!(result.blocks[0].content.contains("{{"));
    }

    #[test]
    fn merge_value_rejects_negative_array_index() {
        use crate::parser::parse;
        let doc = parse("note: {{items.-1}}", None);
        let data = serde_json::json!({ "items": ["a", "b", "c"] });
        let result = merge_value(&doc, &data);
        assert_eq!(result.blocks[0].content, "{{items.-1}}");
    }

    #[test]
    fn merge_value_fast_path_no_braces() {
        use crate::parser::parse;
        let doc = parse("note: Plain text with no templates", None);
        let data = serde_json::json!({ "anything": "value" });
        let result = merge_value(&doc, &data);
        assert_eq!(result.blocks[0].content, "Plain text with no templates");
    }
}
