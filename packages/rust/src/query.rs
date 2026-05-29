//! Query engine — filter, sort, paginate blocks.
//!
//! Parity target: packages/core/src/query.ts

use crate::types::{IntentBlock, IntentDocument};

/// Options controlling which blocks are returned and in what order.
#[derive(Debug, Clone, Default)]
pub struct QueryOptions {
    /// Filter to blocks whose `block_type` equals this value.
    pub block_type: Option<String>,
    /// Filter to blocks in a named section (content of a `section:` block).
    pub section: Option<String>,
    /// Filter to blocks whose properties match all given key-value pairs.
    pub properties: Option<Vec<(String, String)>>,
    /// Full-text search; filter to blocks whose content contains this string (case-insensitive).
    pub search: Option<String>,
    /// Maximum number of results to return.
    pub limit: Option<usize>,
    /// Number of results to skip (for pagination).
    pub offset: Option<usize>,
    /// Property name to sort by.
    pub sort_by: Option<String>,
    /// Ascending (`"asc"`) or descending (`"desc"`). Defaults to ascending.
    pub sort_order: Option<String>,
    /// Filter to blocks whose block_type is in this set.
    pub types: Option<Vec<String>>,
    /// If true, skip history, divider, revision, and internal blocks.
    pub content_only: Option<bool>,
}

/// Query result wrapping matched blocks with match metadata.
#[derive(Debug, Clone)]
pub struct QueryResult<'a> {
    pub blocks: Vec<&'a IntentBlock>,
    pub total: usize,
}

static INTERNAL_TYPES: &[&str] = &["history", "divider", "revision"];

/// Execute a query against a document and return matching blocks.
pub fn query<'a>(document: &'a IntentDocument, options: &QueryOptions) -> QueryResult<'a> {
    let mut results: Vec<&'a IntentBlock> = Vec::new();
    let mut current_section: Option<&str> = None;

    let content_only = options.content_only.unwrap_or(false);

    for block in &document.blocks {
        // Track current section
        if block.block_type == "section" {
            current_section = Some(block.content.as_str());
        }

        // Skip internal blocks if content_only
        if content_only && INTERNAL_TYPES.contains(&block.block_type.as_str()) {
            continue;
        }

        // type filter (singular)
        if let Some(t) = &options.block_type {
            if &block.block_type != t {
                continue;
            }
        }

        // types filter (plural — any match)
        if let Some(types) = &options.types {
            if !types.iter().any(|t| t == &block.block_type) {
                continue;
            }
        }

        // section filter
        if let Some(section_name) = &options.section {
            match current_section {
                Some(s) if s.eq_ignore_ascii_case(section_name) => {}
                _ => continue,
            }
        }

        // properties filter — all pairs must match
        if let Some(filter_props) = &options.properties {
            if let Some(props) = &block.properties {
                let all_match = filter_props.iter().all(|(k, v)| {
                    props
                        .get(k)
                        .map(|pv| pv.eq_ignore_ascii_case(v))
                        .unwrap_or(false)
                });
                if !all_match {
                    continue;
                }
            } else {
                continue;
            }
        }

        // full-text search
        if let Some(q) = &options.search {
            let q_lower = q.to_lowercase();
            let in_content = block.content.to_lowercase().contains(&q_lower);
            let in_props = block
                .properties
                .as_ref()
                .map(|p| p.values().any(|v| v.to_lowercase().contains(&q_lower)))
                .unwrap_or(false);
            if !in_content && !in_props {
                continue;
            }
        }

        results.push(block);
    }

    // Sort
    if let Some(sort_key) = &options.sort_by {
        let descending = options.sort_order.as_deref() == Some("desc");
        results.sort_by(|a, b| {
            let va = get_sort_value(a, sort_key);
            let vb = get_sort_value(b, sort_key);
            let ord = va.cmp(&vb);
            if descending {
                ord.reverse()
            } else {
                ord
            }
        });
    }

    let total = results.len();

    // Offset and limit
    let offset = options.offset.unwrap_or(0);
    let results = if offset < results.len() {
        &results[offset..]
    } else {
        &[][..]
    };

    let results = if let Some(limit) = options.limit {
        &results[..limit.min(results.len())]
    } else {
        results
    };

    QueryResult {
        blocks: results.to_vec(),
        total,
    }
}

fn get_sort_value(block: &IntentBlock, key: &str) -> String {
    match key {
        "type" | "block_type" => block.block_type.clone(),
        "content" => block.content.clone(),
        _ => block
            .properties
            .as_ref()
            .and_then(|p| p.get(key))
            .cloned()
            .unwrap_or_default(),
    }
}

/// Get all blocks of a given type.
pub fn get_by_type<'a>(document: &'a IntentDocument, block_type: &str) -> Vec<&'a IntentBlock> {
    document
        .blocks
        .iter()
        .filter(|b| b.block_type == block_type)
        .collect()
}

/// Get the first block with matching type, if any.
pub fn first_by_type<'a>(
    document: &'a IntentDocument,
    block_type: &str,
) -> Option<&'a IntentBlock> {
    document.blocks.iter().find(|b| b.block_type == block_type)
}

/// Find a block by its `id` property.
pub fn find_block_by_id<'a>(document: &'a IntentDocument, id: &str) -> Option<&'a IntentBlock> {
    document.blocks.iter().find(|b| {
        b.properties
            .as_ref()
            .and_then(|p| p.get("id"))
            .map(|v| v == id)
            .unwrap_or(false)
    })
}

/// Execute a query string against a document.
pub fn query_document<'a>(document: &'a IntentDocument, query_string: &str) -> QueryResult<'a> {
    let opts = parse_query(query_string);
    query(document, &opts)
}

