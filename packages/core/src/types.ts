export interface IntentBlock {
  id: string; // auto-generated UUID or sequential ID
  type: BlockType; // title | section | sub | task | done | ask | quote
  // note | headers | row | image | link | code
  // divider | summary | list-item | step-item | body-text
  content: string; // primary text value (inline marks already parsed)
  originalContent?: string; // original text with formatting marks
  properties?: Record<string, string | number>; // pipe metadata: owner, due, time, at, to, caption, title, ...
  inline?: InlineNode[];
  children?: IntentBlock[]; // nested blocks (e.g. list-items inside a section)
  table?: {
    headers?: string[];
    rows: string[][];
  };
}

/** All recognized keywords for the IntentText parser (v1 + v2 agentic). */
export const KEYWORDS = [
  // v1 core keywords
  "title",
  "summary",
  "section",
  "sub",
  "subsection", // alias → sub
  "divider",
  "note",
  "info",
  "warning",
  "tip",
  "success",
  "headers",
  "row",
  "task",
  "done",
  "ask",
  "question", // alias → ask
  "quote",
  "image",
  "link",
  "ref",
  "embed",
  "code",
  "end",
  // v2 agentic workflow keywords
  "step",
  "decision",
  "trigger",
  "loop",
  "checkpoint",
  "audit",
  "error",
  "import",
  "export",
  "progress",
  "context",
  "agent",
  "model",
  // v2.1 agentic workflow keywords
  "result",
  "handoff",
  "wait",
  "parallel",
  "retry",
  // v2.2 agentic workflow keywords
  "gate",
  "call",
  "emit",
  "status", // alias → emit (deprecated)
  // v2.7 agentic workflow keywords
  "policy",
  // v2.8 document trust keywords
  "track",
  "approve",
  "sign",
  "freeze",
  "revision",
  // v2.5 document generation keywords
  "font",
  "page",
  "break",
  "byline",
  "epigraph",
  "caption",
  "footnote",
  "toc",
  "dedication",
];

/** All valid block types for IntentText (v1 + v2 agentic). */
export type BlockType =
  // v1 core block types
  | "title"
  | "summary"
  | "section"
  | "sub"
  | "divider"
  | "note"
  | "info"
  | "warning"
  | "tip"
  | "success"
  | "headers"
  | "row"
  | "table"
  | "extension"
  | "task"
  | "done"
  | "ask"
  | "quote"
  | "image"
  | "link"
  | "ref"
  | "embed"
  | "code"
  | "end"
  | "list-item"
  | "step-item"
  | "body-text"
  // v2 agentic workflow block types
  | "step"
  | "decision"
  | "trigger"
  | "loop"
  | "checkpoint"
  | "audit"
  | "error"
  | "import"
  | "export"
  | "progress"
  | "context"
  // v2.1 agentic workflow block types
  | "result"
  | "handoff"
  | "wait"
  | "parallel"
  | "retry"
  // v2.2 agentic workflow block types
  | "gate"
  | "call"
  | "emit"
  // v2.7 agentic workflow block types
  | "policy"
  // v2.8 document trust block types
  | "track"
  | "approve"
  | "sign"
  | "freeze"
  | "revision"
  // v2.5 document generation block types
  | "font"
  | "page"
  | "break"
  | "byline"
  | "epigraph"
  | "caption"
  | "footnote"
  | "toc"
  | "dedication";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "inline-quote"; value: string }
  | { type: "highlight"; value: string }
  | { type: "code"; value: string }
  | { type: "inline-note"; value: string }
  | { type: "date"; value: string; iso: string }
  | { type: "mention"; value: string }
  | { type: "tag"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "footnote-ref"; value: string };

export interface IntentExtension {
  keywords?: string[];
  parseBlock?: (args: {
    keyword: string;
    content: string;
    properties?: Record<string, string | number>;
    line: number;
    column: number;
    parseInline: (text: string) => { content: string; inline: InlineNode[] };
  }) => IntentBlock | null | undefined;
  parseInline?: (args: {
    text: string;
    defaultParseInline: (text: string) => {
      content: string;
      inline: InlineNode[];
    };
  }) => { content: string; inline: InlineNode[] } | null | undefined;
  validate?: (document: IntentDocument) => Diagnostic[];
}

