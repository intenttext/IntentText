//! Core parser — single-pass, line-by-line.
//!
//! Parity target: packages/core/src/parser.ts
//!
//! Algorithm:
//!   1. Split source into lines.
//!   2. For each line:
//!      a. If in a code fence → collect raw content until closing ```.
//!      b. If line == "---" → divider block.
//!      c. If line matches /^([a-z][a-z0-9-]*):(.*)/ → new block start.
//!         - Resolve keyword via keywords::resolve_keyword().
//!         - Parse properties from rest (pipe-separated key: value segments).
//!      d. If line is indented (2+ spaces or tab) → continuation.
//!      e. Blank line → end current block.
//!   3. Post-process: run inline parser on content fields.
//!   4. Build document metadata from header blocks.
//!   5. If include_history_section: parse the history section.
//!
//! Extension blocks:
//!   Lines matching `x-{namespace}: {type}` are parsed as extension blocks.
//!   The block_type is set to "x-{namespace}: {type}" (the full form).

use std::collections::HashMap;

use crate::inline::parse_inline;
use crate::keywords::{resolve_keyword, KeywordResolution};
use crate::types::{
    Diagnostic, DiagnosticCode, DiagnosticSeverity, DocumentMetadata, FreezeState, HistorySection,
    IntentBlock, IntentDocument, ParseOptions, RegistryEntry, RevisionEntry, Signature, TableData,
    TrackingState,
};

// ── Public API ────────────────────────────────────────────────────────────────

/// Parse `.it` source text into a structured IntentDocument.
/// Never panics. Errors are returned as diagnostics on the returned document.
pub fn parse(source: &str, options: Option<ParseOptions>) -> IntentDocument {
    let opts = options.unwrap_or_default();
    let mut ctx = ParseContext::new(opts);
    ctx.parse_source(source)
}

/// Compatibility no-op: parser IDs are already reset per parse call.
pub fn reset_id_counter() {}

/// Detect history boundary line index in parsed source lines.
pub fn detect_history_boundary(lines: &[&str]) -> isize {
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed == "history:" || trimmed == "history: " {
            return i as isize;
        }
        if trimmed == "---" && i + 1 < lines.len() {
            let next = lines[i + 1].trim();
            if next == "// history" || next.starts_with("// history") {
                return i as isize;
            }
        }
    }
    -1
}

// ── ParseContext ──────────────────────────────────────────────────────────────

struct ParseContext {
    opts: ParseOptions,
    diagnostics: Vec<Diagnostic>,
    blocks: Vec<IntentBlock>,
    current_block: Option<BlockBuilder>,
    in_code_fence: bool,
    code_fence_lang: String,
    code_lines: Vec<String>,
    after_history: bool,
    history_raw_lines: Vec<String>,
    current_line: usize,
    /// Sequential block ID counter — resets per parse call, produces "b-N" IDs.
    block_counter: usize,
    /// columns: state machine — tracks current column headers for row: grouping
    active_columns: Option<Vec<String>>,
    /// The columns: block that owns the current table
    columns_block_idx: Option<usize>,
    /// Markdown-style pending table accumulator (| col | col |)
    pending_table: Option<PendingTable>,
}

#[allow(dead_code)]
struct BlockBuilder {
    block_type: String,
    content: String,
    properties: HashMap<String, String>,
    line: usize,
}

#[derive(Default)]
struct PendingTable {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    original_headers: String,
    header_line: usize,
}

impl ParseContext {
    fn new(opts: ParseOptions) -> Self {
        Self {
            opts,
            diagnostics: Vec::new(),
            blocks: Vec::new(),
            current_block: None,
            in_code_fence: false,
            code_fence_lang: String::new(),
            code_lines: Vec::new(),
            after_history: false,
            history_raw_lines: Vec::new(),
            current_line: 0,
            block_counter: 0,
            active_columns: None,
            columns_block_idx: None,
            pending_table: None,
        }
    }

    fn new_id(&mut self) -> String {
        self.block_counter += 1;
        format!("b-{}", self.block_counter)
    }

    fn emit_diag(&mut self, severity: DiagnosticSeverity, message: String, code: DiagnosticCode) {
        self.diagnostics.push(Diagnostic {
            severity,
            message,
            line: self.current_line,
            column: 0,
            code,
        });
    }

    fn flush_current_block(&mut self) {
        if let Some(b) = self.current_block.take() {
            let block = self.finish_block(b);
            self.process_block(block);
        }
    }

    fn finish_block(&mut self, b: BlockBuilder) -> IntentBlock {
        let props = if b.properties.is_empty() {
            None
        } else {
            Some(b.properties)
        };
        // Restore escaped pipe sentinel back to literal "|"
        let content = b.content.replace("\x01PIPE\x01", "|");
        IntentBlock {
            id: self.new_id(),
            block_type: b.block_type,
            content,
            original_content: None,
            properties: props,
            inline: None,
            children: None,
            table: None,
        }
    }

