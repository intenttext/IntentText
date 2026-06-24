/**
 * IntentText Language Registry — Keyword Freeze
 *
 * Single source of truth for the IntentText keyword contract.
 * KEYWORDS array, BlockType union, and the localized-keyword map derive from this.
 *
 * 41 canonical keywords (frozen at 37; 38 since `style` 4.3; 41 since route/require/certify 4.4).
 * NO convenience aliases: the only non-canonical resolutions are Arabic LOCALIZED keyword names
 * (عنوان→title …) — first-class and collision-free. EVERY other unreserved word resolves to a
 * `custom` block (the open vocabulary). Everything else is an internal type or extension block.
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
 * alias       — localized (Arabic) keyword name that resolves to a canonical keyword
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
// THE 41 CANONICAL KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════

export const LANGUAGE_REGISTRY: KeywordDefinition[] = [
  // ── Document Identity (4) ────────────────────────────────────────────────
  {
    canonical: "title",
    category: "identity",
    since: "1.0",
    status: "stable",
    description: "Unique document title — renders as H1",
    aliases: [{ alias: "عنوان", status: "alias" }],
  },
  {
    canonical: "summary",
    category: "identity",
    since: "1.0",
    status: "stable",
    description: "Short document description",
    aliases: [{ alias: "ملخص", status: "alias" }],
  },
  {
    canonical: "meta",
    category: "identity",
    since: "2.8.1",
    status: "stable",
    description: "Document metadata (author, tags, theme, type)",
    aliases: [{ alias: "بيانات", status: "alias" }, ],
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
    aliases: [{ alias: "قسم", status: "alias" }],
  },
  {
    canonical: "sub",
    category: "structure",
    since: "1.0",
    status: "stable",
    description: "Sub-section — renders as H3",
    aliases: [{ alias: "فرعي", status: "alias" }],
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
    description: "Body paragraph",
    aliases: [{ alias: "نص", status: "alias" }],
  },
  {
    canonical: "info",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Callout block — set the variant with type: tip|info|warning|danger|success",
    aliases: [{ alias: "تنبيه", status: "alias" }],
  },
  {
    canonical: "quote",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Attributed block quotation",
    aliases: [{ alias: "اقتباس", status: "alias" }],
  },
  {
    canonical: "code",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Code block with optional language for syntax highlighting",
    aliases: [{ alias: "شيفرة", status: "alias" }],
  },
  {
    canonical: "image",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Image with optional caption",
    aliases: [{ alias: "صورة", status: "alias" }],
  },
  {
    canonical: "link",
    category: "content",
    since: "1.0",
    status: "stable",
    description: "Hyperlink to an external resource",
    aliases: [{ alias: "رابط", status: "alias" }],
  },

  // ── Tasks (3) ───────────────────────────────────────────────────────────
  {
    canonical: "task",
    category: "agent",
    since: "1.0",
    status: "stable",
    description: "Actionable item with owner and due date",
    aliases: [{ alias: "مهمة", status: "alias" }],
  },
  {
    canonical: "done",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Completed item — the resolved state of a task: block",
    aliases: [{ alias: "منجز", status: "alias" }],
  },
  {
    canonical: "ask",
    category: "agent",
    since: "1.0",
    status: "stable",
    description: "Open question requiring a response",
    aliases: [],
  },

  // ── Data (3) ────────────────────────────────────────────────────────────
  {
    // `headers` is the canonical table-header keyword (what the serializer emits and
    // what authors expect). `columns:` is no longer an alias — it now resolves to a
    // `custom` block like any other unreserved word.
    canonical: "headers",
    category: "data",
    since: "1.0",
    status: "stable",
    description: "Table header row — column labels for the following row: blocks",
    aliases: [{ alias: "أعمدة", status: "alias" }],
  },
  {
    canonical: "row",
    category: "data",
    since: "1.0",
    status: "stable",
    description: "Table data row — pipe-separated cell values",
    aliases: [{ alias: "صف", status: "alias" }, ],
  },
  {
    canonical: "metric",
    category: "data",
    since: "2.11",
    status: "stable",
    description: "Named measurement with value",
    aliases: [{ alias: "مؤشر", status: "alias" }],
  },

  // ── Agentic Workflow (7) ────────────────────────────────────────────────
  {
    canonical: "step",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Execute a tool or action",
    aliases: [],
  },
  {
    canonical: "decision",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Conditional branch",
    aliases: [],
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
    aliases: [],
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
    aliases: [],
  },
  {
    canonical: "audit",
    category: "agent",
    since: "2.0",
    status: "stable",
    description: "Immutable execution record",
    aliases: [],
  },

  // ── Trust (6) ───────────────────────────────────────────────────────────
  {
    canonical: "track",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Start tracking document",
    aliases: [{ alias: "تتبع", status: "alias" }, ],
  },
  {
    canonical: "approve",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Approval record",
    aliases: [{ alias: "اعتماد", status: "alias" }, ],
  },
  {
    canonical: "sign",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Signature / attestation record",
    aliases: [{ alias: "توقيع", status: "alias" }],
  },
  {
    canonical: "freeze",
    category: "trust",
    since: "2.8",
    status: "stable",
    description: "Lock document against changes",
    aliases: [{ alias: "تجميد", status: "alias" }],
  },
  {
    canonical: "amendment",
    category: "trust",
    since: "2.11",
    status: "stable",
    description: "Formal change to frozen document",
    // SECURITY (FORMAT-REVIEW T-01): a hash-excluded trust keyword must have NO
    // ASCII-word alias. `amendment` and `certify` are dropped from the content hash
    // (trust.ts), and leadKeyword resolves aliases BEFORE that exclusion — so any
    // English-word alias (`change`, `amend`, …) would let an ordinary sentence
    // resolve into a trust keyword and silently vanish from a seal. Only the
    // deliberate localized term (Arabic تعديل, the formal equivalent) remains.
    aliases: [{ alias: "تعديل", status: "alias" }],
  },
  {
    canonical: "certify",
    category: "trust",
    since: "4.4",
    status: "stable",
    description:
      "Authority certification record — an issuer attests to the content, verified ABOVE the hash with the issuer's key. Presence alone is a CLAIM, never a verdict (anyone can paste a certify: line).",
    aliases: [],
  },

  // ── Approval routing (2) ──────────────────────────────────────────────────
  // route:/require: declare a document's in-file approval policy; workflowState()
  // derives live state from them and the approve: lines. Reserved (FORMAT-REVIEW
  // T-02) so the keywords the workflow engine actually reads are honest in the
  // registry instead of being parsed as generic custom blocks.
  {
    canonical: "route",
    category: "agent",
    since: "4.4",
    status: "stable",
    description: "Approval routing order for the document: sequential (default) or parallel",
    aliases: [],
  },
  {
    canonical: "require",
    category: "agent",
    since: "4.4",
    status: "stable",
    description:
      "Declares a required approver (optionally conditional via when:) in the document's approval route",
    aliases: [],
  },

  // ── Layout (5) ──────────────────────────────────────────────────────────
  {
    canonical: "page",
    category: "layout",
    since: "2.5",
    status: "stable",
    description: "Page layout declaration (document-level)",
    aliases: [{ alias: "صفحة", status: "alias" }, ],
  },
  {
    canonical: "header",
    category: "layout",
    since: "2.9",
    status: "stable",
    description: "Page header for print output",
    aliases: [{ alias: "ترويسة", status: "alias" }, ],
  },
  {
    canonical: "footer",
    category: "layout",
    since: "2.9",
    status: "stable",
    description: "Page footer for print output",
    aliases: [{ alias: "تذييل", status: "alias" }, ],
  },
  {
    canonical: "watermark",
    category: "layout",
    since: "2.9",
    status: "stable",
    description: "Watermark overlay (print)",
    aliases: [{ alias: "علامة", status: "alias" }, ],
  },
  {
    canonical: "style",
    category: "layout",
    since: "4.3",
    status: "stable",
    description:
      "Scoped document style rule: maps a block type to style properties (house styling without per-line props)",
    aliases: [{ alias: "نمط", status: "alias" }, ],
  },
  {
    canonical: "break",
    category: "layout",
    since: "1.0",
    status: "stable",
    description: "Print page break — invisible in web, forces new page in print",
    aliases: [{ alias: "فاصل", status: "alias" }, ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL / NON-CANONICAL ENTRIES
  // These are NOT in the 41 canonical keywords but remain in the registry
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
    aliases: [],
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
  { keyword: "attach", namespace: "doc", xForm: "x-doc: attach", since: "1.16", description: "Embedded or linked file attachment — key/name/mime/size/sha256/data, or href for external (read by attachments.ts; part of the sealed body)" },

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

  // ── Form / parameter extensions (x-form) ────────────────────────────────
  // input/output are the typed-parameter primitive for templates, fillable forms,
  // and agent tool manifests. Promoted out of the experimental (x-exp) namespace
  // to a STABLE namespace (FORMAT-REVIEW T-03) so adopters can build on them — the
  // bare `input:`/`output:` keywords and their block types are UNCHANGED, so this
  // is a stability/classification signal only (no grammar or byte-level change).
  { keyword: "input", namespace: "form", xForm: "x-form: input", since: "1.3", description: "Declared input parameter for templates, forms, and workflows" },
  { keyword: "output", namespace: "form", xForm: "x-form: output", since: "1.3", description: "Declared output parameter for templates, forms, and workflows" },
];

// ── Derived helpers ─────────────────────────────────────────────────────────

/** All canonical keyword names (stable entries only — exactly 41). */
export const CANONICAL_KEYWORDS: string[] = LANGUAGE_REGISTRY.filter(
  (k) => k.status === "stable",
).map((k) => k.canonical);

