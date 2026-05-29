/**
 * IntentText Language Registry — v2.14 Keyword Freeze
 *
 * Single source of truth for the IntentText keyword contract.
 * KEYWORDS array, BlockType union, and ALIASES map are all derived from this.
 *
 * v2.14: Canonical keyword set frozen at 37 keywords.
 * Everything else is an alias, internal type, or extension block.
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

export interface ExtensionEntry {
  /** Legacy bare keyword (e.g. 'byline'). */
  keyword: string;
  /** Extension namespace: writer | doc | agent | trust | layout | exp. */
  namespace: string;
  /** Preferred x-ns: form (e.g. 'x-writer: byline'). */
  xForm: string;
  since: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE 37 CANONICAL KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════

export const LANGUAGE_REGISTRY: KeywordDefinition[] = [
  // ── Document Identity (4) ────────────────────────────────────────────────
  {
    canonical: "title",
    category: "identity",
    since: "1.0",
    status: "stable",
    description: "Unique document title — renders as H1",
    aliases: [{ alias: "h1", status: "compat-only" }],
  },
  {
    canonical: "summary",
    category: "identity",
    since: "1.0",
    status: "stable",
    description: "Short document description",
    aliases: [{ alias: "abstract", status: "alias" }],
  },
  {
    canonical: "meta",
    category: "identity",
    since: "2.8.1",
    status: "stable",
    description: "Document metadata (author, tags, theme, type)",
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

  // ── Structure (3) ───────────────────────────────────────────────────────
  {
    canonical: "section",
    category: "structure",
    since: "1.0",
    status: "stable",
    description: "Major heading / context boundary — renders as H2",
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
    description: "Sub-section — renders as H3",
    aliases: [
      { alias: "subheading", status: "alias" },
      { alias: "h3", status: "compat-only" },
      { alias: "subsection", status: "compat-only" },
    ],
  },
  {
    canonical: "toc",
    category: "structure",
    since: "2.5",
    status: "stable",
    description: "Auto-generated table of contents",
    aliases: [],
  },

  // ── Content (7) ─────────────────────────────────────────────────────────
  {
    canonical: "text",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Body paragraph (note: is alias)",
    aliases: [
      { alias: "note", status: "alias" },
      { alias: "body", status: "alias" },
      { alias: "content", status: "alias" },
      { alias: "paragraph", status: "alias" },
      { alias: "p", status: "compat-only" },
    ],
  },
  {
    canonical: "info",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Callout block (warning/danger/tip/success are aliases with type injection)",
    aliases: [
      { alias: "warning", status: "alias" },
      { alias: "danger", status: "alias" },
      { alias: "tip", status: "alias" },
      { alias: "success", status: "alias" },
      { alias: "alert", status: "alias" },
      { alias: "caution", status: "alias" },
      { alias: "critical", status: "alias" },
      { alias: "destructive", status: "alias" },
      { alias: "hint", status: "alias" },
      { alias: "advice", status: "alias" },
    ],
  },
  {
    canonical: "quote",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Attributed block quotation",
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
    description: "Bibliographic citation (author, date, url) — NOT same as quote",
    aliases: [
      { alias: "citation", status: "alias" },
      { alias: "source", status: "alias" },
      { alias: "reference", status: "alias" },
    ],
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
    description: "Image with optional caption",
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

  // ── Tasks (3) ───────────────────────────────────────────────────────────
  {
    canonical: "task",
    category: "agent",
    since: "1.0",
    status: "stable",
    description: "Actionable item with owner and due date",
    aliases: [
      { alias: "check", status: "alias" },
      { alias: "todo", status: "alias" },
      { alias: "action", status: "alias" },
      { alias: "item", status: "alias" },
    ],
  },
  {
    canonical: "done",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Completed item — the resolved state of a task: block",
    aliases: [
      { alias: "completed", status: "compat-only" },
      { alias: "finished", status: "compat-only" },
    ],
  },
  {
    canonical: "ask",
    category: "agent",
    since: "1.0",
    status: "stable",
    description: "Open question requiring a response",
    aliases: [{ alias: "question", status: "compat-only" }],
  },

  // ── Data (3) ────────────────────────────────────────────────────────────
  {
    canonical: "columns",
    category: "data",
    since: "1.0",
    status: "stable",
    description: "Table column definitions (declares headers for following row: blocks)",
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
    canonical: "metric",
    category: "data",
    since: "2.11",
    status: "stable",
    description: "Named measurement with value",
    aliases: [
      { alias: "kpi", status: "alias" },
      { alias: "measure", status: "alias" },
      { alias: "indicator", status: "alias" },
      { alias: "stat", status: "compat-only" },
    ],
  },

  // ── Agentic Workflow (7) ────────────────────────────────────────────────
  {
    canonical: "step",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Execute a tool or action",
    aliases: [{ alias: "run", status: "alias" }],
  },
  {
    canonical: "decision",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Conditional branch",
    aliases: [{ alias: "if", status: "alias" }],
  },
  {
    canonical: "gate",
    category: "agent",
    since: "2.2",
    status: "stable",
    description: "Human approval checkpoint",
    aliases: [],
  },
  {
    canonical: "trigger",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Workflow entry point",
    aliases: [{ alias: "on", status: "alias" }],
  },
  {
    canonical: "result",
    category: "agent",
    since: "2.1",
    status: "stable",
    description: "Terminal workflow output",
    aliases: [],
  },
  {
    canonical: "policy",
    category: "agent",
    since: "2.7",
    status: "stable",
    description: "Standing behavioural rule",
    aliases: [
      { alias: "rule", status: "alias" },
      { alias: "constraint", status: "alias" },
      { alias: "guard", status: "alias" },
      { alias: "requirement", status: "alias" },
    ],
  },
  {
    canonical: "audit",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Immutable execution record",
    aliases: [{ alias: "log", status: "alias" }],
  },

  // ── Trust (5) ───────────────────────────────────────────────────────────
  {
    canonical: "track",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Start tracking document",
    aliases: [],
  },
  {
    canonical: "approve",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Approval record",
    aliases: [],
  },
  {
    canonical: "sign",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Signature / attestation record",
    aliases: [{ alias: "sig", status: "alias" }],
  },
  {
    canonical: "freeze",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Lock document against changes",
    aliases: [{ alias: "lock", status: "alias" }],
  },
  {
    canonical: "amendment",
    category: "trust",
    since: "2.11",
    status: "stable",
    description: "Formal change to frozen document",
    aliases: [
      { alias: "amend", status: "alias" },
      { alias: "change", status: "alias" },
    ],
  },

  // ── Layout (5) ──────────────────────────────────────────────────────────
  {
    canonical: "page",
    category: "layout",
    since: "2.5",
    status: "stable",
    description: "Page layout declaration (document-level)",
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
    description: "Watermark overlay (print)",
    aliases: [],
  },
  {
    canonical: "break",
    category: "layout",
    since: "1.0",
    status: "stable",
    description: "Print page break — invisible in web, forces new page in print",
    aliases: [],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL / NON-CANONICAL ENTRIES
  // These are NOT in the 37 canonical keywords but remain in the registry
  // for backward compatibility. They are never shown in docs or completions.
  // ═══════════════════════════════════════════════════════════════════════

  {
    canonical: "history",
    category: "trust",
    since: "2.12",
    status: "boundary",
    description: "History boundary — separates document body from revision log",
    aliases: [],
  },
  {
    canonical: "divider",
    category: "layout",
    since: "2.12",
    status: "compat-only",
    description: "Internal: visible horizontal rule — users write --- directly",
    aliases: [
      { alias: "hr", status: "alias" },
      { alias: "separator", status: "alias" },
    ],
  },
  {
    canonical: "revision",
    category: "trust",
    since: "2.8",
    status: "compat-only",
    description: "Internal: auto-generated revision record in history section",
    aliases: [],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// EXTENSION REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const EXTENSION_REGISTRY: ExtensionEntry[] = [
  // ── Writer extensions (x-writer) ────────────────────────────────────────
  { keyword: "byline", namespace: "writer", xForm: "x-writer: byline", since: "2.5", description: "Author byline with date and publication" },
  { keyword: "epigraph", namespace: "writer", xForm: "x-writer: epigraph", since: "2.5", description: "Introductory quotation at the start of a document" },
  { keyword: "figure", namespace: "writer", xForm: "x-writer: figure", since: "2.11", description: "Numbered captioned figure — NOT an alias for image:" },
  { keyword: "caption", namespace: "writer", xForm: "x-writer: caption", since: "2.5", description: "Figure or table caption" },
  { keyword: "footnote", namespace: "writer", xForm: "x-writer: footnote", since: "2.5", description: "Numbered footnote" },
  { keyword: "dedication", namespace: "writer", xForm: "x-writer: dedication", since: "2.5", description: "Document dedication page" },

  // ── Document extensions (x-doc) ─────────────────────────────────────────
  { keyword: "def", namespace: "doc", xForm: "x-doc: def", since: "2.11", description: "Term definition — inline or glossary entry" },
  { keyword: "contact", namespace: "doc", xForm: "x-doc: contact", since: "2.11", description: "Person or organization contact information" },
  { keyword: "deadline", namespace: "doc", xForm: "x-doc: deadline", since: "2.11", description: "Date-bound milestone or due date" },
  { keyword: "ref", namespace: "doc", xForm: "x-doc: ref", since: "2.11", description: "Cross-document reference with typed relationship" },
  { keyword: "signline", namespace: "doc", xForm: "x-doc: signline", since: "2.11", description: "Physical signature line for print" },

  // ── Agent extensions (x-agent) ──────────────────────────────────────────
  { keyword: "loop", namespace: "agent", xForm: "x-agent: loop", since: "2.0", description: "Iterate over a collection" },
  { keyword: "parallel", namespace: "agent", xForm: "x-agent: parallel", since: "2.1", description: "Run multiple steps concurrently" },
  { keyword: "retry", namespace: "agent", xForm: "x-agent: retry", since: "2.1", description: "Retry a failed step with backoff" },
  { keyword: "wait", namespace: "agent", xForm: "x-agent: wait", since: "2.1", description: "Pause execution until an event or timeout" },
  { keyword: "handoff", namespace: "agent", xForm: "x-agent: handoff", since: "2.1", description: "Transfer control to another agent" },
  { keyword: "call", namespace: "agent", xForm: "x-agent: call", since: "2.2", description: "Invoke a sub-workflow by file reference" },
  { keyword: "checkpoint", namespace: "agent", xForm: "x-agent: checkpoint", since: "2.0", description: "Named workflow checkpoint for resume and rollback" },
  { keyword: "error", namespace: "agent", xForm: "x-agent: error", since: "2.0", description: "Error record with severity and retry metadata" },
  { keyword: "import", namespace: "agent", xForm: "x-agent: import", since: "2.0", description: "Import a workflow from a file" },
  { keyword: "export", namespace: "agent", xForm: "x-agent: export", since: "2.0", description: "Export data or workflow output" },
  { keyword: "progress", namespace: "agent", xForm: "x-agent: progress", since: "2.0", description: "Progress indicator for long-running operations" },
  { keyword: "agent", namespace: "agent", xForm: "x-agent: agent", since: "2.0", description: "Document-level agent name/identifier config" },
  { keyword: "model", namespace: "agent", xForm: "x-agent: model", since: "2.0", description: "Default AI model for this document" },
  { keyword: "tool", namespace: "agent", xForm: "x-agent: tool", since: "2.0", description: "External tool or API declaration" },
  { keyword: "prompt", namespace: "agent", xForm: "x-agent: prompt", since: "2.0", description: "LLM prompt template" },
  { keyword: "memory", namespace: "agent", xForm: "x-agent: memory", since: "2.0", description: "Agent memory or persistent state declaration" },
  { keyword: "signal", namespace: "agent", xForm: "x-agent: signal", since: "2.2", description: "Emit a named workflow signal or event" },
  { keyword: "embed", namespace: "agent", xForm: "x-agent: embed", since: "1.0", description: "Embed a referenced external resource" },

  // ── Trust extensions (x-trust) ──────────────────────────────────────────
  // history: and revision: are kept as internal types in the registry for
  // backward compat. They are listed here for documentation only.
  { keyword: "history", namespace: "trust", xForm: "x-trust: history", since: "2.12", description: "History boundary marker" },
  { keyword: "revision", namespace: "trust", xForm: "x-trust: revision", since: "2.8", description: "Auto-generated revision record" },

  // ── Layout extensions (x-layout) ───────────────────────────────────────
  { keyword: "font", namespace: "layout", xForm: "x-layout: font", since: "2.5", description: "Typography settings (use page: properties instead)" },

  // ── Experimental extensions (x-exp) ─────────────────────────────────────
  { keyword: "assert", namespace: "exp", xForm: "x-exp: assert", since: "2.13", description: "Testable assertion — evaluable by agents and CI" },
  { keyword: "secret", namespace: "exp", xForm: "x-exp: secret", since: "2.13", description: "Secret or credential reference — never rendered" },
  { keyword: "input", namespace: "exp", xForm: "x-exp: input", since: "1.3", description: "Declared input parameter for templates and workflows" },
  { keyword: "output", namespace: "exp", xForm: "x-exp: output", since: "1.3", description: "Declared output parameter for templates and workflows" },
];

// ── Derived helpers ─────────────────────────────────────────────────────────

/** All canonical keyword names (stable entries only — exactly 37). */
export const CANONICAL_KEYWORDS: string[] = LANGUAGE_REGISTRY.filter(
  (k) => k.status === "stable",
).map((k) => k.canonical);

/** Total canonical keyword count — frozen at 37. */
export const KEYWORD_COUNT = CANONICAL_KEYWORDS.length; // 37

/** Total extension keyword count. */
export const EXTENSION_COUNT = EXTENSION_REGISTRY.length;

/** All keywords in the registry (canonical + boundary + compat-only). */
const ALL_REGISTRY_KEYWORDS: string[] = LANGUAGE_REGISTRY.map(
  (k) => k.canonical,
);

/** Flat alias → canonical/internal map (for ALIASES). */
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

/** Compat-only canonicals — recognized by the parser but not in CANONICAL_KEYWORDS. */
export const COMPAT_KEYWORDS: string[] = LANGUAGE_REGISTRY.filter(
  (k) => k.status === "compat-only",
).map((k) => k.canonical);

/** Keywords stable enough to show in editor hints and completion (37 canonical). */
export const PUBLIC_KEYWORDS: KeywordDefinition[] = LANGUAGE_REGISTRY.filter(
  (k) => k.status === "stable",
);

/**
 * Callout alias → callout variant type.
 * When these aliases resolve to 'info', the parser injects properties.type
 * with the variant name so the renderer can distinguish callout styles.
 */
export const CALLOUT_ALIAS_MAP: Record<string, string> = {
  warning: "warning",
  alert: "warning",
  caution: "warning",
  danger: "danger",
  critical: "danger",
  destructive: "danger",
  tip: "tip",
  hint: "tip",
  advice: "tip",
  success: "success",
};

/** Set of all extension bare keywords (for parser recognition). */
export const EXTENSION_KEYWORDS: Set<string> = new Set(
  EXTENSION_REGISTRY.map((e) => e.keyword),
);

/** Map from extension keyword to its namespace. */
export const EXTENSION_NS_MAP: Record<string, string> = Object.fromEntries(
  EXTENSION_REGISTRY.map((e) => [e.keyword, e.namespace]),
);

/**
 * Set of all extension keyword aliases that should also be recognized.
 * These are former aliases of keywords that are now extensions.
 */
export const EXTENSION_LEGACY_ALIASES: Record<string, string> = {
  // Former aliases of extension keywords — resolve to the extension keyword
  // figure aliases
  fig: "figure",
  diagram: "figure",
  chart: "figure",
  illustration: "figure",
  visual: "figure",
  // def aliases
  define: "def",
  term: "def",
  glossary: "def",
  // contact aliases
  person: "contact",
  party: "contact",
  entity: "contact",
  // ref aliases
  references: "ref",
  see: "ref",
  related: "ref",
  xref: "ref",
  // deadline aliases
  due: "deadline",
  milestone: "deadline",
  by: "deadline",
  "due-date": "deadline",
  // signline aliases
  "signature-line": "signline",
  "sign-here": "signline",
  // signal aliases
  emit: "signal",
  status: "signal",
  // assert aliases
  expect: "assert",
  verify: "assert",
  // secret aliases
  credential: "secret",
  token: "secret",
};
