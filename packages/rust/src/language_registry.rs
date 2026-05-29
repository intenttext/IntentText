//! Language Registry — mirrors language-registry.ts, v2.14 keyword freeze.
//!
//! Provides structured metadata about every keyword (canonical, extension,
//! internal, alias) for tooling, documentation, and editor integration.

use once_cell::sync::Lazy;
use std::collections::HashMap;

// ── Keyword classes ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum KeywordCategory {
    Identity,
    Content,
    Structure,
    Data,
    Agent,
    Trust,
    Layout,
}

impl KeywordCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Identity  => "identity",
            Self::Content   => "content",
            Self::Structure => "structure",
            Self::Data      => "data",
            Self::Agent     => "agent",
            Self::Trust     => "trust",
            Self::Layout    => "layout",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum KeywordStatus {
    Stable,
    Alias,
    Deprecated,
    CompatOnly,
    Boundary,
}

/// A registered keyword entry.
#[derive(Debug, Clone)]
pub struct KeywordEntry {
    pub canonical: &'static str,
    pub category: KeywordCategory,
    pub since: &'static str,
    pub status: KeywordStatus,
    pub description: &'static str,
}

/// An extension keyword entry (x-ns: type form).
#[derive(Debug, Clone)]
pub struct ExtensionEntry {
    /// Bare keyword name (e.g. "byline").
    pub keyword: &'static str,
    /// Namespace (e.g. "writer").
    pub namespace: &'static str,
    /// Full x-form (e.g. "x-writer: byline").
    pub x_form: &'static str,
    pub since: &'static str,
    pub description: &'static str,
}

// ── Registry ──────────────────────────────────────────────────────────────────

