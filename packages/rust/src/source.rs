//! Round-trip serializer: IntentDocument → .it source text.
//!
//! Parity target: packages/core/src/source.ts (documentToSource).
//!
//! Contract: parse(to_source(parse(input))) == parse(input)
//! The serializer is deterministic. Block `id` is NOT emitted.

use crate::types::{IntentBlock, IntentDocument};
use std::collections::HashMap;

/// Convert a parsed IntentDocument back to .it source text.
pub fn to_source(document: &IntentDocument) -> String {
    let mut parts: Vec<String> = Vec::new();

    for block in &document.blocks {
        block_to_source_recursive(block, &mut parts);
    }

    parts.join("\n")
}

fn block_to_source_recursive(block: &IntentBlock, out: &mut Vec<String>) {
    let line = block_to_source(block);
    if !line.is_empty() {
        out.push(line);
    }
    if let Some(children) = &block.children {
        for child in children {
            block_to_source_recursive(child, out);
        }
    }
}

fn block_to_source(block: &IntentBlock) -> String {
    // Extension blocks: "x-ns: type content | props"
    if block.block_type.starts_with("x-") {
        return format_block_line(&block.block_type, &block.content, &block.properties);
    }

    match block.block_type.as_str() {
        "divider" => {
            let has_props = block
                .properties
                .as_ref()
                .map(|p| !p.is_empty())
                .unwrap_or(false);
            if has_props {
                return format_block_line("divider", "", &block.properties);
            }
            return "---".to_string();
        }

        "break" => {
            let has_props = block
                .properties
                .as_ref()
                .map(|p| !p.is_empty())
                .unwrap_or(false);
            if has_props {
                return format_block_line("break", "", &block.properties);
            }
            return "break:".to_string();
        }

        "code" => {
            let lang = block.prop("lang").unwrap_or("");
            let mut out = format!("```{lang}\n");
            out.push_str(&block.content);
            out.push_str("\n```");
            return out;
        }

        "columns" => {
            if let Some(table) = &block.table {
                let mut parts = Vec::new();
                if let Some(headers) = &table.headers {
                    let header_line = format!("columns: {}", headers.join(" | "));
                    parts.push(header_line);
                    for row in &table.rows {
                        parts.push(format!("row: {}", row.join(" | ")));
                    }
                }
                return parts.join("\n");
            }
        }

        // row: is serialized as part of the columns: block above
        "row" => return String::new(),

        _ => {}
    }

    format_block_line(&block.block_type, &block.content, &block.properties)
}

fn format_block_line(
    block_type: &str,
    content: &str,
    properties: &Option<HashMap<String, String>>,
) -> String {
    let mut line = format!("{block_type}:");

    let content = content.trim();
    if !content.is_empty() {
        line.push(' ');
        line.push_str(content);
    }

    if let Some(props) = properties {
        // Get ordered property keys
        let ordered = get_ordered_props(block_type, props);
        for key in ordered {
            if let Some(val) = props.get(&key) {
                // Skip the internal `id` property — it's auto-generated
                if key == "id" {
                    continue;
                }
                line.push_str(&format!(" | {key}: {val}"));
            }
        }
    }

    line
}

fn get_ordered_props(block_type: &str, props: &HashMap<String, String>) -> Vec<String> {
    let order = property_order(block_type);
    let mut result: Vec<String> = Vec::new();

    // First: ordered properties that exist on this block
    for &key in order {
        if props.contains_key(key) {
            result.push(key.to_string());
        }
    }

    // Then: remaining properties alphabetically
    let order_set: std::collections::HashSet<&str> = order.iter().copied().collect();
    let mut rest: Vec<&str> = props
        .keys()
        .filter(|k| !order_set.contains(k.as_str()) && k.as_str() != "id")
        .map(|k| k.as_str())
        .collect();
    rest.sort_unstable();
    result.extend(rest.iter().map(|s| s.to_string()));

    result
}

/// Canonical property ordering per block type.
/// Properties listed here are emitted first, in this order.
/// Unlisted properties follow alphabetically.
pub fn property_order(block_type: &str) -> &'static [&'static str] {
    // Strip x- prefix for extension block ordering
    let t = if let Some(rest) = block_type.strip_prefix("x-") {
        // "x-writer: byline" → "byline"
        rest.split_once(": ").map(|x| x.1).unwrap_or(block_type)
    } else {
        block_type
    };

    match t {
        "step" => &[
            "tool", "input", "output", "depends", "id", "status", "timeout",
        ],
        "task" => &["owner", "due", "priority", "status"],
        "done" => &["owner", "time"],
        "decision" => &["if", "then", "else"],
        "trigger" => &["event", "condition"],
        "gate" => &["id", "approver", "timeout", "fallback"],
        "result" => &["status", "message"],
        "policy" => &[
            "requires", "gate", "if", "always", "never", "action", "notify", "priority", "scope",
            "after", "id",
        ],
        "audit" => &["by", "at", "action"],
        "image" => &["src", "caption", "width", "height"],
        "link" => &["to"],
        "quote" => &["by"],
        "page" => &["size", "margin", "orientation"],
        "header" => &["align", "show-on"],
        "footer" => &["align", "show-on"],
        "watermark" => &["opacity", "color", "angle"],
        "sign" => &["role", "at", "hash"],
        "approve" => &["by", "role", "at", "ref"],
        "freeze" => &["status", "at", "hash"],
        "track" => &["version", "by"],
        "amendment" => &[
            "section",
            "was",
            "now",
            "ref",
            "by",
            "at",
            "approved-by",
            "hash",
        ],
        "metric" => &["value", "target", "status", "trend", "unit"],
        "cite" => &["author", "date", "url"],
        "code" => &["lang"],
        _ => &[],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn round_trip_simple() {
        let source = "title: My Document\ntext: Hello world";
        let doc = parse(source, None);
        let output = to_source(&doc);
        let doc2 = parse(&output, None);
        assert_eq!(doc.blocks.len(), doc2.blocks.len());
        assert_eq!(doc.blocks[0].content, doc2.blocks[0].content);
    }

    #[test]
    fn round_trip_with_properties() {
        let source = "step: Deploy to production | tool: kubectl | id: deploy | timeout: 30m";
        let doc = parse(source, None);
        let output = to_source(&doc);
        assert!(output.contains("step: Deploy to production"));
        assert!(output.contains("tool: kubectl"));
        assert!(output.contains("timeout: 30m"));
    }

    #[test]
    fn divider_round_trips() {
        let source = "text: above\n---\ntext: below";
        let doc = parse(source, None);
        let output = to_source(&doc);
        assert!(output.contains("---"));
    }

    #[test]
    fn code_block_round_trip() {
        let source = "```rust\nlet x = 1;\n```";
        let doc = parse(source, None);
        let output = to_source(&doc);
        assert!(output.contains("```rust"));
        assert!(output.contains("let x = 1;"));
    }
}