export interface ParseOptions {
  extensions?: IntentExtension[];
  /** v2.8: If true, parse the history section below the boundary and attach to document.history. Default: false. */
  includeHistorySection?: boolean;
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line: number;
  column: number;
  code:
    | "UNTERMINATED_CODE_BLOCK"
    | "UNEXPECTED_END"
    | "INVALID_PROPERTY_SEGMENT"
    | "HEADERS_WITHOUT_ROWS"
    | "ROW_WITHOUT_HEADERS"
    | "UNKNOWN_EXTENSION_KEYWORD"
    | "EXTENSION_VALIDATION";
}

/** Execution status values for agentic workflow blocks. */
export type AgenticStatus =
  | "pending"
  | "running"
  | "blocked"
  | "failed"
  | "skipped"
  | "cancelled"
  | "done"
  | "approved"
  | "rejected"
  | "waiting";

/** A variable reference produced by {{variable}} interpolation. */
export interface VariableRef {
  $ref: string;
}

/** Document-level metadata including v2 agentic fields. */
export interface IntentDocumentMetadata {
  title?: string;
  summary?: string;
  language?: "ltr" | "rtl";
  /** Agent name or identifier for this document. */
  agent?: string;
  /** Default AI model for this document. */
  model?: string;
  /** Scoped context variables defined via `context:` blocks. */
  context?: Record<string, string>;
  /** Document version string. */
  version?: string;
  /** v2.8: Document tracking state, populated from track: block. */
  tracking?: {
    version: string;
    by: string;
    active: boolean;
  };
  /** v2.8: Cryptographic signatures from sign: blocks. */
  signatures?: Array<{
    signer: string;
    role?: string;
    at: string;
    hash: string;
    valid?: boolean;
  }>;
  /** v2.8: Freeze (seal) state from freeze: block. */
  freeze?: {
    at: string;
    hash: string;
    status: "locked";
  };
}

export interface IntentDocument {
  version?: string;
  blocks: IntentBlock[];
  metadata?: IntentDocumentMetadata;
  diagnostics?: Diagnostic[];
  /** v2.8: History section data, only populated when includeHistorySection is true. */
  history?: HistorySection;
}

/** v2.8: Parsed history section below the history boundary. */
export interface HistorySection {
  registry: RegistryEntry[];
  revisions: RevisionEntry[];
  raw: string;
}

export interface RegistryEntry {
  id: string;
  blockType: string;
  section: string;
  fingerprint: string;
  dead?: boolean;
}

export interface RevisionEntry {
  version: string;
  at: string;
  by: string;
  change: "added" | "removed" | "modified" | "moved";
  id: string;
  block: string;
  section?: string;
  was?: string;
  now?: string;
  wasSection?: string;
  nowSection?: string;
}

// Query types
export interface QueryClause {
  field: string;
  operator:
    | "="
    | "!="
    | "<"
    | ">"
    | "<="
    | ">="
    | "contains"
    | "startsWith"
    | "exists";
  value?: string | number | boolean;
}

export interface QuerySort {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryOptions {
  where?: QueryClause[];
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  blocks: IntentBlock[];
  total: number;
  matched: number;
}

// Schema types
export interface PropertySchema {
  type: "string" | "number" | "boolean" | "date" | "enum" | "url" | "email";
  required?: boolean;
  default?: string | number | boolean;
  enumValues?: string[];
  pattern?: string;
  min?: number;
  max?: number;
  format?: "iso-date" | "iso-datetime" | "time" | "url" | "email";
}

export interface BlockSchema {
  type: BlockType;
  content?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  properties?: Record<string, PropertySchema>;
  allowUnknownProperties?: boolean;
}

export interface DocumentSchema {
  name: string;
  description?: string;
  requiredBlocks?: BlockType[];
  blockSchemas?: Record<string, BlockSchema>;
  allowUnknownBlocks?: boolean;
}

export interface ValidationError {
  blockId: string;
  blockType: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
