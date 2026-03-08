/**
 * IntentText Language Registry
 *
 * Single source of truth for the IntentText keyword contract.
 * KEYWORDS array, BlockType union, and ALIASES map are all derived from this.
 *
 * Every keyword in existence — canonical, alias, deprecated, compat, boundary —
 * is defined here with its full metadata.
 */

export type KeywordCategory =
  | "identity"
  | "content"
  | "structure"
  | "data"
  | "agent"
  | "trust"
  | "layout";

/**
 * Lifecycle status of a keyword.
 *
 * stable      — canonical, user-facing, documented in reference
 * alias       — input-only shorthand that resolves to a canonical keyword
 * deprecated  — will be removed in a future major version; emit warning
 * compat-only — kept for back-compat; never show in docs or completion hints
 * boundary    — structural marker that produces no block output (e.g. history:)
 */
export type KeywordStatus =
  | "stable"
  | "alias"
  | "deprecated"
  | "compat-only"
  | "boundary";

export interface KeywordDefinition {
  /** The canonical name written in a .it file, without the trailing colon. */
  canonical: string;
  category: KeywordCategory;
  /** Semver string of the version when this was introduced. */
  since: string;
  status: KeywordStatus;
  /** One-line description for tooling and docs generation. */
  description: string;
  /**
   * Input-only aliases that resolve to this canonical keyword.
   * Classified as 'alias' | 'compat-only' | 'deprecated'.
   */
  aliases: Array<{
    alias: string;
    status: "alias" | "compat-only" | "deprecated";
  }>;
}