/** Total canonical keyword count — 41 (38 at the 4.3 line + route/require/certify in 4.4). */
export const KEYWORD_COUNT = CANONICAL_KEYWORDS.length; // 41

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

/** Keywords stable enough to show in editor hints and completion (41 canonical). */
export const PUBLIC_KEYWORDS: KeywordDefinition[] = LANGUAGE_REGISTRY.filter(
  (k) => k.status === "stable",
);

// ═══════════════════════════════════════════════════════════════════════════
// KEYWORD TIERS (v4.1)
//
// Tiers classify the canonical keywords so tools and docs can present a small
// everyday "core" set with opt-in profiles, instead of one flat list of ~37.
// Tiering is presentation/contract metadata only — the parser still recognizes
// every keyword regardless of tier. A document opts into a profile to signal
// intent; keywords outside any active profile still parse (or, in a future
// strict mode, fall through to `custom` passthrough — never an error).
// ═══════════════════════════════════════════════════════════════════════════

export type KeywordTier = "core" | "agent" | "contract" | "data" | "print";

/** Default tier for each keyword category. */
const CATEGORY_TIER: Record<KeywordCategory, KeywordTier> = {
  identity: "core",
  structure: "core",
  content: "core",
  agent: "agent",
  data: "data",
  trust: "contract",
  layout: "print",
};

