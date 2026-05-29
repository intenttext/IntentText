//! All IntentText types — exact parity with @intenttext/core v2.14.2 types.ts

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Document ─────────────────────────────────────────────────────────────────

/// A fully parsed IntentText document.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct IntentDocument {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub blocks: Vec<IntentBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<DocumentMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<Vec<Diagnostic>>,
    /// Populated only when ParseOptions::include_history_section = true
    #[serde(skip_serializing_if = "Option::is_none")]
    pub history: Option<HistorySection>,
}

/// Document-level metadata, extracted from header blocks.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct DocumentMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// "ltr" | "rtl"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// Scoped context variables from context: blocks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// v2.8: tracking state from track: block
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tracking: Option<TrackingState>,
    /// v2.8: cryptographic signatures from sign: blocks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signatures: Option<Vec<Signature>>,
    /// v2.8: freeze state from freeze: block
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freeze: Option<FreezeState>,
    /// v2.8.1: free-form metadata from meta: blocks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackingState {
    pub version: String,
    pub by: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Signature {
    pub signer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    pub at: String,
    pub hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub valid: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FreezeState {
    pub at: String,
    pub hash: String,
    /// Always "locked"
    pub status: String,
}

// ── Block ─────────────────────────────────────────────────────────────────────

/// A single parsed block. The `block_type` field serializes as "type".
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentBlock {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_content: Option<String>,
    /// Property values are always strings. Numeric coercion is a renderer concern.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline: Option<Vec<InlineNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<IntentBlock>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table: Option<TableData>,
}

impl IntentBlock {
    /// Get a property value by key.
    pub fn prop(&self, key: &str) -> Option<&str> {
        self.properties.as_ref()?.get(key).map(|s| s.as_str())
    }

    /// Get the `id` property (set in source), distinct from the auto-generated `self.id`.
    pub fn source_id(&self) -> Option<&str> {
        self.prop("id")
    }
}

/// Table data attached to `columns:` / `row:` block groups.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<Vec<String>>,
    pub rows: Vec<Vec<String>>,
}

// ── Inline ────────────────────────────────────────────────────────────────────

/// Inline rich-text node — all variants mirror types.ts InlineNode union exactly.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum InlineNode {
    Text { value: String },
    Bold { value: String },
    Italic { value: String },
    Strike { value: String },
    InlineQuote { value: String },
    Highlight { value: String },
    Code { value: String },
    InlineNote { value: String },
    Date { value: String, iso: String },
    Mention { value: String },
    Tag { value: String },
    Label { value: String },
    Link { value: String, href: String },
    FootnoteRef { value: String },
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Diagnostic {
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub line: usize,
    pub column: usize,
    pub code: DiagnosticCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
}

/// All 62 diagnostic codes — exact parity with TypeScript implementation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum DiagnosticCode {
    // ── Parser codes ──────────────────────────────────────────────────────
    UnterminatedCodeBlock,
    UnexpectedEnd,
    InvalidPropertySegment,
    HeadersWithoutRows,
    RowWithoutHeaders,
    UnknownExtensionKeyword,
    ExtensionValidation,
    LegacyHistoryBoundary,
    DeprecatedKeyword,
    DeprecatedProperty,
    /// Input string exceeds the maximum allowed size (10 MB).
    InputTooLarge,

    // ── Workflow validation errors ────────────────────────────────────────
    DuplicateStepId,
    StepRefMissing,
    DependsRefMissing,
    ParallelRefMissing,
    CallLoop,
    ResultNotTerminal,

    // ── Trust validation errors ───────────────────────────────────────────
    MultipleFreeze,
    FreezeNotLast,
    TrackNoVersion,
    SecretMissingName,
    ApproveNoBy,
    SignNoHash,
    SignNoAt,
    RefMissingTarget,
    DefMissingMeaning,
    MetricMissingValue,
    AmendmentWithoutFreeze,
    AmendmentMissingRef,
    AmendmentMissingNow,
    FigureMissingSrc,
    DeadlineMissingDate,

    // ── Workflow validation warnings ──────────────────────────────────────
    EmptySection,
    GateNoApprover,
    StepNoTool,
    HandoffNoTo,
    RetryNoMax,
    PolicyNoCondition,
    PolicyNoAction,
    CiteMissingTitle,
    InputMissingName,
    OutputMissingName,
    ToolMissingApi,
    PromptMissingContent,
    AssertMissingCondition,
    HistoryWithoutFreeze,
    TrackWithoutTitle,
    FreezeUnsigned,
    SignHashInvalid,
    MetaAfterSection,
    HeaderWithoutPage,
    FooterWithoutPage,
    WatermarkWithoutPage,
    MultipleWatermarks,
    RefMissingRel,
    DefDuplicateTerm,
    MetricInvalidTrend,
    FigureMissingCaption,
    ContactNoReach,
    DeadlinePast,
    UnresolvedVariable,

    // ── Info ──────────────────────────────────────────────────────────────
    DocumentNoTitle,
    TemplateHasUnresolved,
}

