//! Keyword set and alias maps — v2.14 keyword freeze.
//!
//! Source of truth: packages/core/src/language-registry.ts
//!
//! 37 canonical (stable) keywords, plus boundary + compat-only entries.
//! All aliases derive from the LANGUAGE_REGISTRY definitions.

use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};

// ── Canonical keywords (37 stable) ───────────────────────────────────────────

pub static CANONICAL_KEYWORDS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        // Document Identity (4)
        "title", "summary", "meta", "context",
        // Structure (3)
        "section", "sub", "toc",
        // Content (7)
        "text", "info", "quote", "cite", "code", "image", "link",
        // Tasks (3) — category "agent" in registry
        "task", "done", "ask",
        // Data (3)
        "columns", "row", "metric",
        // Agentic Workflow (7)
        "step", "decision", "gate", "trigger", "result", "policy", "audit",
        // Trust (5)
        "track", "approve", "sign", "freeze", "amendment",
        // Layout (5)
        "page", "header", "footer", "watermark", "break",
    ]
    .into()
});

/// Boundary keywords — consumed by the parser but produce NO block in document.blocks.
/// Everything after `history:` goes into document.history (if requested).
pub static BOUNDARY_KEYWORDS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    ["history"].into()
});

/// Compat-only canonical keywords — recognised by the parser, normalised silently.
/// NOT in CANONICAL_KEYWORDS, never shown in docs or completion hints.
pub static COMPAT_CANONICAL: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    ["divider", "revision"].into()
});

// ── Alias map ─────────────────────────────────────────────────────────────────

/// All aliases → their canonical keyword.
/// Includes: standard aliases, compat-only input aliases, and deprecated aliases.
/// Does NOT include extension legacy aliases (handled in language_registry.rs).
pub static ALIAS_MAP: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        // title
        ("h1", "title"),
        // summary
        ("abstract", "summary"),
        // section
        ("heading", "section"), ("chapter", "section"), ("h2", "section"),
        // sub
        ("subheading", "sub"), ("h3", "sub"), ("subsection", "sub"),
        // text
        ("note", "text"), ("body", "text"), ("content", "text"), ("paragraph", "text"), ("p", "text"),
        // info (callout — also type-injecting, see CALLOUT_ALIAS_MAP)
        ("warning", "info"), ("danger", "info"), ("tip", "info"), ("success", "info"),
        ("alert", "info"), ("caution", "info"), ("critical", "info"), ("destructive", "info"),
        ("hint", "info"), ("advice", "info"),
        // quote
        ("blockquote", "quote"), ("excerpt", "quote"), ("pullquote", "quote"),
        // cite
        ("citation", "cite"), ("source", "cite"), ("reference", "cite"),
        // code
        ("snippet", "code"),
        // image
        ("img", "image"), ("photo", "image"), ("picture", "image"),
        // link
        ("url", "link"), ("href", "link"),
        // task
        ("check", "task"), ("todo", "task"), ("action", "task"), ("item", "task"),
        // done (compat-only)
        ("completed", "done"), ("finished", "done"),
        // ask (compat-only)
        ("question", "ask"),
        // columns (compat-only)
        ("headers", "columns"),
        // metric
        ("kpi", "metric"), ("measure", "metric"), ("indicator", "metric"), ("stat", "metric"),
        // step
        ("run", "step"),
        // decision
        ("if", "decision"),
        // trigger
        ("on", "trigger"),
        // policy
        ("rule", "policy"), ("constraint", "policy"), ("guard", "policy"), ("requirement", "policy"),
        // audit
        ("log", "audit"),
        // freeze
        ("lock", "freeze"),
        // sign
        ("sig", "sign"),
        // amendment
        ("amend", "amendment"), ("change", "amendment"),
        // divider (compat-only canonical)
        ("hr", "divider"), ("separator", "divider"),
        // Deprecated
        ("emit", "signal"),       // DEPRECATED — was keyword in v2.2, moved to x-agent:
        ("status", "signal"),     // DEPRECATED
    ])
});

/// Callout aliases that inject a `type` property into the normalised `info:` block.
/// e.g. `warning: text` → block_type: "info", properties.type: "warning"
pub static CALLOUT_ALIAS_MAP: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        ("warning", "warning"),
        ("alert", "warning"),
        ("caution", "warning"),
        ("danger", "danger"),
        ("critical", "danger"),
        ("destructive", "danger"),
        ("tip", "tip"),
        ("hint", "tip"),
        ("advice", "tip"),
        ("success", "success"),
    ])
});

/// Deprecated aliases — the parser normalises them but emits `DEPRECATED_KEYWORD`.
pub static DEPRECATED_ALIASES: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    ["emit", "status"].into()
});

/// Compat-only INPUT aliases — normalised silently, never shown in docs or hints.
pub static COMPAT_ONLY_ALIASES: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "h1", "h2", "h3", "p", "subsection",
        "headers", "stat", "completed", "finished", "question", "sig",
    ]
    .into()
});

// ── Extension legacy aliases ──────────────────────────────────────────────────
//
// Former bare keywords that moved to extension namespaces.
// These aliases resolve to extension keywords (defined in language_registry.rs).

pub static EXTENSION_LEGACY_ALIASES: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        // figure aliases → x-writer: figure
        ("fig", "figure"), ("diagram", "figure"), ("chart", "figure"),
        ("illustration", "figure"), ("visual", "figure"),
        // def aliases → x-doc: def
        ("define", "def"), ("term", "def"), ("glossary", "def"),
        // contact aliases → x-doc: contact
        ("person", "contact"), ("party", "contact"), ("entity", "contact"),
        // ref aliases → x-doc: ref
        ("references", "ref"), ("see", "ref"), ("related", "ref"), ("xref", "ref"),
        // deadline aliases → x-doc: deadline
        ("due", "deadline"), ("milestone", "deadline"), ("by", "deadline"), ("due-date", "deadline"),
        // signline aliases → x-doc: signline
        ("signature-line", "signline"), ("sign-here", "signline"),
        // assert aliases → x-exp: assert
        ("expect", "assert"), ("verify", "assert"),
        // secret aliases → x-exp: secret
        ("credential", "secret"), ("token", "secret"),
    ])
});