/** Per-keyword overrides where a keyword belongs to a different tier than its category default. */
const TIER_OVERRIDES: Record<string, KeywordTier> = {
  // Universally useful — promoted into the everyday core set.
  task: "core",
  done: "core",
  // Reclassified to the profile they actually belong to.
  context: "agent",
  toc: "print",
  // Approval routing pairs with approvals/signatures → the contract profile,
  // though the keywords are categorized as agent (workflow) primitives.
  route: "contract",
  require: "contract",
};

/** Resolve the tier of a single keyword definition. */
export function tierOf(def: KeywordDefinition): KeywordTier {
  return TIER_OVERRIDES[def.canonical] ?? CATEGORY_TIER[def.category];
}

/** Canonical keywords grouped by tier (stable status only). */
export const KEYWORD_TIERS: Record<KeywordTier, string[]> = (() => {
  const tiers: Record<KeywordTier, string[]> = {
    core: [],
    agent: [],
    contract: [],
    data: [],
    print: [],
  };
  for (const def of LANGUAGE_REGISTRY) {
    if (def.status !== "stable") continue;
    tiers[tierOf(def)].push(def.canonical);
  }
  return tiers;
})();

/** The everyday core keyword set — all a plain `.it` document needs. */
export const CORE_KEYWORDS: string[] = KEYWORD_TIERS.core;

/**
 * Callout variant map (legacy). Callout variants are now set explicitly via the
 * `type:` property (`info: … | type: warning`) — there are NO callout-keyword
 * aliases. Kept as an empty map so existing importers keep working.
 */
export const CALLOUT_ALIAS_MAP: Record<string, string> = {};

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
  // Localized (Arabic) names for extension keywords — they resolve to the extension
  // keyword and round-trip preserving the written form. There are NO Latin aliases:
  // every unreserved, non-localized word resolves to a `custom` block, so the open
  // vocabulary can never silently collide with a hidden synonym (party, milestone,
  // due, term, status, … are now ordinary custom keywords).
  "مهلة": "deadline",
  "جهة": "contact",
  "تواصل": "contact",
  "تعريف": "def",
  "مرجع": "ref",
};