/// Format query results as a simple human-readable list.
pub fn format_query_result(result: &QueryResult<'_>) -> String {
    if result.blocks.is_empty() {
        return "No matching blocks".to_string();
    }
    let mut out = String::new();
    out.push_str(&format!("{} match(es)\n", result.total));
    for b in &result.blocks {
        out.push_str(&format!("- [{}] {}", b.block_type, b.content));
        if let Some(props) = &b.properties {
            if !props.is_empty() {
                let mut kv: Vec<String> = props.iter().map(|(k, v)| format!("{k}: {v}")).collect();
                kv.sort();
                out.push_str(&format!(" | {}", kv.join(" | ")));
            }
        }
        out.push('\n');
    }
    out.trim_end().to_string()
}

// ── String query parser ───────────────────────────────────────────────────────

/// Parse a simple query string into `QueryOptions`.
///
/// Syntax:  `type=task owner=Ahmed sort:due:asc limit:10 offset:0`
///
/// Returns an empty `QueryOptions` for empty / invalid input.
/// Caps input at 10,000 characters to prevent abuse.
pub fn parse_query(s: &str) -> QueryOptions {
    const MAX_QUERY_LEN: usize = 10_000;
    if s.is_empty() {
        return QueryOptions::default();
    }
    let capped: &str = if s.len() > MAX_QUERY_LEN {
        &s[..MAX_QUERY_LEN]
    } else {
        s
    };

    let mut opts = QueryOptions::default();

    for part in capped.split_whitespace() {
        if let Some(rest) = part.strip_prefix("sort:") {
            // sort:field or sort:field:asc|desc
            let mut iter = rest.splitn(2, ':');
            if let Some(field) = iter.next() {
                let direction = iter.next().unwrap_or("asc").to_lowercase();
                opts.sort_by = Some(field.to_string());
                opts.sort_order = Some(if direction == "desc" {
                    "desc".to_string()
                } else {
                    "asc".to_string()
                });
            }
        } else if let Some(rest) = part.strip_prefix("limit:") {
            if let Ok(n) = rest.parse::<usize>() {
                opts.limit = Some(n);
            }
        } else if let Some(rest) = part.strip_prefix("offset:") {
            if let Ok(n) = rest.parse::<usize>() {
                opts.offset = Some(n);
            }
        } else if let Some(eq_pos) = part.find('=') {
            let key = &part[..eq_pos];
            let val = &part[eq_pos + 1..];
            match key {
                "type" => opts.block_type = Some(val.to_string()),
                "search" => opts.search = Some(val.to_string()),
                "section" => opts.section = Some(val.to_string()),
                _ => {}
            }
        }
    }

    opts
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn filter_by_type() {
        let doc = parse("text: hello\ntask: buy milk\ntask: write tests", None);
        let r = query(
            &doc,
            &QueryOptions {
                block_type: Some("task".to_string()),
                ..Default::default()
            },
        );
        assert_eq!(r.blocks.len(), 2);
        assert_eq!(r.total, 2);
    }

    #[test]
    fn filter_by_property() {
        let doc = parse(
            "task: buy milk | priority: high\ntask: write tests | priority: low",
            None,
        );
        let r = query(
            &doc,
            &QueryOptions {
                properties: Some(vec![("priority".to_string(), "high".to_string())]),
                ..Default::default()
            },
        );
        assert_eq!(r.blocks.len(), 1);
        assert_eq!(r.blocks[0].content, "buy milk");
    }

    #[test]
    fn search_content() {
        let doc = parse("text: Hello World\ntext: Goodbye", None);
        let r = query(
            &doc,
            &QueryOptions {
                search: Some("hello".to_string()),
                ..Default::default()
            },
        );
        assert_eq!(r.blocks.len(), 1);
    }

    #[test]
    fn limit_offset() {
        let doc = parse("task: a\ntask: b\ntask: c\ntask: d", None);
        let r = query(
            &doc,
            &QueryOptions {
                block_type: Some("task".to_string()),
                limit: Some(2),
                offset: Some(1),
                ..Default::default()
            },
        );
        assert_eq!(r.total, 4);
        assert_eq!(r.blocks.len(), 2);
        assert_eq!(r.blocks[0].content, "b");
    }

    #[test]
    fn find_by_id() {
        let doc = parse("task: Review PR | id: t-01", None);
        let block = find_block_by_id(&doc, "t-01");
        assert!(block.is_some());
        assert_eq!(block.unwrap().content, "Review PR");
    }

    // ── Security hardening ────────────────────────────────────────────────────

    #[test]
    fn parse_query_empty_string() {
        let opts = parse_query("");
        assert!(opts.block_type.is_none());
        assert!(opts.search.is_none());
    }

    #[test]
    fn parse_query_type_filter() {
        let opts = parse_query("type=task");
        assert_eq!(opts.block_type, Some("task".to_string()));
    }

    #[test]
    fn parse_query_sort_limit_offset() {
        let opts = parse_query("type=note sort:content:desc limit:5 offset:10");
        assert_eq!(opts.sort_by, Some("content".to_string()));
        assert_eq!(opts.sort_order, Some("desc".to_string()));
        assert_eq!(opts.limit, Some(5));
        assert_eq!(opts.offset, Some(10));
    }

    #[test]
    fn parse_query_oversized_does_not_panic() {
        let long = "type=task ".repeat(2000);
        let opts = parse_query(&long);
        // Should not panic; block_type is defined
        assert!(opts.block_type.is_some());
    }

    #[test]
    fn query_empty_document_returns_empty() {
        let doc = parse("", None);
        let r = query(
            &doc,
            &QueryOptions {
                block_type: Some("task".to_string()),
                ..Default::default()
            },
        );
        assert_eq!(r.blocks.len(), 0);
        assert_eq!(r.total, 0);
    }
}
