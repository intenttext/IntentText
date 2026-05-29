//! Inline formatting parser — parses rich text from block content strings.
//!
//! Parses content fields into InlineNode sequences.
//! Parity target: packages/core/src/inline.ts (or inline logic in parser.ts).
//!
//! Supported syntax:
//!   *text*        → Bold
//!   _text_        → Italic
//!   ~text~        → Strike
//!   `code`        → Code
//!   ==text==      → InlineQuote
//!   ^text^        → Highlight
//!   [[note]]      → InlineNote
//!   @name         → Mention
//!   #tag          → Tag
//!   [label]       → Label (single word in brackets)
//!   [text](url)   → Link
//!   [^text]       → FootnoteRef
//!   2024-01-15    → Date (ISO 8601)

use crate::types::InlineNode;

/// Parse a content string into inline nodes.
/// Returns a single Text node if no inline markup is found.
pub fn parse_inline(content: &str) -> Vec<InlineNode> {
    if content.is_empty() {
        return vec![];
    }

    let chars: Vec<char> = content.chars().collect();
    let mut nodes: Vec<InlineNode> = Vec::new();
    let mut pos = 0;
    let mut text_start = 0;

    macro_rules! flush_text {
        () => {
            if text_start < pos {
                let s: String = chars[text_start..pos].iter().collect();
                if !s.is_empty() {
                    nodes.push(InlineNode::Text { value: s });
                }
            }
        };
    }

    while pos < chars.len() {
        let ch = chars[pos];

        // *bold*
        if ch == '*' {
            if let Some(end) = find_closing_single(&chars, pos + 1, '*') {
                flush_text!();
                let value: String = chars[pos + 1..end].iter().collect();
                nodes.push(InlineNode::Bold { value });
                pos = end + 1;
                text_start = pos;
                continue;
            }
        }

        // _italic_ (not preceded by word char to avoid mid-word underscore)
        if ch == '_' {
            if let Some(end) = find_closing_single(&chars, pos + 1, '_') {
                flush_text!();
                let value: String = chars[pos + 1..end].iter().collect();
                nodes.push(InlineNode::Italic { value });
                pos = end + 1;
                text_start = pos;
                continue;
            }
        }

        // ~strike~
        if ch == '~' {
            if let Some(end) = find_closing_single(&chars, pos + 1, '~') {
                flush_text!();
                let value: String = chars[pos + 1..end].iter().collect();
                nodes.push(InlineNode::Strike { value });
                pos = end + 1;
                text_start = pos;
                continue;
            }
        }

        // `code`
        if ch == '`' {
            if let Some(end) = find_closing_single(&chars, pos + 1, '`') {
                flush_text!();
                let value: String = chars[pos + 1..end].iter().collect();
                nodes.push(InlineNode::Code { value });
                pos = end + 1;
                text_start = pos;
                continue;
            }
        }

        // ==inline quote==
        if ch == '=' && pos + 1 < chars.len() && chars[pos + 1] == '=' {
            if let Some(end) = find_closing(&chars, pos + 2, "==") {
                flush_text!();
                let value: String = chars[pos + 2..end].iter().collect();
                nodes.push(InlineNode::InlineQuote { value });
                pos = end + 2;
                text_start = pos;
                continue;
            }
        }

        // ^highlight^
        if ch == '^' {
            if let Some(end) = find_closing_single(&chars, pos + 1, '^') {
                flush_text!();
                let value: String = chars[pos + 1..end].iter().collect();
                nodes.push(InlineNode::Highlight { value });
                pos = end + 1;
                text_start = pos;
                continue;
            }
        }

        // [[note]]
        if ch == '[' && pos + 1 < chars.len() && chars[pos + 1] == '[' {
            if let Some(end) = find_closing(&chars, pos + 2, "]]") {
                flush_text!();
                let value: String = chars[pos + 2..end].iter().collect();
                // [[label|url]] parity: treat as inline link when pipe is present.
                if let Some(pipe_idx) = value.find('|') {
                    let label = value[..pipe_idx].trim().to_string();
                    let href = value[pipe_idx + 1..].trim().to_string();
                    if !label.is_empty() && !href.is_empty() {
                        nodes.push(InlineNode::Link { value: label, href });
                    } else {
                        nodes.push(InlineNode::InlineNote { value });
                    }
                } else {
                    nodes.push(InlineNode::InlineNote { value });
                }
                pos = end + 2;
                text_start = pos;
                continue;
            }
        }

        // [^footnote-ref]
        if ch == '[' && pos + 1 < chars.len() && chars[pos + 1] == '^' {
            if let Some(end) = find_closing_single(&chars, pos + 2, ']') {
                flush_text!();
                let value: String = chars[pos + 2..end].iter().collect();
                nodes.push(InlineNode::FootnoteRef { value });
                pos = end + 1;
                text_start = pos;
                continue;
            }
        }

        // [text](url) or [label]
        if ch == '[' {
            if let Some(bracket_end) = find_closing_single(&chars, pos + 1, ']') {
                let inner: String = chars[pos + 1..bracket_end].iter().collect();
                // Check for (url) immediately after ]
                if bracket_end + 1 < chars.len() && chars[bracket_end + 1] == '(' {
                    if let Some(paren_end) = find_closing_single(&chars, bracket_end + 2, ')') {
                        flush_text!();
                        let href: String = chars[bracket_end + 2..paren_end].iter().collect();
                        nodes.push(InlineNode::Link { value: inner, href });
                        pos = paren_end + 1;
                        text_start = pos;
                        continue;
                    }
                }
                // Single-word label [label] — no spaces
                if !inner.contains(' ') && !inner.is_empty() {
                    flush_text!();
                    nodes.push(InlineNode::Label { value: inner });
                    pos = bracket_end + 1;
                    text_start = pos;
                    continue;
                }
            }
        }

        // Date shorthand @today/@tomorrow/@YYYY-MM-DD
        if ch == '@' {
            if let Some((display, iso, len)) = try_parse_date_shorthand(&chars, pos) {
                flush_text!();
                nodes.push(InlineNode::Date {
                    value: display,
                    iso,
                });
                pos += len;
                text_start = pos;
                continue;
            }
        }

        // @mention
        if ch == '@' && pos + 1 < chars.len() && is_word_char(chars[pos + 1]) {
            flush_text!();
            let end = take_word(&chars, pos + 1);
            let value: String = chars[pos + 1..end].iter().collect();
            nodes.push(InlineNode::Mention { value });
            pos = end;
            text_start = pos;
            continue;
        }

        // #tag
        if ch == '#' && pos + 1 < chars.len() && is_word_char(chars[pos + 1]) {
            flush_text!();
            let end = take_word(&chars, pos + 1);
            let value: String = chars[pos + 1..end].iter().collect();
            nodes.push(InlineNode::Tag { value });
            pos = end;
            text_start = pos;
            continue;
        }

        // ISO date — YYYY-MM-DD optionally followed by T...
        if ch.is_ascii_digit() && pos + 9 < chars.len() {
            if let Some((raw, iso, len)) = try_parse_date(&chars, pos) {
                flush_text!();
                nodes.push(InlineNode::Date { value: raw, iso });
                pos += len;
                text_start = pos;
                continue;
            }
        }

        pos += 1;
    }

    // Flush remaining text
    if text_start < chars.len() {
        let s: String = chars[text_start..].iter().collect();
        if !s.is_empty() {
            nodes.push(InlineNode::Text { value: s });
        }
    }

    nodes
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Find the index where `pattern` starts, searching from `from`.
fn find_closing(chars: &[char], from: usize, pattern: &str) -> Option<usize> {
    let pat: Vec<char> = pattern.chars().collect();
    let mut i = from;
    while i + pat.len() <= chars.len() {
        if chars[i..i + pat.len()] == pat[..] {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// Find the next occurrence of `close_char` starting at `from`.
fn find_closing_single(chars: &[char], from: usize, close: char) -> Option<usize> {
    (from..chars.len()).find(|&i| chars[i] == close)
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '-'
}

fn take_word(chars: &[char], from: usize) -> usize {
    let mut i = from;
    while i < chars.len() && is_word_char(chars[i]) {
        i += 1;
    }
    i
}

/// Try to parse an ISO 8601 date starting at `pos`.
/// Returns (display_value, iso_string, char_length) on success.
fn try_parse_date(chars: &[char], pos: usize) -> Option<(String, String, usize)> {
    // Minimum: YYYY-MM-DD = 10 chars
    if pos + 10 > chars.len() {
        return None;
    }
    // Check YYYY-MM-DD pattern
    let year: String = chars[pos..pos + 4].iter().collect();
    if !year.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    if chars[pos + 4] != '-' {
        return None;
    }
    let month: String = chars[pos + 5..pos + 7].iter().collect();
    if !month.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    if chars[pos + 7] != '-' {
        return None;
    }
    let day: String = chars[pos + 8..pos + 10].iter().collect();
    if !day.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    let base = format!("{year}-{month}-{day}");

    // Optionally consume T... time portion
    if pos + 10 < chars.len() && chars[pos + 10] == 'T' {
        let mut i = pos + 11;
        while i < chars.len()
            && (chars[i].is_ascii_digit() || matches!(chars[i], ':' | 'Z' | '+' | '-' | '.'))
        {
            i += 1;
        }
        if i > pos + 10 {
            let full: String = chars[pos..i].iter().collect();
            let iso = full.clone();
            return Some((full, iso, i - pos));
        }
    }

    let iso = format!("{base}T00:00:00.000Z");
    Some((base, iso, 10))
}

fn try_parse_date_shorthand(chars: &[char], pos: usize) -> Option<(String, String, usize)> {
    if chars.get(pos).copied()? != '@' {
        return None;
    }
    let tail: String = chars[pos + 1..].iter().collect();
    let lower = tail.to_ascii_lowercase();
    if lower.starts_with("today") {
        let today = chrono::Utc::now().date_naive().to_string();
        return Some(("@today".to_string(), today, 6));
    }
    if lower.starts_with("tomorrow") {
        let tomorrow = (chrono::Utc::now().date_naive() + chrono::Days::new(1)).to_string();
        return Some(("@tomorrow".to_string(), tomorrow, 9));
    }
    if tail.len() >= 10 {
        let token: String = tail.chars().take(10).collect();
        if token.chars().enumerate().all(|(i, c)| {
            if i == 4 || i == 7 {
                c == '-'
            } else {
                c.is_ascii_digit()
            }
        }) {
            return Some((format!("@{token}"), token, 11));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text() {
        let nodes = parse_inline("hello world");
        assert_eq!(
            nodes,
            vec![InlineNode::Text {
                value: "hello world".to_string()
            }]
        );
    }

    #[test]
    fn bold() {
        let nodes = parse_inline("say **hello** now");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Bold { value } if value == "hello")));
    }

    #[test]
    fn italic() {
        let nodes = parse_inline("_italic text_");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Italic { value } if value == "italic text")));
    }

    #[test]
    fn inline_code() {
        let nodes = parse_inline("use `cargo build` to compile");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Code { value } if value == "cargo build")));
    }

    #[test]
    fn link() {
        let nodes = parse_inline("[docs](https://intenttext.dev)");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Link { value, href }
            if value == "docs" && href == "https://intenttext.dev")));
    }

    #[test]
    fn mention() {
        let nodes = parse_inline("ping @ahmed today");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Mention { value } if value == "ahmed")));
    }

    #[test]
    fn tag() {
        let nodes = parse_inline("file this under #legal");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Tag { value } if value == "legal")));
    }

    #[test]
    fn date() {
        let nodes = parse_inline("due 2026-03-09");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Date { value, .. } if value == "2026-03-09")));
    }

    #[test]
    fn highlight() {
        let nodes = parse_inline("==important==");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::Highlight { value } if value == "important")));
    }

    #[test]
    fn inline_note() {
        let nodes = parse_inline("see ((note here))");
        assert!(nodes
            .iter()
            .any(|n| matches!(n, InlineNode::InlineNote { value } if value == "note here")));
    }
}