/// Public keyword list parity surface.
pub static KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    let mut out: Vec<&'static str> = CANONICAL_KEYWORDS.iter().copied().collect();
    out.extend(BOUNDARY_KEYWORDS.iter().copied());
    out.extend(COMPAT_CANONICAL.iter().copied());
    out.sort_unstable();
    out
});

/// Public alias map parity surface.
pub static ALIASES: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| ALIAS_MAP.clone());

// ── Resolution ────────────────────────────────────────────────────────────────

/// Result of keyword resolution.
#[derive(Debug, PartialEq)]
pub enum KeywordResolution {
    /// A stable canonical keyword.
    Canonical(&'static str),
    /// Alias normalised to canonical, optional callout type injection.
    Alias { canonical: &'static str, callout_type: Option<&'static str> },
    /// Deprecated alias — normalised but parser should emit DEPRECATED_KEYWORD.
    Deprecated(&'static str),
    /// Boundary keyword — parser consumes it but emits no block.
    Boundary,
    /// Compat-only canonical (divider, revision) — parsed silently.
    CompatCanonical(&'static str),
    /// Extension keyword (x-ns: form) — valid extension block.
    Extension { keyword: &'static str },
    /// Unknown — emit UNKNOWN_EXTENSION_KEYWORD or treat as extension block.
    Unknown,
}

/// Resolve a raw keyword string from a `.it` source line.
///
/// This is called for every `keyword:` token the parser encounters.
/// Returns the resolution type so the parser knows what block to create
/// and whether to emit diagnostics.
pub fn resolve_keyword(raw: &str) -> KeywordResolution {
    // 1. Canonical
    if let Some(&k) = CANONICAL_KEYWORDS.get(raw) {
        return KeywordResolution::Canonical(k);
    }
    // 2. Boundary
    if BOUNDARY_KEYWORDS.contains(raw) {
        return KeywordResolution::Boundary;
    }
    // 3. Compat-only canonicals
    if let Some(&k) = COMPAT_CANONICAL.get(raw) {
        return KeywordResolution::CompatCanonical(k);
    }
    // 4. Deprecated aliases
    if DEPRECATED_ALIASES.contains(raw) {
        let canonical = ALIAS_MAP.get(raw).copied().unwrap_or("extension");
        return KeywordResolution::Deprecated(canonical);
    }
    // 5. Standard / compat-only aliases
    if let Some(&canonical) = ALIAS_MAP.get(raw) {
        let callout_type = CALLOUT_ALIAS_MAP.get(raw).copied();
        return KeywordResolution::Alias { canonical, callout_type };
    }
    // 6. Extension legacy aliases
    if let Some(&ext_kw) = EXTENSION_LEGACY_ALIASES.get(raw) {
        return KeywordResolution::Extension { keyword: ext_kw };
    }
    // 7. Unknown
    KeywordResolution::Unknown
}

/// Convenience: returns the canonical type string, or None for Boundary/Unknown.
pub fn canonical_of(raw: &str) -> Option<&'static str> {
    match resolve_keyword(raw) {
        KeywordResolution::Canonical(k)
        | KeywordResolution::Deprecated(k)
        | KeywordResolution::CompatCanonical(k) => Some(k),
        KeywordResolution::Alias { canonical, .. } => Some(canonical),
        KeywordResolution::Extension { keyword } => Some(keyword),
        KeywordResolution::Boundary | KeywordResolution::Unknown => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_keywords_count() {
        assert_eq!(CANONICAL_KEYWORDS.len(), 37, "v2.14 freeze: exactly 37 canonical keywords");
    }

    #[test]
    fn info_is_canonical_not_warning() {
        assert!(CANONICAL_KEYWORDS.contains("info"));
        assert!(!CANONICAL_KEYWORDS.contains("warning"));
    }

    #[test]
    fn warning_resolves_to_info_with_type_injection() {
        match resolve_keyword("warning") {
            KeywordResolution::Alias { canonical, callout_type } => {
                assert_eq!(canonical, "info");
                assert_eq!(callout_type, Some("warning"));
            }
            other => panic!("expected Alias, got {other:?}"),
        }
    }

    #[test]
    fn danger_resolves_to_info_with_danger_type() {
        match resolve_keyword("danger") {
            KeywordResolution::Alias { canonical, callout_type } => {
                assert_eq!(canonical, "info");
                assert_eq!(callout_type, Some("danger"));
            }
            other => panic!("expected Alias, got {other:?}"),
        }
    }

    #[test]
    fn emit_is_deprecated() {
        assert!(matches!(resolve_keyword("emit"), KeywordResolution::Deprecated(_)));
    }

    #[test]
    fn history_is_boundary() {
        assert!(matches!(resolve_keyword("history"), KeywordResolution::Boundary));
    }

    #[test]
    fn unknown_keyword_is_unknown() {
        assert!(matches!(resolve_keyword("foobar"), KeywordResolution::Unknown));
    }

    #[test]
    fn extension_legacy_aliases_resolve() {
        // fig → figure (extension)
        match resolve_keyword("fig") {
            KeywordResolution::Extension { keyword } => assert_eq!(keyword, "figure"),
            other => panic!("expected Extension, got {other:?}"),
        }
    }
}