    /// Post-process a block before pushing it to self.blocks.
    fn process_block(&mut self, mut block: IntentBlock) {
        // Run inline parser on content
        if !self.opts.skip_inline && !matches!(block.block_type.as_str(), "code") {
            let inline = parse_inline(&block.content);
            let normalized = inline_plain_text(&inline);
            if !normalized.is_empty() {
                block.content = normalized;
            }
            if inline.len() > 1
                || inline
                    .iter()
                    .any(|n| !matches!(n, crate::types::InlineNode::Text { .. }))
            {
                block.inline = Some(inline);
            }
        }

        // columns/row table state machine
        match block.block_type.as_str() {
            "columns" => {
                // Parse column headers from content (pipe-separated) or properties
                let headers = parse_pipe_values(&block.content);
                self.active_columns = Some(headers.clone());
                let idx = self.blocks.len();
                block.table = Some(TableData {
                    headers: Some(headers),
                    rows: Vec::new(),
                });
                self.blocks.push(block);
                self.columns_block_idx = Some(idx);
                return;
            }
            "row" => {
                // Append row to the owning columns: block's table
                let row = parse_pipe_values(&block.content);
                if let Some(col_idx) = self.columns_block_idx {
                    if let Some(col_block) = self.blocks.get_mut(col_idx) {
                        if let Some(table) = col_block.table.as_mut() {
                            table.rows.push(row);
                        }
                    }
                } else {
                    // row without columns — emit diagnostic
                    let diag = Diagnostic {
                        severity: DiagnosticSeverity::Warning,
                        message: "row: block without a preceding columns: block".to_string(),
                        line: 0,
                        column: 0,
                        code: DiagnosticCode::RowWithoutHeaders,
                    };
                    self.diagnostics.push(diag);
                    self.blocks.push(block);
                }
                return;
            }
            _ => {
                // Non-data block resets the active table context
                if !matches!(block.block_type.as_str(), "section" | "sub" | "toc") {
                    // columns/row are typically in a section; don't reset on structural blocks
                }
            }
        }

        self.blocks.push(block);
    }