impl DiagnosticCode {
    /// Returns the string key as used in the TypeScript implementation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::UnterminatedCodeBlock => "UNTERMINATED_CODE_BLOCK",
            Self::UnexpectedEnd => "UNEXPECTED_END",
            Self::InvalidPropertySegment => "INVALID_PROPERTY_SEGMENT",
            Self::HeadersWithoutRows => "HEADERS_WITHOUT_ROWS",
            Self::RowWithoutHeaders => "ROW_WITHOUT_HEADERS",
            Self::UnknownExtensionKeyword => "UNKNOWN_EXTENSION_KEYWORD",
            Self::ExtensionValidation => "EXTENSION_VALIDATION",
            Self::LegacyHistoryBoundary => "LEGACY_HISTORY_BOUNDARY",
            Self::DeprecatedKeyword => "DEPRECATED_KEYWORD",
            Self::DeprecatedProperty => "DEPRECATED_PROPERTY",
            Self::InputTooLarge => "INPUT_TOO_LARGE",
            Self::DuplicateStepId => "DUPLICATE_STEP_ID",
            Self::StepRefMissing => "STEP_REF_MISSING",
            Self::DependsRefMissing => "DEPENDS_REF_MISSING",
            Self::ParallelRefMissing => "PARALLEL_REF_MISSING",
            Self::CallLoop => "CALL_LOOP",
            Self::ResultNotTerminal => "RESULT_NOT_TERMINAL",
            Self::MultipleFreeze => "MULTIPLE_FREEZE",
            Self::FreezeNotLast => "FREEZE_NOT_LAST",
            Self::TrackNoVersion => "TRACK_NO_VERSION",
            Self::SecretMissingName => "SECRET_MISSING_NAME",
            Self::ApproveNoBy => "APPROVE_NO_BY",
            Self::SignNoHash => "SIGN_NO_HASH",
            Self::SignNoAt => "SIGN_NO_AT",
            Self::RefMissingTarget => "REF_MISSING_TARGET",
            Self::DefMissingMeaning => "DEF_MISSING_MEANING",
            Self::MetricMissingValue => "METRIC_MISSING_VALUE",
            Self::AmendmentWithoutFreeze => "AMENDMENT_WITHOUT_FREEZE",
            Self::AmendmentMissingRef => "AMENDMENT_MISSING_REF",
            Self::AmendmentMissingNow => "AMENDMENT_MISSING_NOW",
            Self::FigureMissingSrc => "FIGURE_MISSING_SRC",
            Self::DeadlineMissingDate => "DEADLINE_MISSING_DATE",
            Self::EmptySection => "EMPTY_SECTION",
            Self::GateNoApprover => "GATE_NO_APPROVER",
            Self::StepNoTool => "STEP_NO_TOOL",
            Self::HandoffNoTo => "HANDOFF_NO_TO",
            Self::RetryNoMax => "RETRY_NO_MAX",
            Self::PolicyNoCondition => "POLICY_NO_CONDITION",
            Self::PolicyNoAction => "POLICY_NO_ACTION",
            Self::CiteMissingTitle => "CITE_MISSING_TITLE",
            Self::InputMissingName => "INPUT_MISSING_NAME",
            Self::OutputMissingName => "OUTPUT_MISSING_NAME",
            Self::ToolMissingApi => "TOOL_MISSING_API",
            Self::PromptMissingContent => "PROMPT_MISSING_CONTENT",
            Self::AssertMissingCondition => "ASSERT_MISSING_CONDITION",
            Self::HistoryWithoutFreeze => "HISTORY_WITHOUT_FREEZE",
            Self::TrackWithoutTitle => "TRACK_WITHOUT_TITLE",
            Self::FreezeUnsigned => "FREEZE_UNSIGNED",
            Self::SignHashInvalid => "SIGN_HASH_INVALID",
            Self::MetaAfterSection => "META_AFTER_SECTION",
            Self::HeaderWithoutPage => "HEADER_WITHOUT_PAGE",
            Self::FooterWithoutPage => "FOOTER_WITHOUT_PAGE",
            Self::WatermarkWithoutPage => "WATERMARK_WITHOUT_PAGE",
            Self::MultipleWatermarks => "MULTIPLE_WATERMARKS",
            Self::RefMissingRel => "REF_MISSING_REL",
            Self::DefDuplicateTerm => "DEF_DUPLICATE_TERM",
            Self::MetricInvalidTrend => "METRIC_INVALID_TREND",
            Self::FigureMissingCaption => "FIGURE_MISSING_CAPTION",
            Self::ContactNoReach => "CONTACT_NO_REACH",
            Self::DeadlinePast => "DEADLINE_PAST",
            Self::UnresolvedVariable => "UNRESOLVED_VARIABLE",
            Self::DocumentNoTitle => "DOCUMENT_NO_TITLE",
            Self::TemplateHasUnresolved => "TEMPLATE_HAS_UNRESOLVED",
        }
    }
}

// ── History ───────────────────────────────────────────────────────────────────

/// v2.8: History section below the `history:` boundary keyword.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HistorySection {
    pub registry: Vec<RegistryEntry>,
    pub revisions: Vec<RevisionEntry>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RegistryEntry {
    pub id: String,
    pub block_type: String,
    pub section: String,
    pub fingerprint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RevisionEntry {
    pub version: String,
    pub at: String,
    pub by: String,
    /// "added" | "removed" | "modified" | "moved"
    pub change: String,
    pub id: String,
    pub block: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section: Option<String>,
}

// ── Parse options ─────────────────────────────────────────────────────────────

/// Options for `parse()`.
#[derive(Debug, Clone, Default)]
pub struct ParseOptions {
    /// If true, parse the history section below the `history:` boundary keyword.
    pub include_history_section: bool,
    /// If true, run inline parser on block content (default: runs anyway).
    pub skip_inline: bool,
}

// ── Render options ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct RenderOptions {
    /// CSS theme class applied to the wrapper element.
    pub theme: Option<String>,
    /// Wrap output in a full <html> document.
    pub full_document: bool,
    /// Include print-specific CSS (@page, break rules).
    pub print_mode: bool,
}

/// v2.9 print layout extraction result.
#[derive(Debug, Clone, Default)]
pub struct PrintLayout {
    pub page: Option<IntentBlock>,
    pub header: Option<IntentBlock>,
    pub footer: Option<IntentBlock>,
    pub watermark: Option<IntentBlock>,
    pub breaks: Vec<IntentBlock>,
}