export const LANGUAGE_REGISTRY: KeywordDefinition[] = [
  // ── Document Identity ────────────────────────────────────────────────────
  {
    canonical: "title",
    category: "identity",
    since: "1.0",
    status: "stable",
    description: "Document title — renders as H1",
    aliases: [{ alias: "h1", status: "compat-only" }],
  },
  {
    canonical: "summary",
    category: "identity",
    since: "1.0",
    status: "stable",
    description: "Brief document description",
    aliases: [{ alias: "abstract", status: "alias" }],
  },
  {
    canonical: "meta",
    category: "identity",
    since: "2.8.1",
    status: "stable",
    description: "Free-form document metadata key-value pairs",
    aliases: [],
  },
  {
    canonical: "context",
    category: "identity",
    since: "2.0",
    status: "stable",
    description: "Agent execution context and scoped variables",
    aliases: [],
  },
  {
    canonical: "track",
    category: "identity",
    since: "2.8",
    status: "stable",
    description: "Activate document history tracking",
    aliases: [],
  },

  // ── Content ──────────────────────────────────────────────────────────────
  {
    canonical: "text",
    category: "content",
    since: "1.0",
    status: "stable",
    description:
      "General body text — the default block type. Not a callout; for callouts use info:, tip:, warning:, danger:",
    aliases: [
      { alias: "note", status: "alias" },
      { alias: "body", status: "alias" },
      { alias: "content", status: "alias" },
      { alias: "paragraph", status: "alias" },
      { alias: "p", status: "compat-only" },
    ],
  },
  {
    canonical: "quote",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Block quotation with optional attribution",
    aliases: [
      { alias: "blockquote", status: "alias" },
      { alias: "excerpt", status: "alias" },
      { alias: "pullquote", status: "alias" },
    ],
  },
  {
    canonical: "cite",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Bibliographic citation with author, date, and URL",
    aliases: [
      { alias: "citation", status: "alias" },
      { alias: "source", status: "alias" },
      { alias: "reference", status: "alias" },
    ],
  },
  {
    canonical: "warning",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Warning or caution block — renders with visual emphasis",
    aliases: [
      { alias: "alert", status: "alias" },
      { alias: "caution", status: "alias" },
    ],
  },
  {
    canonical: "danger",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Danger callout — for irreversible actions or data loss risk",
    aliases: [
      { alias: "critical", status: "alias" },
      { alias: "destructive", status: "alias" },
    ],
  },
  {
    canonical: "tip",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Helpful tip or suggestion",
    aliases: [
      { alias: "hint", status: "alias" },
      { alias: "advice", status: "alias" },
    ],
  },
  {
    canonical: "info",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Informational callout block",
    aliases: [],
  },
  {
    canonical: "success",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Success or confirmation callout block",
    aliases: [],
  },
  {
    canonical: "code",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Code block with optional language for syntax highlighting",
    aliases: [{ alias: "snippet", status: "alias" }],
  },
  {
    canonical: "image",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Inline image — no caption, no number",
    aliases: [
      { alias: "img", status: "alias" },
      { alias: "photo", status: "alias" },
      { alias: "picture", status: "alias" },
    ],
  },
  {
    canonical: "link",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Hyperlink to an external resource",
    aliases: [
      { alias: "url", status: "alias" },
      { alias: "href", status: "alias" },
    ],
  },
  {
    canonical: "def",
    category: "content",
    since: "2.11",
    status: "stable",
    description: "Term definition — inline or glossary entry",
    aliases: [
      { alias: "define", status: "alias" },
      { alias: "term", status: "alias" },
      { alias: "glossary", status: "alias" },
    ],
  },
  {
    canonical: "figure",
    category: "content",
    since: "2.11",
    status: "stable",
    description: "Numbered, captioned figure",
    aliases: [
      { alias: "fig", status: "alias" },
      { alias: "diagram", status: "alias" },
      { alias: "chart", status: "alias" },
      { alias: "illustration", status: "alias" },
      { alias: "visual", status: "alias" },
    ],
  },
  {
    canonical: "contact",
    category: "content",
    since: "2.11",
    status: "stable",
    description: "Person or organization contact information",
    aliases: [
      { alias: "person", status: "alias" },
      { alias: "party", status: "alias" },
      { alias: "entity", status: "alias" },
    ],
  },

  // ── Structure ────────────────────────────────────────────────────────────
  {
    canonical: "section",
    category: "structure",
    since: "1.0",
    status: "stable",
    description: "Section heading — renders as H2",
    aliases: [
      { alias: "heading", status: "alias" },
      { alias: "chapter", status: "alias" },
      { alias: "h2", status: "compat-only" },
    ],
  },
  {
    canonical: "sub",
    category: "structure",
    since: "1.0",
    status: "stable",
    description: "Subsection heading — renders as H3",
    aliases: [
      { alias: "subheading", status: "alias" },
      { alias: "subsection", status: "compat-only" },
      { alias: "h3", status: "compat-only" },
    ],
  },
  {
    canonical: "break",
    category: "structure",
    since: "1.0",
    status: "stable",
    description: "Page break for print — invisible in web",
    aliases: [],
  },
  {
    canonical: "ref",
    category: "structure",
    since: "2.11",
    status: "stable",
    description: "Cross-document reference with typed relationship",
    aliases: [
      { alias: "references", status: "alias" },
      { alias: "see", status: "alias" },
      { alias: "related", status: "alias" },
      { alias: "xref", status: "alias" },
    ],
  },
  {
    canonical: "deadline",
    category: "structure",
    since: "2.11",
    status: "stable",
    description: "Date-bound milestone or due date",
    aliases: [
      { alias: "due", status: "alias" },
      { alias: "milestone", status: "alias" },
      { alias: "by", status: "alias" },
      { alias: "due-date", status: "compat-only" },
    ],
  },
  {
    canonical: "embed",
    category: "structure",
    since: "1.0",
    status: "stable",
    description: "Embed a referenced external resource",
    aliases: [],
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    canonical: "columns",
    category: "data",
    since: "1.0",
    status: "stable",
    description:
      "Table column definitions — declares column names for the following row: blocks",
    aliases: [{ alias: "headers", status: "compat-only" }],
  },
  {
    canonical: "row",
    category: "data",
    since: "1.0",
    status: "stable",
    description: "Table data row — pipe-separated cell values",
    aliases: [],
  },
  {
    canonical: "input",
    category: "data",
    since: "1.3",
    status: "stable",
    description: "Declared input parameter for templates and workflows",
    aliases: [],
  },
  {
    canonical: "output",
    category: "data",
    since: "1.3",
    status: "stable",
    description: "Declared output parameter for templates and workflows",
    aliases: [],
  },
  {
    canonical: "metric",
    category: "data",
    since: "2.11",
    status: "stable",
    description: "Quantitative measurement or KPI",
    aliases: [
      { alias: "kpi", status: "alias" },
      { alias: "measure", status: "alias" },
      { alias: "indicator", status: "alias" },
      { alias: "stat", status: "compat-only" },
    ],
  },

  // ── Agent ────────────────────────────────────────────────────────────────
  {
    canonical: "step",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Workflow step — the basic unit of agent work",
    aliases: [{ alias: "run", status: "alias" }],
  },
  {
    canonical: "gate",
    category: "agent",
    since: "2.2",
    status: "stable",
    description: "Conditional checkpoint — blocks until condition is met",
    aliases: [],
  },
  {
    canonical: "trigger",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Event-based workflow activation",
    aliases: [{ alias: "on", status: "alias" }],
  },
  {
    canonical: "signal",
    category: "agent",
    since: "2.2",
    status: "stable",
    description: "Emit a named workflow signal or event",
    aliases: [
      { alias: "emit", status: "deprecated" },
      { alias: "status", status: "deprecated" },
    ],
  },
  {
    canonical: "decision",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Conditional branching",
    aliases: [{ alias: "if", status: "alias" }],
  },
  {
    canonical: "memory",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Agent memory or persistent state declaration",
    aliases: [],
  },
  {
    canonical: "prompt",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "LLM prompt template",
    aliases: [],
  },
  {
    canonical: "tool",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "External tool or API declaration",
    aliases: [],
  },
  {
    canonical: "audit",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Audit log entry",
    aliases: [{ alias: "log", status: "alias" }],
  },
  {
    canonical: "done",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Completed task item — the resolved state of a task: block",
    aliases: [
      { alias: "completed", status: "compat-only" },
      { alias: "finished", status: "compat-only" },
    ],
  },
  {
    canonical: "error",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Error record with severity and retry metadata",
    aliases: [],
  },
  {
    canonical: "result",
    category: "agent",
    since: "2.1",
    status: "stable",
    description: "Terminal workflow result — final output block",
    aliases: [],
  },
  {
    canonical: "handoff",
    category: "agent",
    since: "2.1",
    status: "stable",
    description: "Transfer control to another agent",
    aliases: [],
  },
  {
    canonical: "wait",
    category: "agent",
    since: "2.1",
    status: "stable",
    description: "Pause execution until an event or timeout",
    aliases: [],
  },
  {
    canonical: "parallel",
    category: "agent",
    since: "2.1",
    status: "stable",
    description: "Run multiple steps concurrently",
    aliases: [],
  },
  {
    canonical: "retry",
    category: "agent",
    since: "2.1",
    status: "stable",
    description: "Retry a failed step with backoff",
    aliases: [],
  },
  {
    canonical: "call",
    category: "agent",
    since: "2.2",
    status: "stable",
    description: "Invoke a sub-workflow by file reference",
    aliases: [],
  },
  {
    canonical: "loop",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Iterate over a collection",
    aliases: [],
  },
  {
    canonical: "checkpoint",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Named workflow checkpoint for resume and rollback",
    aliases: [],
  },
  {
    canonical: "import",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Import a workflow from a file",
    aliases: [],
  },
  {
    canonical: "export",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Export data or workflow output",
    aliases: [],
  },
  {
    canonical: "progress",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Progress indicator for long-running operations",
    aliases: [],
  },
  {
    canonical: "assert",
    category: "agent",
    since: "2.13",
    status: "stable",
    description:
      "Testable assertion — a condition that must be true; evaluable by agents and CI",
    aliases: [
      { alias: "expect", status: "alias" },
      { alias: "verify", status: "alias" },
    ],
  },
  {
    canonical: "secret",
    category: "agent",
    since: "2.13",
    status: "stable",
    description:
      "Secret or credential reference — never rendered; always redacted in output",
    aliases: [
      { alias: "credential", status: "alias" },
      { alias: "token", status: "alias" },
    ],
  },

  // ── Task (human-facing workflow) ─────────────────────────────────────────
  {
    canonical: "task",
    category: "agent",
    since: "1.0",
    status: "stable",
    description: "Actionable task item with owner and due date",
    aliases: [
      { alias: "check", status: "alias" },
      { alias: "todo", status: "alias" },
      { alias: "action", status: "alias" },
      { alias: "item", status: "alias" },
    ],
  },
  {
    canonical: "ask",
    category: "agent",
    since: "1.0",
    status: "stable",
    description: "Question or open item requiring a response",
    aliases: [{ alias: "question", status: "compat-only" }],
  },

  // ── Agent metadata (pre-section) ─────────────────────────────────────────
  {
    canonical: "agent",
    category: "identity",
    since: "2.0",
    status: "stable",
    description: "Agent name/identifier — pre-section metadata",
    aliases: [],
  },
  {
    canonical: "model",
    category: "identity",
    since: "2.0",
    status: "stable",
    description: "Default AI model for this document — pre-section metadata",
    aliases: [],
  },

  // ── Trust ────────────────────────────────────────────────────────────────
  {
    canonical: "approve",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Approval stamp with signatory and role",
    aliases: [],
  },
  {
    canonical: "sign",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Cryptographic digital signature",
    aliases: [],
  },
  {
    canonical: "freeze",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Seal document — prevents further edits",
    aliases: [{ alias: "lock", status: "alias" }],
  },
  {
    canonical: "revision",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Auto-generated revision record in history section",
    aliases: [],
  },
  {
    canonical: "policy",
    category: "agent",
    since: "2.7",
    status: "stable",
    description: "Enforceable constraint or rule",
    aliases: [
      { alias: "rule", status: "alias" },
      { alias: "constraint", status: "alias" },
      { alias: "guard", status: "alias" },
      { alias: "requirement", status: "alias" },
    ],
  },
  {
    canonical: "amendment",
    category: "trust",
    since: "2.11",
    status: "stable",
    description: "Formal change record for a frozen document",
    aliases: [
      { alias: "amend", status: "alias" },
      { alias: "change", status: "alias" },
    ],
  },
  {
    canonical: "history",
    category: "trust",
    since: "2.12",
    status: "boundary",
    description: "History boundary — separates document body from revision log",
    aliases: [],
  },

  // ── Layout ───────────────────────────────────────────────────────────────
  {
    canonical: "page",
    category: "layout",
    since: "2.5",
    status: "stable",
    description: "Page size, margins, and orientation for print",
    aliases: [],
  },
  {
    canonical: "font",
    category: "layout",
    since: "2.5",
    status: "stable",
    description: "Typography settings for print",
    aliases: [],
  },
  {
    canonical: "header",
    category: "layout",
    since: "2.9",
    status: "stable",
    description: "Page header for print output",
    aliases: [],
  },
  {
    canonical: "footer",
    category: "layout",
    since: "2.9",
    status: "stable",
    description: "Page footer for print output",
    aliases: [],
  },
  {
    canonical: "watermark",
    category: "layout",
    since: "2.9",
    status: "stable",
    description: "Background watermark for print output",
    aliases: [],
  },
  {
    canonical: "signline",
    category: "layout",
    since: "2.11",
    status: "stable",
    description: "Physical signature line for print",
    aliases: [
      { alias: "signature-line", status: "alias" },
      { alias: "sign-here", status: "alias" },
      { alias: "sig", status: "compat-only" },
    ],
  },
  {
    canonical: "divider",
    category: "layout",
    since: "2.12",
    status: "stable",
    description: "Visible horizontal rule — also written as ---",
    aliases: [
      { alias: "hr", status: "alias" },
      { alias: "separator", status: "alias" },
    ],
  },

  // ── Document generation writer blocks ────────────────────────────────────
  {
    canonical: "byline",
    category: "content",
    since: "2.5",
    status: "stable",
    description: "Author byline with date and publication",
    aliases: [],
  },
  {
    canonical: "epigraph",
    category: "content",
    since: "2.5",
    status: "stable",
    description: "Introductory quotation at the start of a document",
    aliases: [],
  },
  {
    canonical: "caption",
    category: "content",
    since: "2.5",
    status: "stable",
    description: "Figure or table caption",
    aliases: [],
  },
  {
    canonical: "footnote",
    category: "content",
    since: "2.5",
    status: "stable",
    description: "Numbered footnote",
    aliases: [],
  },
  {
    canonical: "toc",
    category: "structure",
    since: "2.5",
    status: "stable",
    description: "Auto-generated table of contents",
    aliases: [],
  },
  {
    canonical: "dedication",
    category: "content",
    since: "2.5",
    status: "stable",
    description: "Document dedication page",
    aliases: [],
  },
];

