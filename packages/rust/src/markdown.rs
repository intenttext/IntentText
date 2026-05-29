//! Markdown -> IntentText converter.
//!
//! Parity target: packages/core/src/markdown.ts

/// Convert Markdown source into IntentText source.
pub fn convert_markdown_to_intenttext(markdown: &str) -> String {
    if markdown.is_empty() {
        return String::new();
    }

    let lines: Vec<&str> = markdown.lines().collect();
    let mut out: Vec<String> = Vec::new();
    let mut in_code_block = false;
    let mut code_lines: Vec<String> = Vec::new();

    for (i, raw) in lines.iter().enumerate() {
        let trimmed = raw.trim();

        if trimmed.starts_with("```") {
            if !in_code_block {
                in_code_block = true;
                continue;
            }
            in_code_block = false;
            out.push("code:".to_string());
            out.append(&mut code_lines);
            out.push("end:".to_string());
            continue;
        }

        if in_code_block {
            code_lines.push((*raw).to_string());
            continue;
        }

        if trimmed.is_empty() {
            out.push(String::new());
            continue;
        }

        if is_horizontal_rule(trimmed) {
            out.push("---".to_string());
            continue;
        }

        if let Some((level, text)) = parse_heading(trimmed) {
            let text = convert_inline(text);
            if level == 1 {
                out.push(format!("title: {text}"));
            } else if level == 2 {
                out.push(format!("section: {text}"));
            } else {
                out.push(format!("sub: {text}"));
            }
            continue;
        }

        if let Some((alt, url)) = parse_image(trimmed) {
            out.push(format!("image: {} | src: {}", convert_inline(&alt), url));
            continue;
        }

        if let Some((label, url)) = parse_link(trimmed) {
            out.push(format!("link: {} | to: {}", convert_inline(&label), url));
            continue;
        }

        if let Some(item) = parse_unordered_list(trimmed) {
            out.push(format!("- {}", convert_inline(item)));
            continue;
        }

        if let Some((n, item)) = parse_ordered_list(trimmed) {
            out.push(format!("{}. {}", n, convert_inline(item)));
            continue;
        }

        if let Some(text) = trimmed.strip_prefix('>') {
            out.push(format!("quote: {}", convert_inline(text.trim())));
            continue;
        }

        if is_table_row(trimmed) {
            if !is_table_separator(trimmed) {
                let cells: Vec<String> = split_table_cells(trimmed)
                    .into_iter()
                    .map(|s| convert_inline(&s))
                    .collect();
                let is_header = i + 1 < lines.len() && is_table_separator(lines[i + 1].trim());
                if is_header {
                    out.push(format!("headers: {}", cells.join(" | ")));
                } else {
                    out.push(format!("row: {}", cells.join(" | ")));
                }
            }
            continue;
        }

        out.push(format!("note: {}", convert_inline(trimmed)));
    }

    if in_code_block {
        out.push("code:".to_string());
        out.append(&mut code_lines);
        out.push("end:".to_string());
    }

    while matches!(out.last(), Some(last) if last.is_empty()) {
        out.pop();
    }

    out.join("\n")
}

fn is_horizontal_rule(s: &str) -> bool {
    let dashes = s.chars().all(|c| c == '-') && s.len() >= 3;
    let stars = s.chars().all(|c| c == '*') && s.len() >= 3;
    let underscores = s.chars().all(|c| c == '_') && s.len() >= 3;
    dashes || stars || underscores
}

fn parse_heading(s: &str) -> Option<(usize, &str)> {
    let hashes = s.chars().take_while(|c| *c == '#').count();
    if hashes == 0 || hashes > 6 {
        return None;
    }
    let rest = s[hashes..].trim_start();
    if rest.is_empty() {
        return None;
    }
    Some((hashes, rest))
}

fn parse_image(s: &str) -> Option<(String, String)> {
    if !s.starts_with("![") {
        return None;
    }
    let close = s.find("](")?;
    let alt = &s[2..close];
    let end = s[close + 2..].strip_suffix(')')?;
    Some((alt.trim().to_string(), end.trim().to_string()))
}

fn parse_link(s: &str) -> Option<(String, String)> {
    if !s.starts_with('[') {
        return None;
    }
    let close = s.find("](")?;
    let label = &s[1..close];
    let end = s[close + 2..].strip_suffix(')')?;
    Some((label.trim().to_string(), end.trim().to_string()))
}

fn parse_unordered_list(s: &str) -> Option<&str> {
    if s.len() > 2 && (s.starts_with("- ") || s.starts_with("* ") || s.starts_with("+ ")) {
        return Some(&s[2..]);
    }
    None
}

fn parse_ordered_list(s: &str) -> Option<(usize, &str)> {
    let dot = s.find('.')?;
    let n = s[..dot].parse::<usize>().ok()?;
    let rest = s[dot + 1..].trim_start();
    if rest.is_empty() {
        return None;
    }
    Some((n, rest))
}

fn is_table_row(s: &str) -> bool {
    s.starts_with('|') && s.ends_with('|') && s.len() >= 2
}

fn is_table_separator(s: &str) -> bool {
    s.starts_with('|')
        && s.ends_with('|')
        && s[1..s.len() - 1]
            .chars()
            .all(|c| c == ' ' || c == '-' || c == ':' || c == '|')
}

fn split_table_cells(s: &str) -> Vec<String> {
    s[1..s.len() - 1]
        .split('|')
        .map(|c| c.trim().to_string())
        .collect()
}

fn convert_inline(text: &str) -> String {
    let mut result = text.to_string();
    result = replace_inline_code(&result);
    result = result.replace("~~", "~");
    result
}

fn replace_inline_code(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '`' {
            let mut code = String::new();
            let mut closed = false;
            for c in chars.by_ref() {
                if c == '`' {
                    closed = true;
                    break;
                }
                code.push(c);
            }
            if closed {
                out.push_str("```");
                out.push_str(&code);
                out.push_str("```");
            } else {
                out.push('`');
                out.push_str(&code);
            }
        } else {
            out.push(ch);
        }
    }
    out
}