    fn parse_source(&mut self, source: &str) -> IntentDocument {
        // ── Input validation ─────────────────────────────────────────────
        const MAX_INPUT_LENGTH: usize = 10_000_000; // 10 MB

        if source.is_empty() {
            return self.build_document();
        }

        if source.len() > MAX_INPUT_LENGTH {
            let diag = crate::types::Diagnostic {
                severity: crate::types::DiagnosticSeverity::Error,
                message: format!(
                    "Input exceeds maximum allowed length of {MAX_INPUT_LENGTH} characters."
                ),
                line: 1,
                column: 0,
                code: crate::types::DiagnosticCode::InputTooLarge,
            };
            self.diagnostics.push(diag);
            return self.build_document();
        }

        // Strip null bytes; `str::lines()` already normalises CRLF → LF.
        let sanitized;
        let source = if source.contains('\0') {
            sanitized = source.replace('\0', "");
            &sanitized as &str
        } else {
            source
        };

        let lines: Vec<&str> = source.lines().collect();

        for (line_num, &line) in lines.iter().enumerate() {
            self.current_line = line_num + 1;

            // Collect raw history section
            if self.after_history {
                self.history_raw_lines.push(line.to_string());
                continue;
            }

            // Code fence state
            if self.in_code_fence {
                if line.trim_start() == "```"
                    || line.trim_start().starts_with("```") && line.trim_start().len() == 3
                {
                    // Closing fence
                    self.flush_current_block();
                    let code_content = self.code_lines.join("\n");
                    let lang = self.code_fence_lang.clone();
                    let mut b = BlockBuilder {
                        block_type: "code".to_string(),
                        content: code_content,
                        properties: HashMap::new(),
                        line: self.current_line,
                    };
                    if !lang.is_empty() {
                        b.properties.insert("lang".to_string(), lang);
                    }
                    let block = self.finish_block(b);
                    self.blocks.push(block);
                    self.in_code_fence = false;
                    self.code_lines = Vec::new();
                    self.code_fence_lang = String::new();
                } else {
                    self.code_lines.push(line.to_string());
                }
                continue;
            }

            // Flush pending markdown table when current line is not a table row.
            let trimmed = line.trim();
            if self.pending_table.is_some() {
                let is_md_pipe_row = is_markdown_pipe_row(trimmed);
                if !is_md_pipe_row && !trimmed.starts_with("row:") {
                    self.flush_pending_table();
                }
            }

            // Opening code fence (``` optionally followed by lang)
            if line.trim_start().starts_with("```") {
                self.flush_current_block();
                let lang = line.trim_start()[3..].trim().to_string();
                self.in_code_fence = true;
                self.code_fence_lang = lang;
                self.code_lines = Vec::new();
                continue;
            }

            // Blank line — flush current block
            if line.trim().is_empty() {
                self.flush_current_block();
                continue;
            }

            // Unescape literal pipes: "\|" → "|" (must happen before pipe-split)
            let unescaped_line;
            let line: &str = if line.contains("\\|") {
                unescaped_line = line.replace("\\|", "\x01PIPE\x01");
                &unescaped_line
            } else {
                line
            };

            // Continuation line (2+ spaces or tab)
            if line.starts_with("  ") || line.starts_with('\t') {
                if let Some(ref mut b) = self.current_block {
                    let trimmed = line.trim_start();
                    if !b.content.is_empty() {
                        b.content.push('\n');
                    }
                    b.content.push_str(trimmed);
                }
                continue;
            }

            // --- divider
            if line.trim() == "---" {
                if line_num + 1 < lines.len() {
                    let next = lines[line_num + 1].trim();
                    if next == "// history" || next.starts_with("// history") {
                        self.emit_diag(
                            DiagnosticSeverity::Warning,
                            "Legacy history boundary detected; use `history:` keyword boundary."
                                .to_string(),
                            DiagnosticCode::LegacyHistoryBoundary,
                        );
                        self.flush_current_block();
                        self.after_history = true;
                        continue;
                    }
                }
                self.flush_current_block();
                let id = self.new_id();
                let block = IntentBlock {
                    id,
                    block_type: "divider".to_string(),
                    content: String::new(),
                    original_content: None,
                    properties: None,
                    inline: None,
                    children: None,
                    table: None,
                };
                self.blocks.push(block);
                continue;
            }

            // Markdown-style table rows: | col1 | col2 |
            if let Some((cells, is_separator)) = parse_markdown_pipe_cells(line.trim()) {
                if !is_separator && !cells.is_empty() {
                    if let Some(table) = self.pending_table.as_mut() {
                        table.rows.push(cells);
                    } else {
                        self.pending_table = Some(PendingTable {
                            headers: cells,
                            rows: Vec::new(),
                            original_headers: line.trim().to_string(),
                            header_line: self.current_line,
                        });
                    }
                    continue;
                }
                if is_separator && self.pending_table.is_some() {
                    continue;
                }
            }

            // List item shorthand: "- item" / "* item".
            let trimmed = line.trim();
            if let Some(payload) = trimmed
                .strip_prefix("- ")
                .or_else(|| trimmed.strip_prefix("* "))
            {
                self.flush_current_block();
                let id = self.new_id();
                let mut block = IntentBlock {
                    id,
                    block_type: "list-item".to_string(),
                    content: payload.trim().to_string(),
                    original_content: None,
                    properties: None,
                    inline: None,
                    children: None,
                    table: None,
                };
                if !self.opts.skip_inline {
                    block.inline = Some(parse_inline(&block.content));
                }
                self.blocks.push(block);
                continue;
            }

            // Ordered step item: "1. item"
            if let Some((_, payload)) = parse_ordered_list_line(trimmed) {
                self.flush_current_block();
                let id = self.new_id();
                let mut block = IntentBlock {
                    id,
                    block_type: "step-item".to_string(),
                    content: payload.to_string(),
                    original_content: None,
                    properties: None,
                    inline: None,
                    children: None,
                    table: None,
                };
                if !self.opts.skip_inline {
                    block.inline = Some(parse_inline(&block.content));
                }
                self.blocks.push(block);
                continue;
            }

            // Extension block: x-{namespace}: {type} rest
            if let Some(rest) = line.strip_prefix("x-") {
                if let Some(colon_pos) = rest.find(':') {
                    let namespace = &rest[..colon_pos];
                    let after_colon = rest[colon_pos + 1..].trim_start();
                    // Split on whitespace to get type possibly followed by | content | props
                    let (ext_type, ext_rest) = split_keyword_rest(after_colon);
                    if !namespace.is_empty() && !ext_type.is_empty() {
                        self.flush_current_block();
                        let block_type = format!("x-{namespace}: {ext_type}");
                        let (content, properties) = parse_block_rest(ext_rest);
                        self.current_block = Some(BlockBuilder {
                            block_type,
                            content,
                            properties,
                            line: self.current_line,
                        });
                        continue;
                    }
                }
            }

            // Keyword line: /^([a-z][a-z0-9-]*):(.*)$/
            if let Some((keyword, rest)) = try_parse_keyword_line(line) {
                let keyword_normalized = keyword.to_ascii_lowercase();
                let keyword = keyword_normalized.as_str();
                self.flush_current_block();

                match resolve_keyword(keyword) {
                    KeywordResolution::Boundary => {
                        // history: or similar — flush and enter history mode
                        self.flush_current_block();
                        self.after_history = true;
                        continue;
                    }
                    KeywordResolution::Canonical(canonical) => {
                        // columns: and row: treat the full rest as pipe-separated data —
                        // bypass property splitting so "Name | Role | Email" isn't destructured.
                        let (content, mut properties) =
                            if canonical == "columns" || canonical == "row" {
                                (rest.trim().to_string(), HashMap::new())
                            } else {
                                parse_block_rest(rest)
                            };
                        if canonical == "done" {
                            properties
                                .entry("status".to_string())
                                .or_insert_with(|| "done".to_string());
                        }
                        if canonical == "step" {
                            properties
                                .entry("status".to_string())
                                .or_insert_with(|| "pending".to_string());
                        }
                        if canonical == "toc" {
                            properties
                                .entry("depth".to_string())
                                .or_insert_with(|| "2".to_string());
                            properties
                                .entry("title".to_string())
                                .or_insert_with(|| "Contents".to_string());
                        }
                        if canonical == "image" && !properties.contains_key("src") {
                            if let Some(at) = properties.get("at").cloned() {
                                properties.insert("src".to_string(), at);
                            }
                        }

                        self.current_block = Some(BlockBuilder {
                            block_type: canonical.to_string(),
                            content,
                            properties,
                            line: self.current_line,
                        });
                    }
                    KeywordResolution::CompatCanonical(canonical) => {
                        let (content, properties) = parse_block_rest(rest);
                        self.current_block = Some(BlockBuilder {
                            block_type: canonical.to_string(),
                            content,
                            properties,
                            line: self.current_line,
                        });
                    }
                    KeywordResolution::Alias {
                        canonical,
                        callout_type,
                    } => {
                        let (content, mut properties) = parse_block_rest(rest);
                        // Inject callout type if applicable
                        if let Some(ct) = callout_type {
                            properties
                                .entry("type".to_string())
                                .or_insert_with(|| ct.to_string());
                        }
                        if canonical == "done" {
                            properties
                                .entry("status".to_string())
                                .or_insert_with(|| "done".to_string());
                        }
                        if canonical == "step" {
                            properties
                                .entry("status".to_string())
                                .or_insert_with(|| "pending".to_string());
                        }
                        if canonical == "toc" {
                            properties
                                .entry("depth".to_string())
                                .or_insert_with(|| "2".to_string());
                            properties
                                .entry("title".to_string())
                                .or_insert_with(|| "Contents".to_string());
                        }
                        if canonical == "image" && !properties.contains_key("src") {
                            if let Some(at) = properties.get("at").cloned() {
                                properties.insert("src".to_string(), at);
                            }
                        }
                        self.current_block = Some(BlockBuilder {
                            block_type: canonical.to_string(),
                            content,
                            properties,
                            line: self.current_line,
                        });
                    }
                    KeywordResolution::Deprecated(canonical) => {
                        self.emit_diag(
                            DiagnosticSeverity::Warning,
                            format!("`{keyword}:` is deprecated — use `{canonical}:` instead (moved to x-agent: namespace)"),
                            DiagnosticCode::DeprecatedKeyword,
                        );
                        let (content, properties) = parse_block_rest(rest);
                        self.current_block = Some(BlockBuilder {
                            block_type: canonical.to_string(),
                            content,
                            properties,
                            line: self.current_line,
                        });
                    }
                    KeywordResolution::Extension { keyword: ext_kw } => {
                        // Extension legacy alias — normalize to the bare extension keyword
                        // so TS parity surfaces block.type as "figure", "ref", etc.
                        let (content, properties) = parse_block_rest(rest);
                        self.current_block = Some(BlockBuilder {
                            block_type: ext_kw.to_string(),
                            content,
                            properties,
                            line: self.current_line,
                        });
                    }
                    KeywordResolution::Unknown => {
                        self.emit_diag(
                            DiagnosticSeverity::Warning,
                            format!("Unknown keyword `{keyword}` — treating as extension block"),
                            DiagnosticCode::UnknownExtensionKeyword,
                        );
                        let (content, properties) = parse_block_rest(rest);
                        // Store as extension block
                        self.current_block = Some(BlockBuilder {
                            block_type: keyword.to_string(),
                            content,
                            properties,
                            line: self.current_line,
                        });
                    }
                }
                continue;
            }

            // Unrecognized line — treat as text continuation or start a text block
            self.flush_current_block();
            self.current_block = Some(BlockBuilder {
                block_type: "text".to_string(),
                content: line.to_string(),
                properties: HashMap::new(),
                line: self.current_line,
            });
        }

        // Unterminated code fence
        if self.in_code_fence {
            self.emit_diag(
                DiagnosticSeverity::Error,
                "Unterminated code block — missing closing ```".to_string(),
                DiagnosticCode::UnterminatedCodeBlock,
            );
        }

        self.flush_current_block();
        self.flush_pending_table();

        // v2.8.1 parity: top-of-document meta: is metadata-only, not a visible block.
        let mut seen_section = false;
        let mut pre_section_meta: HashMap<String, String> = HashMap::new();
        let mut filtered_blocks = Vec::with_capacity(self.blocks.len());
        for block in std::mem::take(&mut self.blocks) {
            if block.block_type == "section" {
                seen_section = true;
                filtered_blocks.push(block);
                continue;
            }
            if block.block_type == "meta" && !seen_section {
                if let Some(props) = &block.properties {
                    for (k, v) in props {
                        pre_section_meta.insert(k.clone(), v.clone());
                    }
                }
                continue;
            }
            filtered_blocks.push(block);
        }
        self.blocks = filtered_blocks;

        // Build metadata
        let mut metadata = build_metadata(&self.blocks);
        if !pre_section_meta.is_empty() {
            let out_meta = metadata.meta.get_or_insert_with(HashMap::new);
            for (k, v) in pre_section_meta {
                out_meta.insert(k, v);
            }
        }

        // Parse history section
        let history = if self.opts.include_history_section && !self.history_raw_lines.is_empty() {
            Some(parse_history_section(&self.history_raw_lines))
        } else {
            None
        };

        let diagnostics = if self.diagnostics.is_empty() {
            None
        } else {
            Some(std::mem::take(&mut self.diagnostics))
        };

        let resolved_version = detect_document_version(&self.blocks, self.after_history, source);

        IntentDocument {
            version: Some(resolved_version),
            blocks: std::mem::take(&mut self.blocks),
            metadata: Some(metadata),
            diagnostics,
            history,
        }
    }

