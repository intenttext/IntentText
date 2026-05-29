//! IntentText (.it) language — Rust implementation.
//!
//! Version: 2.14.2 (v2.14 keyword freeze — 37 canonical keywords)
//!
//! # Quick start
//!
//! ```rust
//! use intenttext::parser::parse;
//! use intenttext::renderer::render;
//!
//! let doc = parse("title: Hello World\ntext: This is my document.", None);
//! let html = render(&doc, None);
//! println!("{html}");
//! ```
//!
//! # Feature flags
//!
//! | Flag | Default | Description |
//! |------|---------|-------------|
//! | `renderer` | ✅ | HTML renderer |
//! | `query` | ✅ | Block query engine |
//! | `validate` | ✅ | Semantic validator |
//! | `watch` | ✅ | File watch utilities |
//! | `trust` | ❌ | SHA-256 signing / freezing |
//! | `executor` | ❌ | Workflow executor |
//! | `wasm` | ❌ | WebAssembly bindings |
//! | `python` | ❌ | Python (pyo3) bindings |
//! | `full` | ❌ | All non-binding features |

// ── Core modules (always compiled) ───────────────────────────────────────────

/// All public types: `IntentDocument`, `IntentBlock`, `InlineNode`, `Diagnostic`, etc.
pub mod types;

/// Keyword resolution for the v2.14 freeze (37 canonical keywords + extension system).
pub mod keywords;

/// Language registry — full metadata for all stable + extension keywords.
pub mod language_registry;

/// Inline rich-text parser.
pub mod inline;

/// Single-pass `.it` document parser.
pub mod parser;

/// Round-trip serializer — `IntentDocument` → `.it` source text.
pub mod source;

/// Template-variable merge engine (`{{variable}}`).
pub mod merge;

/// Markdown -> IntentText converter.
pub mod markdown;

/// HTML -> IntentText converter.
pub mod html_to_it;

/// Workflow graph extractor.
pub mod workflow;

/// History parse/update helpers.
pub mod history;
pub mod keyword_schema;
pub mod safe_parser;
pub mod schema;
pub mod settings;
pub mod theme;
pub mod vault;
#[cfg(feature = "watch")]
pub mod watch;

/// v2.10 shallow index builder APIs.
pub mod index_builder;

/// v2.10 natural language query helpers.
pub mod ask;

/// Document diff engine.
pub mod diff;

/// `.it-index` builder with `simple_hash`.
pub mod index;

// ── Feature-gated modules ─────────────────────────────────────────────────────

/// HTML renderer.
#[cfg(feature = "renderer")]
pub mod renderer;

/// Block query engine — filter, sort, paginate.
#[cfg(feature = "query")]
pub mod query;

/// Semantic validator with all 62 diagnostic codes.
#[cfg(feature = "validate")]
pub mod validate;

/// Trust system — SHA-256 signing, freezing, verification.
#[cfg(feature = "trust")]
pub mod trust;

/// Workflow executor — runs step:/gate:/decision: documents.
#[cfg(feature = "executor")]
pub mod executor;

/// WebAssembly bindings for JS/TS consumers.
#[cfg(feature = "wasm")]
pub mod wasm;

// ── Convenient re-exports ─────────────────────────────────────────────────────

pub use types::{
    Diagnostic, DiagnosticCode, DiagnosticSeverity, DocumentMetadata, FreezeState, HistorySection,
    InlineNode, IntentBlock, IntentDocument, ParseOptions, PrintLayout, RegistryEntry,
    RenderOptions, RevisionEntry, Signature, TableData, TrackingState,
};

pub use ask::{ask_core, ask_documents, serialize_context, AskCorePayload, AskOptions};
#[cfg(feature = "ai_transport")]
pub use ask::{ask_documents_with_transport, AskTransport};
pub use diff::{diff, DiffEntry, DiffKind};
pub use history::{parse_history_section, update_history, ParsedHistory};
pub use html_to_it::convert_html_to_intenttext;
pub use index::{
    build_index, index_document, is_workspace, load_index, load_or_build_index, rebuild_collection,
    register_workspace, save_index, simple_hash, unregister_workspace, IndexEntry, ItCollection,
    ItDatabase, ItDocument, WorkspaceInfo,
};
pub use index_builder::{
    build_index_entry, build_shallow_index, check_staleness, compose_indexes, format_csv,
    format_json, format_table, query_composed, update_index, ComposedResult, IndexBlockEntry,
    IndexFileEntry, ItIndex,
};
pub use keyword_schema::{
    property_kind, property_schema_for, PropertyKind, PropertySpec, KEYWORD_PROPERTY_SCHEMA,
};
pub use keywords::{ALIASES, KEYWORDS};
pub use markdown::convert_markdown_to_intenttext;
pub use merge::{find_template_variables, interpolate, merge, merge_value, parse_and_merge};
pub use parser::parse;
pub use parser::{detect_history_boundary, reset_id_counter};
pub use safe_parser::{
    parse_intent_text_safe, ParseError, ParseWarning, SafeParseOptions, SafeParseResult,
};
pub use schema::{
    create_schema, format_validation_result, validate_document, BlockSchema, DocumentSchema,
    PropertySchema, PropertyType, ValidationError, ValidationResult, PREDEFINED_SCHEMAS,
};
pub use settings::{
    load_settings, load_vault_path, save_settings, save_vault_path, settings_path,
    IntentTextSettings, SettingsError,
};
pub use source::to_source;
pub use theme::{
    generate_theme_css, get_builtin_theme, list_builtin_themes, register_builtin_theme,
    IntentTheme, ThemeFonts, ThemeSpacing,
};
pub use vault::{
    close_vault, is_vault_open, open_vault, query_vault, query_vault_folder, register_vault,
    vault_info, vault_path, VaultError, VaultInfo, VaultQueryItem, VaultQueryResult, WatchEvent,
};
#[cfg(feature = "watch")]
pub use watch::{watch_folder, WatchEvent as FsWatchEvent, WatchOptions};
pub use workflow::{extract_workflow, WorkflowGraph, WorkflowStep};

#[cfg(feature = "renderer")]
pub use renderer::render;
#[cfg(feature = "renderer")]
pub use renderer::{collect_print_layout, render_print};

#[cfg(feature = "query")]
pub use query::{find_block_by_id, first_by_type, get_by_type, query, QueryOptions, QueryResult};
#[cfg(feature = "query")]
pub use query::{format_query_result, parse_query, query_document};

#[cfg(feature = "validate")]
pub use validate::validate;

#[cfg(feature = "trust")]
pub use trust::{
    amend, block_fingerprint, compute_document_hash, compute_hash, compute_trust_diff,
    find_history_boundary_in_source, freeze, generate_block_id, increment_version,
    match_blocks_to_registry, seal, seal_document, verify, verify_document, BlockSnapshot,
    SealOptions, SealResult, TrustDiff, VerifyResult,
};

#[cfg(feature = "executor")]
pub use executor::{
    execute_workflow, ExecutionOptions, ExecutionResult, ExecutionStatus, WorkflowRuntime,
};

#[cfg(feature = "wasm")]
pub use wasm::{parse_wasm, render_wasm, to_source_wasm, validate_wasm};

// ── Version ───────────────────────────────────────────────────────────────────

/// The crate version string.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// The IntentText language version this implementation targets.
pub const LANGUAGE_VERSION: &str = "2.14";