// ── Derived helpers ─────────────────────────────────────────────────────────

/** All canonical keyword names (for parser KEYWORDS set). */
export const CANONICAL_KEYWORDS: string[] = LANGUAGE_REGISTRY.map(
  (k) => k.canonical,
);

/** Flat alias → canonical map (for ALIASES). Mirrors the current ALIASES shape. */
export const ALIAS_MAP: Record<string, string> = Object.fromEntries(
  LANGUAGE_REGISTRY.flatMap((k) =>
    k.aliases.map((a) => [a.alias, k.canonical]),
  ),
);

/** All deprecated aliases (for parser warnings). */
export const DEPRECATED_ALIASES: Set<string> = new Set(
  LANGUAGE_REGISTRY.flatMap((k) =>
    k.aliases.filter((a) => a.status === "deprecated").map((a) => a.alias),
  ),
);

/** Compat-only aliases (never show in completion hints or docs). */
export const COMPAT_ONLY_ALIASES: Set<string> = new Set(
  LANGUAGE_REGISTRY.flatMap((k) =>
    k.aliases.filter((a) => a.status === "compat-only").map((a) => a.alias),
  ),
);

/** Boundary keywords — consumed by the parser but produce no block output. */
export const BOUNDARY_KEYWORDS: Set<string> = new Set(
  LANGUAGE_REGISTRY.filter((k) => k.status === "boundary").map(
    (k) => k.canonical,
  ),
);

/** Keywords stable enough to show in editor hints and completion. */
export const PUBLIC_KEYWORDS: KeywordDefinition[] = LANGUAGE_REGISTRY.filter(
  (k) => k.status === "stable" || k.status === "boundary",
);