pub static LANGUAGE_REGISTRY: Lazy<Vec<KeywordEntry>> = Lazy::new(|| {
    vec![
        // ── Document Identity (4) ────────────────────────────────────────────
        KeywordEntry { canonical: "title",    category: KeywordCategory::Identity, since: "1.0",    status: KeywordStatus::Stable, description: "Unique document title — renders as H1" },
        KeywordEntry { canonical: "summary",  category: KeywordCategory::Identity, since: "1.0",    status: KeywordStatus::Stable, description: "Short document description" },
        KeywordEntry { canonical: "meta",     category: KeywordCategory::Identity, since: "2.8.1",  status: KeywordStatus::Stable, description: "Document metadata (author, tags, theme, type)" },
        KeywordEntry { canonical: "context",  category: KeywordCategory::Identity, since: "2.0",    status: KeywordStatus::Stable, description: "Agent execution context and scoped variables" },
        // ── Structure (3) ──────────────────────────────────────────────────
        KeywordEntry { canonical: "section",  category: KeywordCategory::Structure, since: "1.0",   status: KeywordStatus::Stable, description: "Major heading / context boundary — renders as H2" },
        KeywordEntry { canonical: "sub",      category: KeywordCategory::Structure, since: "1.0",   status: KeywordStatus::Stable, description: "Sub-section — renders as H3" },
        KeywordEntry { canonical: "toc",      category: KeywordCategory::Structure, since: "2.5",   status: KeywordStatus::Stable, description: "Auto-generated table of contents" },
        // ── Content (7) ─────────────────────────────────────────────────────
        KeywordEntry { canonical: "text",     category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Body paragraph" },
        KeywordEntry { canonical: "info",     category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Callout block (warning/danger/tip/success are type-injecting aliases)" },
        KeywordEntry { canonical: "quote",    category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Attributed block quotation" },
        KeywordEntry { canonical: "cite",     category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Bibliographic citation" },
        KeywordEntry { canonical: "code",     category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Code block with optional language" },
        KeywordEntry { canonical: "image",    category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Image with optional caption" },
        KeywordEntry { canonical: "link",     category: KeywordCategory::Content, since: "1.0",     status: KeywordStatus::Stable, description: "Hyperlink to an external resource" },
        // ── Tasks (3) ──────────────────────────────────────────────────────
        KeywordEntry { canonical: "task",     category: KeywordCategory::Agent, since: "1.0",       status: KeywordStatus::Stable, description: "Actionable item with owner and due date" },
        KeywordEntry { canonical: "done",     category: KeywordCategory::Agent, since: "2.0",       status: KeywordStatus::Stable, description: "Completed item — resolved state of a task" },
        KeywordEntry { canonical: "ask",      category: KeywordCategory::Agent, since: "1.0",       status: KeywordStatus::Stable, description: "Open question requiring a response" },
        // ── Data (3) ────────────────────────────────────────────────────────
        KeywordEntry { canonical: "columns",  category: KeywordCategory::Data, since: "1.0",        status: KeywordStatus::Stable, description: "Table column definitions" },
        KeywordEntry { canonical: "row",      category: KeywordCategory::Data, since: "1.0",        status: KeywordStatus::Stable, description: "Table data row" },
        KeywordEntry { canonical: "metric",   category: KeywordCategory::Data, since: "2.11",       status: KeywordStatus::Stable, description: "Named measurement with value" },
        // ── Agentic Workflow (7) ────────────────────────────────────────────
        KeywordEntry { canonical: "step",     category: KeywordCategory::Agent, since: "2.0",       status: KeywordStatus::Stable, description: "Execute a tool or action" },
        KeywordEntry { canonical: "decision", category: KeywordCategory::Agent, since: "2.0",       status: KeywordStatus::Stable, description: "Conditional branch" },
        KeywordEntry { canonical: "gate",     category: KeywordCategory::Agent, since: "2.2",       status: KeywordStatus::Stable, description: "Human approval checkpoint" },
        KeywordEntry { canonical: "trigger",  category: KeywordCategory::Agent, since: "2.0",       status: KeywordStatus::Stable, description: "Workflow entry point" },
        KeywordEntry { canonical: "result",   category: KeywordCategory::Agent, since: "2.1",       status: KeywordStatus::Stable, description: "Terminal workflow output" },
        KeywordEntry { canonical: "policy",   category: KeywordCategory::Agent, since: "2.7",       status: KeywordStatus::Stable, description: "Standing behavioural rule — enforced before execution" },
        KeywordEntry { canonical: "audit",    category: KeywordCategory::Agent, since: "2.0",       status: KeywordStatus::Stable, description: "Immutable execution record" },
        // ── Trust (5) ──────────────────────────────────────────────────────
        KeywordEntry { canonical: "track",     category: KeywordCategory::Trust, since: "2.8",      status: KeywordStatus::Stable, description: "Start version tracking" },
        KeywordEntry { canonical: "approve",   category: KeywordCategory::Trust, since: "2.8",      status: KeywordStatus::Stable, description: "Approval record" },
        KeywordEntry { canonical: "sign",      category: KeywordCategory::Trust, since: "2.8",      status: KeywordStatus::Stable, description: "Signature / attestation record" },
        KeywordEntry { canonical: "freeze",    category: KeywordCategory::Trust, since: "2.8",      status: KeywordStatus::Stable, description: "Lock document against changes" },
        KeywordEntry { canonical: "amendment", category: KeywordCategory::Trust, since: "2.11",     status: KeywordStatus::Stable, description: "Formal change to a frozen document" },
        // ── Layout (5) ─────────────────────────────────────────────────────
        KeywordEntry { canonical: "page",      category: KeywordCategory::Layout, since: "2.5",     status: KeywordStatus::Stable, description: "Page layout declaration" },
        KeywordEntry { canonical: "header",    category: KeywordCategory::Layout, since: "2.9",     status: KeywordStatus::Stable, description: "Page header for print output" },
        KeywordEntry { canonical: "footer",    category: KeywordCategory::Layout, since: "2.9",     status: KeywordStatus::Stable, description: "Page footer for print output" },
        KeywordEntry { canonical: "watermark", category: KeywordCategory::Layout, since: "2.9",     status: KeywordStatus::Stable, description: "Watermark overlay for print" },
        KeywordEntry { canonical: "break",     category: KeywordCategory::Layout, since: "1.0",     status: KeywordStatus::Stable, description: "Print page break — invisible in web" },
        // ── Internal / Non-canonical ────────────────────────────────────────
        KeywordEntry { canonical: "history",   category: KeywordCategory::Trust,  since: "2.12",    status: KeywordStatus::Boundary,   description: "History boundary — structural marker, produces no block" },
        KeywordEntry { canonical: "divider",   category: KeywordCategory::Layout, since: "2.12",    status: KeywordStatus::CompatOnly, description: "Internal: visible ---; users write --- directly" },
        KeywordEntry { canonical: "revision",  category: KeywordCategory::Trust,  since: "2.8",     status: KeywordStatus::CompatOnly, description: "Internal: auto-generated revision record" },
    ]
});

pub static EXTENSION_REGISTRY: Lazy<Vec<ExtensionEntry>> = Lazy::new(|| {
    vec![
        // ── x-writer ────────────────────────────────────────────────────────
        ExtensionEntry { keyword: "byline",     namespace: "writer", x_form: "x-writer: byline",     since: "2.5",  description: "Author byline with date and publication" },
        ExtensionEntry { keyword: "epigraph",   namespace: "writer", x_form: "x-writer: epigraph",   since: "2.5",  description: "Introductory quotation at the start of a document" },
        ExtensionEntry { keyword: "figure",     namespace: "writer", x_form: "x-writer: figure",     since: "2.11", description: "Numbered captioned figure" },
        ExtensionEntry { keyword: "caption",    namespace: "writer", x_form: "x-writer: caption",    since: "2.5",  description: "Figure or table caption" },
        ExtensionEntry { keyword: "footnote",   namespace: "writer", x_form: "x-writer: footnote",   since: "2.5",  description: "Numbered footnote" },
        ExtensionEntry { keyword: "dedication", namespace: "writer", x_form: "x-writer: dedication",  since: "2.5",  description: "Document dedication page" },
        // ── x-doc ──────────────────────────────────────────────────────────
        ExtensionEntry { keyword: "def",        namespace: "doc",   x_form: "x-doc: def",            since: "2.11", description: "Term definition — inline or glossary entry" },
        ExtensionEntry { keyword: "contact",    namespace: "doc",   x_form: "x-doc: contact",        since: "2.11", description: "Person or organization contact information" },
        ExtensionEntry { keyword: "deadline",   namespace: "doc",   x_form: "x-doc: deadline",       since: "2.11", description: "Date-bound milestone or due date" },
        ExtensionEntry { keyword: "ref",        namespace: "doc",   x_form: "x-doc: ref",            since: "2.11", description: "Cross-document reference with typed relationship" },
        ExtensionEntry { keyword: "signline",   namespace: "doc",   x_form: "x-doc: signline",       since: "2.11", description: "Physical signature line for print" },
        // ── x-agent ────────────────────────────────────────────────────────
        ExtensionEntry { keyword: "loop",       namespace: "agent", x_form: "x-agent: loop",         since: "2.0",  description: "Iterate over a collection" },
        ExtensionEntry { keyword: "parallel",   namespace: "agent", x_form: "x-agent: parallel",     since: "2.1",  description: "Run multiple steps concurrently" },
        ExtensionEntry { keyword: "retry",      namespace: "agent", x_form: "x-agent: retry",        since: "2.1",  description: "Retry a failed step with backoff" },
        ExtensionEntry { keyword: "wait",       namespace: "agent", x_form: "x-agent: wait",         since: "2.1",  description: "Pause execution until event or timeout" },
        ExtensionEntry { keyword: "handoff",    namespace: "agent", x_form: "x-agent: handoff",      since: "2.1",  description: "Transfer control to another agent" },
        ExtensionEntry { keyword: "call",       namespace: "agent", x_form: "x-agent: call",         since: "2.2",  description: "Invoke a sub-workflow by file reference" },
        ExtensionEntry { keyword: "checkpoint", namespace: "agent", x_form: "x-agent: checkpoint",   since: "2.0",  description: "Named workflow checkpoint for resume and rollback" },
        ExtensionEntry { keyword: "error",      namespace: "agent", x_form: "x-agent: error",        since: "2.0",  description: "Error record with severity and retry metadata" },
        ExtensionEntry { keyword: "import",     namespace: "agent", x_form: "x-agent: import",       since: "2.0",  description: "Import a workflow from a file" },
        ExtensionEntry { keyword: "export",     namespace: "agent", x_form: "x-agent: export",       since: "2.0",  description: "Export data or workflow output" },
        ExtensionEntry { keyword: "progress",   namespace: "agent", x_form: "x-agent: progress",     since: "2.0",  description: "Progress indicator for long-running operations" },
        ExtensionEntry { keyword: "agent",      namespace: "agent", x_form: "x-agent: agent",        since: "2.0",  description: "Document-level agent name/identifier config" },
        ExtensionEntry { keyword: "model",      namespace: "agent", x_form: "x-agent: model",        since: "2.0",  description: "Default AI model for this document" },
        ExtensionEntry { keyword: "tool",       namespace: "agent", x_form: "x-agent: tool",         since: "2.0",  description: "External tool or API declaration" },
        ExtensionEntry { keyword: "prompt",     namespace: "agent", x_form: "x-agent: prompt",       since: "2.0",  description: "LLM prompt template" },
        ExtensionEntry { keyword: "memory",     namespace: "agent", x_form: "x-agent: memory",       since: "2.0",  description: "Agent memory or persistent state declaration" },
        ExtensionEntry { keyword: "signal",     namespace: "agent", x_form: "x-agent: signal",       since: "2.2",  description: "Emit a named workflow signal or event" },
        ExtensionEntry { keyword: "embed",      namespace: "agent", x_form: "x-agent: embed",        since: "1.0",  description: "Embed a referenced external resource" },
        // ── x-trust ────────────────────────────────────────────────────────
        ExtensionEntry { keyword: "history",    namespace: "trust", x_form: "x-trust: history",      since: "2.12", description: "History boundary marker (internal)" },
        ExtensionEntry { keyword: "revision",   namespace: "trust", x_form: "x-trust: revision",     since: "2.8",  description: "Auto-generated revision record (internal)" },
        // ── x-layout ───────────────────────────────────────────────────────
        ExtensionEntry { keyword: "font",       namespace: "layout", x_form: "x-layout: font",       since: "2.5",  description: "Typography settings" },
        ExtensionEntry { keyword: "divider",    namespace: "layout", x_form: "x-layout: divider",    since: "2.12", description: "Visible horizontal rule" },
        // ── x-exp ──────────────────────────────────────────────────────────
        ExtensionEntry { keyword: "assert",     namespace: "exp",   x_form: "x-exp: assert",         since: "2.13", description: "Testable assertion" },
        ExtensionEntry { keyword: "secret",     namespace: "exp",   x_form: "x-exp: secret",         since: "2.13", description: "Secret or credential reference — never rendered" },
        ExtensionEntry { keyword: "input",      namespace: "exp",   x_form: "x-exp: input",          since: "1.3",  description: "Declared input parameter for templates and workflows" },
        ExtensionEntry { keyword: "output",     namespace: "exp",   x_form: "x-exp: output",         since: "1.3",  description: "Declared output parameter for templates and workflows" },
    ]
});

/// Map from extension bare keyword → namespace (e.g. "byline" → "writer").
pub static EXTENSION_NS_MAP: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    EXTENSION_REGISTRY
        .iter()
        .map(|e| (e.keyword, e.namespace))
        .collect()
});

/// Set of all extension bare keywords.
pub static EXTENSION_KEYWORDS: Lazy<std::collections::HashSet<&'static str>> = Lazy::new(|| {
    EXTENSION_REGISTRY.iter().map(|e| e.keyword).collect()
});

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_entry_count() {
        let stable: Vec<_> = LANGUAGE_REGISTRY
            .iter()
            .filter(|e| e.status == KeywordStatus::Stable)
            .collect();
        assert_eq!(stable.len(), 37, "v2.14 freeze: exactly 37 stable keyword entries");
    }

    #[test]
    fn extension_registry_has_entries() {
        assert!(!EXTENSION_REGISTRY.is_empty());
    }

    #[test]
    fn extension_ns_map_works() {
        assert_eq!(EXTENSION_NS_MAP.get("byline"), Some(&"writer"));
        assert_eq!(EXTENSION_NS_MAP.get("signal"), Some(&"agent"));
    }
}
