//! Safe parse wrapper parity surface.

use crate::keywords::KEYWORDS;
use crate::parser::parse;
use crate::types::IntentDocument;

#[derive(Debug, Clone)]
pub struct SafeParseOptions {
    pub unknown_keyword: String,
    pub max_blocks: usize,
    pub max_line_length: usize,
    pub strict: bool,
}

impl Default for SafeParseOptions {
    fn default() -> Self {
        Self {
            unknown_keyword: "note".to_string(),
            max_blocks: 10_000,
            max_line_length: 50_000,
            strict: false,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct ParseWarning {
    pub line: usize,
    pub message: String,
    pub code: String,
    pub original: String,
}

#[derive(Debug, Clone, Default)]
pub struct ParseError {
    pub line: usize,
    pub message: String,
    pub code: String,
    pub original: String,
}

#[derive(Debug, Clone, Default)]
pub struct SafeParseResult {
    pub document: IntentDocument,
    pub warnings: Vec<ParseWarning>,
    pub errors: Vec<ParseError>,
}

pub fn parse_intent_text_safe(source: &str, options: Option<SafeParseOptions>) -> SafeParseResult {
    let opts = options.unwrap_or_default();
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    if source.is_empty() {
        return SafeParseResult {
            document: IntentDocument::default(),
            warnings,
            errors,
        };
    }

    let known: std::collections::HashSet<&str> = KEYWORDS.iter().copied().collect();
    let mut lines_out = Vec::new();

    for (idx, raw_line) in source.lines().enumerate() {
        let mut line = raw_line.to_string();
        if line.len() > opts.max_line_length {
            warnings.push(ParseWarning {
                line: idx + 1,
                message: format!(
                    "Line truncated from {} to {} characters",
                    line.len(),
                    opts.max_line_length
                ),
                code: "LINE_TRUNCATED".to_string(),
                original: line.chars().take(200).collect::<String>(),
            });
            line = line.chars().take(opts.max_line_length).collect();
        }

        if let Some((kw, _)) = line.split_once(':') {
            let kw = kw.trim().to_ascii_lowercase();
            if !kw.starts_with("x-") && !known.contains(kw.as_str()) && !line.trim().starts_with("//") {
                let entry = ParseError {
                    line: idx + 1,
                    message: format!("Unknown keyword: \"{}\"", kw),
                    code: "UNKNOWN_KEYWORD".to_string(),
                    original: line.clone(),
                };
                if opts.strict || opts.unknown_keyword == "throw" {
                    errors.push(entry);
                } else {
                    warnings.push(ParseWarning {
                        line: entry.line,
                        message: entry.message,
                        code: entry.code,
                        original: entry.original,
                    });
                }

                if opts.unknown_keyword == "skip" {
                    continue;
                }
                if opts.unknown_keyword == "note" {
                    let content = line.split_once(':').map(|(_, c)| c.trim()).unwrap_or("");
                    line = format!("text: {content}");
                }
            }
        }
        lines_out.push(line);
    }

    let mut document = parse(&lines_out.join("\n"), None);
    if document.blocks.len() > opts.max_blocks {
        warnings.push(ParseWarning {
            line: 0,
            message: format!(
                "Document has {} blocks, truncated to {}",
                document.blocks.len(),
                opts.max_blocks
            ),
            code: "MAX_BLOCKS_REACHED".to_string(),
            original: String::new(),
        });
        document.blocks.truncate(opts.max_blocks);
    }

    SafeParseResult {
        document,
        warnings,
        errors,
    }
}