    /// Build an IntentDocument from current state (used for early-return paths).
    fn build_document(&mut self) -> IntentDocument {
        self.flush_pending_table();
        let metadata = build_metadata(&self.blocks);
        let diagnostics = if self.diagnostics.is_empty() {
            None
        } else {
            Some(std::mem::take(&mut self.diagnostics))
        };
        IntentDocument {
            version: Some("2.14.2".to_string()),
            blocks: std::mem::take(&mut self.blocks),
            metadata: Some(metadata),
            diagnostics,
            history: None,
        }
    }

    fn flush_pending_table(&mut self) {
        let Some(table) = self.pending_table.take() else {
            return;
        };

        if !table.headers.is_empty() && table.rows.is_empty() {
            self.diagnostics.push(Diagnostic {
                severity: DiagnosticSeverity::Warning,
                message: "Table headers found with no following rows.".to_string(),
                line: table.header_line,
                column: 1,
                code: DiagnosticCode::HeadersWithoutRows,
            });
        }

        let id = self.new_id();
        self.blocks.push(IntentBlock {
            id,
            block_type: "table".to_string(),
            content: table.original_headers,
            original_content: None,
            properties: None,
            inline: None,
            children: None,
            table: Some(TableData {
                headers: Some(table.headers),
                rows: table.rows,
            }),
        });
    }
}

fn inline_plain_text(nodes: &[crate::types::InlineNode]) -> String {
    nodes
        .iter()
        .map(|n| match n {
            crate::types::InlineNode::Text { value }
            | crate::types::InlineNode::Bold { value }
            | crate::types::InlineNode::Italic { value }
            | crate::types::InlineNode::Strike { value }
            | crate::types::InlineNode::InlineQuote { value }
            | crate::types::InlineNode::Highlight { value }
            | crate::types::InlineNode::Code { value }
            | crate::types::InlineNode::InlineNote { value }
            | crate::types::InlineNode::Mention { value }
            | crate::types::InlineNode::Tag { value }
            | crate::types::InlineNode::Label { value }
            | crate::types::InlineNode::FootnoteRef { value }
            | crate::types::InlineNode::Date { value, .. }
            | crate::types::InlineNode::Link { value, .. } => value.clone(),
        })
        .collect::<Vec<_>>()
        .join("")
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

/// Try to match a keyword line: `^([a-z][a-z0-9-]*):\s*(.*)`.
/// Returns (keyword, rest_after_colon) on success.
fn try_parse_keyword_line(line: &str) -> Option<(&str, &str)> {
    let colon_pos = line.find(':')?;
    let keyword = &line[..colon_pos];

    // keyword must start with alpha and contain only [A-Za-z0-9-]
    if keyword.is_empty() {
        return None;
    }
    let mut chars = keyword.chars();
    if !chars.next()?.is_ascii_alphabetic() {
        return None;
    }
    if !keyword
        .chars()
        .all(|c| c.is_ascii_alphabetic() || c.is_ascii_digit() || c == '-')
    {
        return None;
    }

    let rest = line[colon_pos + 1..].trim_start();
    Some((keyword, rest))
}

/// Split the first token (before whitespace or |) from the rest.
fn split_keyword_rest(s: &str) -> (&str, &str) {
    let s = s.trim_start();
    if let Some(pos) = s.find([' ', '\t', '|']) {
        (&s[..pos], &s[pos..])
    } else {
        (s, "")
    }
}

/// Parse the rest after "keyword: " into (content, properties).
///
/// Content is everything before the first " | " sequence.
/// Properties are " | key: value" segments after that.
fn parse_block_rest(rest: &str) -> (String, HashMap<String, String>) {
    // TS accepts property-only blocks written as `keyword: | k: v | ...`.
    // Normalize a leading `|` so the first property segment is not dropped.
    let normalized_storage;
    let rest = {
        let trimmed = rest.trim_start();
        if trimmed.starts_with('|') {
            normalized_storage = format!(" {}", trimmed);
            normalized_storage.as_str()
        } else {
            rest
        }
    };

    // Split on " | " — spaces around pipe are required to avoid false splits in URLs
    let segments: Vec<&str> = split_prop_segments(rest);

    let content = segments.first().copied().unwrap_or("").trim().to_string();
    let mut properties = HashMap::new();

    // Keys that must NEVER be allowed in properties — prototype pollution guard.
    const DANGEROUS_KEYS: &[&str] = &["__proto__", "constructor", "prototype"];

    for seg in &segments[1..] {
        let seg = seg.trim();
        if let Some(colon_pos) = seg.find(':') {
            let key = seg[..colon_pos].trim().to_string();
            let value = seg[colon_pos + 1..].trim().to_string();
            if !key.is_empty() && !DANGEROUS_KEYS.contains(&key.as_str()) {
                properties.insert(key, value);
            }
        }
    }

    (content, properties)
}

/// Split a property segment string on " | " (space-pipe-space).
/// This avoids splitting on | inside URLs (which have no surrounding spaces).
fn split_prop_segments(s: &str) -> Vec<&str> {
    let mut results = Vec::new();
    let mut start = 0;
    let bytes = s.as_bytes();
    let len = bytes.len();

    let mut i = 0;
    while i < len {
        // Look for " | " (0x20 0x7C 0x20)
        if i + 2 < len && bytes[i] == b' ' && bytes[i + 1] == b'|' && bytes[i + 2] == b' ' {
            results.push(&s[start..i]);
            start = i + 3;
            i += 3;
        } else {
            i += 1;
        }
    }
    results.push(&s[start..]);
    results
}

/// Parse pipe-separated values from a content string (for columns:/row:).
fn parse_pipe_values(content: &str) -> Vec<String> {
    content.split('|').map(|s| s.trim().to_string()).collect()
}

fn is_markdown_pipe_row(trimmed: &str) -> bool {
    trimmed.starts_with('|') && trimmed.ends_with('|') && trimmed.len() >= 2
}

fn parse_markdown_pipe_cells(trimmed: &str) -> Option<(Vec<String>, bool)> {
    if !is_markdown_pipe_row(trimmed) {
        return None;
    }

    let inner = &trimmed[1..trimmed.len() - 1];
    let cells: Vec<String> = inner
        .split('|')
        .map(|cell| cell.trim().to_string())
        .filter(|cell| !cell.is_empty())
        .collect();

    let is_separator = !cells.is_empty()
        && cells
            .iter()
            .all(|cell| cell.chars().all(|ch| ch == '-' || ch == ':'));

    Some((cells, is_separator))
}

fn parse_ordered_list_line(trimmed: &str) -> Option<(usize, &str)> {
    let mut parts = trimmed.splitn(2, '.');
    let n = parts.next()?.trim();
    let rest = parts.next()?.trim_start();
    if n.chars().all(|c| c.is_ascii_digit()) && !rest.is_empty() {
        let idx = n.parse::<usize>().ok()?;
        return Some((idx, rest));
    }
    None
}

// ── Metadata extraction ───────────────────────────────────────────────────────

fn build_metadata(blocks: &[IntentBlock]) -> DocumentMetadata {
    let mut meta = DocumentMetadata::default();
    let mut meta_map: HashMap<String, String> = HashMap::new();
    let mut context_map: HashMap<String, String> = HashMap::new();
    let mut signatures: Vec<Signature> = Vec::new();
    let mut seen_section = false;

    for block in blocks {
        if meta.language.is_none() && contains_rtl(&block.content) {
            meta.language = Some("rtl".to_string());
        }
        if block.block_type == "section" {
            seen_section = true;
        }
        match block.block_type.as_str() {
            "title" => {
                if meta.title.is_none() {
                    meta.title = Some(block.content.clone());
                }
            }
            "summary" => {
                if meta.summary.is_none() {
                    meta.summary = Some(block.content.clone());
                }
            }
            "meta" => {
                if !seen_section {
                    if let Some(props) = &block.properties {
                        for (k, v) in props {
                            meta_map.insert(k.clone(), v.clone());
                        }
                    }
                }
            }
            "context" => {
                if let Some(props) = &block.properties {
                    for (k, v) in props {
                        context_map.insert(k.clone(), v.clone());
                    }
                }
            }
            "track" => {
                if let Some(props) = &block.properties {
                    let version = props.get("version").cloned().unwrap_or_default();
                    let by = props.get("by").cloned().unwrap_or_default();
                    meta.tracking = Some(TrackingState {
                        version,
                        by,
                        active: true,
                    });
                }
            }
            "sign" => {
                let signer = block.content.clone();
                let role = block.prop("role").map(str::to_string);
                let at = block.prop("at").unwrap_or("").to_string();
                let hash = block.prop("hash").unwrap_or("").to_string();
                signatures.push(Signature {
                    signer,
                    role,
                    at,
                    hash,
                    valid: None,
                });
            }
            "freeze" => {
                let at = block.prop("at").unwrap_or("").to_string();
                let hash = block.prop("hash").unwrap_or("").to_string();
                let status = block.prop("status").unwrap_or("locked").to_string();
                meta.freeze = Some(FreezeState { at, hash, status });
            }
            _ => {}
        }
    }

    if !meta_map.is_empty() {
        meta.meta = Some(meta_map);
    }
    if !context_map.is_empty() {
        meta.context = Some(context_map);
    }
    if !signatures.is_empty() {
        meta.signatures = Some(signatures);
    }

    meta
}

fn contains_rtl(s: &str) -> bool {
    s.chars().any(|ch| ('\u{0600}'..='\u{06FF}').contains(&ch))
}

fn detect_document_version(blocks: &[IntentBlock], after_history: bool, source: &str) -> String {
    if after_history || source.contains("history:") {
        return "2.12".to_string();
    }

    let has_v211 = blocks.iter().any(|b| {
        matches!(
            b.block_type.as_str(),
            "ref" | "def" | "metric" | "amendment" | "figure" | "signline" | "contact" | "deadline"
        )
    });
    if has_v211 {
        return "2.11".to_string();
    }

    let has_v25_docgen = blocks.iter().any(|b| {
        matches!(
            b.block_type.as_str(),
            "font" | "page" | "byline" | "epigraph" | "caption" | "footnote" | "toc" | "dedication"
        )
    });
    if has_v25_docgen {
        return "2.5".to_string();
    }

    "2.14.2".to_string()
}

// ── History section parser ────────────────────────────────────────────────────

fn parse_history_section(lines: &[String]) -> HistorySection {
    let raw = lines.join("\n");
    let mut registry = Vec::new();
    let mut revisions = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("registry:") {
            let (_, props) = parse_block_rest(rest);
            registry.push(RegistryEntry {
                id: props.get("id").cloned().unwrap_or_default(),
                block_type: props.get("type").cloned().unwrap_or_default(),
                section: props.get("section").cloned().unwrap_or_default(),
                fingerprint: props.get("fingerprint").cloned().unwrap_or_default(),
                dead: props.get("dead").map(|v| v == "true"),
            });
        } else if let Some(rest) = trimmed.strip_prefix("revision:") {
            let (_, props) = parse_block_rest(rest);
            revisions.push(RevisionEntry {
                version: props.get("version").cloned().unwrap_or_default(),
                at: props.get("at").cloned().unwrap_or_default(),
                by: props.get("by").cloned().unwrap_or_default(),
                change: props.get("change").cloned().unwrap_or_default(),
                id: props.get("id").cloned().unwrap_or_default(),
                block: props.get("block").cloned().unwrap_or_default(),
                section: props.get("section").cloned(),
            });
        }
    }

    HistorySection {
        registry,
        revisions,
        raw,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_title_block() {
        let doc = parse("title: My Document", None);
        assert_eq!(doc.blocks.len(), 1);
        assert_eq!(doc.blocks[0].block_type, "title");
        assert_eq!(doc.blocks[0].content, "My Document");
    }

    #[test]
    fn parse_metadata() {
        let doc = parse("title: Test\nsummary: A test doc", None);
        let meta = doc.metadata.unwrap();
        assert_eq!(meta.title.as_deref(), Some("Test"));
        assert_eq!(meta.summary.as_deref(), Some("A test doc"));
    }

    #[test]
    fn parse_properties() {
        let doc = parse(
            "step: Deploy | tool: kubectl | id: deploy | timeout: 30m",
            None,
        );
        let block = &doc.blocks[0];
        assert_eq!(block.block_type, "step");
        assert_eq!(block.content, "Deploy");
        assert_eq!(block.prop("tool"), Some("kubectl"));
        assert_eq!(block.prop("timeout"), Some("30m"));
    }

    #[test]
    fn warning_alias_injects_type() {
        let doc = parse("warning: Check your input", None);
        let block = &doc.blocks[0];
        assert_eq!(block.block_type, "info");
        assert_eq!(block.prop("type"), Some("warning"));
    }

    #[test]
    fn danger_alias_injects_type() {
        let doc = parse("danger: This is critical", None);
        let block = &doc.blocks[0];
        assert_eq!(block.block_type, "info");
        assert_eq!(block.prop("type"), Some("danger"));
    }

    #[test]
    fn info_no_type_injection() {
        let doc = parse("info: A plain callout", None);
        let block = &doc.blocks[0];
        assert_eq!(block.block_type, "info");
        assert_eq!(block.prop("type"), None);
    }

    #[test]
    fn emit_is_deprecated() {
        let doc = parse("emit: my-event | event: workflow.done", None);
        // Deprecated → resolves to "signal" (x-agent: signal)
        assert!(doc.diagnostics.as_ref().is_some_and(|d| {
            d.iter()
                .any(|d| d.code == DiagnosticCode::DeprecatedKeyword)
        }));
    }

    #[test]
    fn history_keyword_produces_no_block() {
        let doc = parse(
            "title: Test\nhistory:\nrevision: | version: 1.0 | by: Ahmed",
            None,
        );
        // history: should produce no block in document.blocks
        assert!(!doc.blocks.iter().any(|b| b.block_type == "history"));
        // The revision line should be in history.raw
        if let Some(h) = &doc.history {
            assert!(!h.raw.is_empty());
        }
    }

    #[test]
    fn code_fence_is_literal() {
        let src = "text: before\n```rust\nlet x = 1; // keyword: not parsed\n```\ntext: after";
        let doc = parse(src, None);
        let code_block = doc.blocks.iter().find(|b| b.block_type == "code").unwrap();
        assert!(code_block.content.contains("let x = 1;"));
        assert!(code_block.content.contains("// keyword: not parsed"));
    }

    #[test]
    fn divider_triple_dash() {
        let doc = parse("text: above\n---\ntext: below", None);
        assert!(doc.blocks.iter().any(|b| b.block_type == "divider"));
    }

    #[test]
    fn continuation_line() {
        let doc = parse("text: first line\n  second line", None);
        assert_eq!(doc.blocks.len(), 1);
        assert!(doc.blocks[0].content.contains("first line"));
        assert!(doc.blocks[0].content.contains("second line"));
    }

    #[test]
    fn implicit_text_single_line() {
        let doc = parse("Hello world", None);
        assert_eq!(doc.blocks.len(), 1);
        assert_eq!(doc.blocks[0].block_type, "text");
        assert_eq!(doc.blocks[0].content, "Hello world");
    }

    #[test]
    fn implicit_text_after_explicit_block() {
        let doc = parse("title: Example\nThis paragraph is implicit text.", None);
        assert_eq!(doc.blocks.len(), 2);
        assert_eq!(doc.blocks[0].block_type, "title");
        assert_eq!(doc.blocks[0].content, "Example");
        assert_eq!(doc.blocks[1].block_type, "text");
        assert_eq!(doc.blocks[1].content, "This paragraph is implicit text.");
    }

    #[test]
    fn blank_line_still_splits_text_blocks() {
        let doc = parse("text: first\n\nsecond", None);
        assert_eq!(doc.blocks.len(), 2);
        assert_eq!(doc.blocks[0].block_type, "text");
        assert_eq!(doc.blocks[0].content, "first");
        assert_eq!(doc.blocks[1].block_type, "text");
        assert_eq!(doc.blocks[1].content, "second");
    }

    #[test]
    fn unknown_keyword_is_not_reinterpreted_as_implicit_text() {
        let doc = parse("customword: payload", None);
        assert_eq!(doc.blocks.len(), 1);
        assert_eq!(doc.blocks[0].block_type, "customword");
        assert_eq!(doc.blocks[0].content, "payload");
        assert!(doc.diagnostics.as_ref().is_some_and(|d| {
            d.iter()
                .any(|d| d.code == DiagnosticCode::UnknownExtensionKeyword)
        }));
    }

    #[test]
    fn extension_block() {
        let doc = parse("x-writer: byline | author: Ahmed | date: 2026-03-09", None);
        assert_eq!(doc.blocks[0].block_type, "x-writer: byline");
        assert_eq!(doc.blocks[0].prop("author"), Some("Ahmed"));
    }

    #[test]
    fn columns_and_rows_table() {
        let src = "columns: Name | Role | Email\nrow: Ahmed | CEO | ahmed@acme.com\nrow: Sarah | COO | sarah@acme.com";
        let doc = parse(src, None);

        // columns block has table with headers and 2 rows
        let col_block = doc
            .blocks
            .iter()
            .find(|b| b.block_type == "columns")
            .unwrap();
        let table = col_block.table.as_ref().unwrap();
        assert_eq!(table.headers.as_ref().unwrap().len(), 3);
        assert_eq!(table.rows.len(), 2);
    }

    #[test]
    fn h1_compat_alias() {
        // h1: is compat-only alias for title: — no diagnostic emitted
        let doc = parse("h1: My Title", None);
        assert_eq!(doc.blocks[0].block_type, "title");
        // No deprecated diagnostic
        assert!(doc.diagnostics.as_ref().map_or(true, |d| {
            !d.iter()
                .any(|d| d.code == DiagnosticCode::DeprecatedKeyword)
        }));
    }

    #[test]
    fn policy_block() {
        let doc = parse(
            "policy: Require gate | requires: gate | gate: approval | action: block",
            None,
        );
        let block = &doc.blocks[0];
        assert_eq!(block.block_type, "policy");
        assert_eq!(block.prop("requires"), Some("gate"));
        assert_eq!(block.prop("gate"), Some("approval"));
    }

    // ── Security hardening ────────────────────────────────────────────────────

    #[test]
    fn empty_input_returns_empty_doc() {
        let doc = parse("", None);
        assert!(doc.blocks.is_empty());
    }

    #[test]
    fn oversized_input_returns_error_diagnostic() {
        let huge = "a".repeat(10_000_001);
        let doc = parse(&huge, None);
        assert!(doc.blocks.is_empty());
        let diags = doc.diagnostics.as_ref().expect("should have diagnostics");
        assert_eq!(diags[0].severity, crate::types::DiagnosticSeverity::Error);
    }

    #[test]
    fn block_ids_are_sequential_b_n() {
        let doc = parse("title: A\nnote: B\ntask: C", None);
        assert_eq!(doc.blocks[0].id, "b-1");
        assert_eq!(doc.blocks[1].id, "b-2");
        assert_eq!(doc.blocks[2].id, "b-3");
    }

    #[test]
    fn block_ids_reset_each_parse_call() {
        let doc1 = parse("title: A\nnote: B", None);
        let doc2 = parse("title: A\nnote: B", None);
        assert_eq!(doc1.blocks[0].id, doc2.blocks[0].id);
        assert_eq!(doc1.blocks[1].id, doc2.blocks[1].id);
    }

    #[test]
    fn dangerous_property_keys_are_blocked() {
        let doc = parse(
            "task: Test | __proto__: polluted | constructor: evil | prototype: bad | safe: ok",
            None,
        );
        let block = &doc.blocks[0];
        assert!(block.prop("__proto__").is_none());
        assert!(block.prop("constructor").is_none());
        assert!(block.prop("prototype").is_none());
        assert_eq!(block.prop("safe"), Some("ok"));
    }

    #[test]
    fn windows_crlf_handled() {
        let doc = parse("title: Hello\r\nnote: World\r\n", None);
        assert_eq!(doc.blocks.len(), 2);
        assert_eq!(doc.blocks[0].content, "Hello");
        assert_eq!(doc.blocks[1].content, "World");
    }

    #[test]
    fn null_bytes_stripped() {
        let src = "note: before\x00after";
        let doc = parse(src, None);
        assert_eq!(doc.blocks.len(), 1);
        assert_eq!(doc.blocks[0].content, "beforeafter");
    }

    #[test]
    fn escaped_pipe_preserved_as_literal() {
        let doc = parse("note: A \\| B", None);
        assert_eq!(doc.blocks[0].content, "A | B");
    }

    #[test]
    fn whitespace_only_lines_ignored() {
        let doc = parse("   \n   \n   ", None);
        assert!(doc.blocks.is_empty());
    }
}
