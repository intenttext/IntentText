export const ALL_KEYWORDS = [
  // Document identity (4)
  "title",
  "summary",
  "meta",
  "context",
  // Structure (3)
  "section",
  "sub",
  "toc",
  // Content (7)
  "text",
  "info",
  "quote",
  "cite",
  "code",
  "image",
  "link",
  // Tasks (3)
  "task",
  "done",
  "ask",
  // Data (3)
  "columns",
  "row",
  "metric",
  // Agentic workflow (7)
  "step",
  "decision",
  "gate",
  "trigger",
  "result",
  "policy",
  "audit",
  // Trust (5)
  "track",
  "approve",
  "sign",
  "freeze",
  "amendment",
  // Layout (5)
  "page",
  "header",
  "footer",
  "watermark",
  "break",
] as const;

/** Extension keyword namespaces — use as `x-writer: byline`, `x-agent: loop`, etc. */
export const EXTENSION_NAMESPACES = [
  "x-writer",
  "x-doc",
  "x-agent",
  "x-trust",
  "x-layout",
  "x-exp",
] as const;

/** Deprecated aliases — still parse correctly but prefer canonical forms above. */
export const DEPRECATED_KEYWORDS = [
  // info: aliases
  "warning",
  "danger",
  "tip",
  "success",
  // text: aliases
  "note",
  // quote: aliases
  "blockquote",
  "excerpt",
  // section: aliases
  "heading",
  "chapter",
  // sub: aliases
  "subheading",
  // task: aliases
  "todo",
  "action",
  // done: aliases
  "completed",
  "finished",
  // ask: aliases
  "question",
  // metric: aliases
  "stat",
  "kpi",
  // image: aliases
  "img",
  "photo",
  // link: aliases
  "url",
  "href",
  // sign: aliases
  "sig",
  // amendment: aliases
  "amend",
] as const;


export interface PropertySchema {
  key: string;
  label: string;
  placeholder?: string;
  options?: string[];
}

export const BLOCK_SCHEMAS: Record<string, PropertySchema[]> = {
  step: [
    { key: "tool", label: "Tool to execute", placeholder: "tool-name" },
    { key: "input", label: "Input data", placeholder: "data" },
    { key: "output", label: "Output variable", placeholder: "var" },
    { key: "depends", label: "Step dependency", placeholder: "step-id" },
    { key: "id", label: "Unique step ID", placeholder: "step-id" },
    {
      key: "status",
      label: "Execution status",
      options: ["pending", "running", "done", "failed", "blocked"],
    },
    { key: "timeout", label: "Timeout duration", placeholder: "30s" },
  ],
  gate: [
    { key: "approver", label: "Approver", placeholder: "person-or-team" },
    { key: "timeout", label: "Timeout", placeholder: "24h" },
    { key: "fallback", label: "Fallback action", placeholder: "step-id" },
  ],
  decision: [
    { key: "if", label: "Condition", placeholder: "condition" },
    { key: "then", label: "True branch step", placeholder: "step-id" },
    { key: "else", label: "False branch step", placeholder: "step-id" },
  ],
  task: [
    { key: "owner", label: "Task owner", placeholder: "person" },
    { key: "due", label: "Due date", placeholder: "2026-03-15" },
    { key: "priority", label: "Priority", options: ["1", "2", "3"] },
    { key: "status", label: "Status", options: ["pending", "done"] },
  ],
  done: [
    { key: "owner", label: "Task owner", placeholder: "person" },
    { key: "due", label: "Due date", placeholder: "2026-03-15" },
  ],
  ask: [
    { key: "to", label: "Directed to", placeholder: "person" },
    { key: "priority", label: "Priority", options: ["1", "2", "3"] },
  ],
  parallel: [
    {
      key: "steps",
      label: "Step IDs to run in parallel",
      placeholder: "step-a,step-b",
    },
    { key: "join", label: "Join strategy", options: ["all", "any"] },
  ],
  retry: [
    { key: "max", label: "Max retries", placeholder: "3" },
    { key: "delay", label: "Delay between retries", placeholder: "5s" },
    {
      key: "backoff",
      label: "Backoff strategy",
      options: ["linear", "exponential"],
    },
  ],
  handoff: [
    { key: "from", label: "Source agent", placeholder: "agent-a" },
    { key: "to", label: "Target agent", placeholder: "agent-b" },
  ],
  call: [
    { key: "input", label: "Input data", placeholder: "data" },
    { key: "output", label: "Output variable", placeholder: "var" },
  ],
  trigger: [
    { key: "event", label: "Trigger event", placeholder: "event-name" },
    { key: "condition", label: "Trigger condition", placeholder: "expression" },
  ],
  loop: [
    { key: "over", label: "Iterable", placeholder: "items" },
    { key: "as", label: "Loop variable", placeholder: "item" },
    { key: "max", label: "Max iterations", placeholder: "100" },
  ],
  wait: [
    { key: "for", label: "Wait condition", placeholder: "step-id" },
    { key: "timeout", label: "Timeout", placeholder: "30s" },
  ],
  result: [
    { key: "depends", label: "Depends on step", placeholder: "step-id" },
  ],
  checkpoint: [{ key: "save", label: "Data to save", placeholder: "key" }],
  policy: [
    { key: "if", label: "Condition expression", placeholder: "condition" },
    {
      key: "always",
      label: "Unconditional requirement",
      placeholder: "behaviour",
    },
    {
      key: "never",
      label: "Unconditional prohibition",
      placeholder: "behaviour",
    },
    {
      key: "action",
      label: "Consequence when rule applies",
      placeholder: "action",
    },
    {
      key: "requires",
      label: "Prerequisite approval",
      placeholder: "approver",
    },
    { key: "notify", label: "Alert recipient", placeholder: "team" },
    { key: "priority", label: "Rule evaluation order", placeholder: "1" },
    { key: "scope", label: "Where this rule applies", placeholder: "scope" },
    { key: "after", label: "Fire after N occurrences", placeholder: "3_turns" },
  ],
  image: [
    { key: "src", label: "Image URL", placeholder: "https://..." },
    { key: "alt", label: "Alt text", placeholder: "description" },
    { key: "caption", label: "Caption", placeholder: "Figure 1" },
    { key: "width", label: "Width", placeholder: "100%" },
  ],
  link: [
    { key: "href", label: "URL", placeholder: "https://..." },
    { key: "title", label: "Link title", placeholder: "title" },
  ],
  embed: [
    { key: "src", label: "Embed URL", placeholder: "https://..." },
    { key: "type", label: "Embed type", options: ["iframe", "video", "audio"] },
  ],
  code: [{ key: "lang", label: "Language", placeholder: "js" }],
  font: [
    { key: "family", label: "Font family", placeholder: "Georgia" },
    { key: "size", label: "Font size", placeholder: "12pt" },
    { key: "leading", label: "Line height", placeholder: "1.6" },
    { key: "weight", label: "Font weight", placeholder: "400" },
    { key: "heading", label: "Heading font", placeholder: "Helvetica" },
    { key: "mono", label: "Monospace font", placeholder: "Fira Code" },
  ],
  page: [
    { key: "size", label: "Page size", options: ["A4", "Letter", "Legal"] },
    { key: "margins", label: "Margins", placeholder: "2.5cm" },
    { key: "header", label: "Header text", placeholder: "text" },
    { key: "footer", label: "Footer text", placeholder: "text" },
    { key: "columns", label: "Column count", options: ["1", "2", "3"] },
    {
      key: "numbering",
      label: "Page numbering",
      options: ["arabic", "roman", "none"],
    },
    {
      key: "orientation",
      label: "Orientation",
      options: ["portrait", "landscape"],
    },
  ],
  byline: [
    { key: "date", label: "Publication date", placeholder: "2026-03-05" },
    { key: "publication", label: "Publication name", placeholder: "name" },
    { key: "role", label: "Author role", placeholder: "Senior Editor" },
  ],
  footnote: [{ key: "text", label: "Footnote text", placeholder: "text" }],
  toc: [
    { key: "depth", label: "Heading depth", options: ["1", "2", "3"] },
    { key: "title", label: "TOC title", placeholder: "Contents" },
  ],
  context: [
    { key: "key", label: "Context key", placeholder: "key" },
    { key: "value", label: "Context value", placeholder: "value" },
  ],
  ref: [
    { key: "file", label: "File path", placeholder: "./path/to/file.it" },
    { key: "url", label: "External URL", placeholder: "https://..." },
    {
      key: "rel",
      label: "Relationship type",
      options: [
        "supersedes",
        "amends",
        "governed-by",
        "payment",
        "basis",
        "continuation",
        "relates-to",
        "source",
      ],
    },
    { key: "section", label: "Referenced section", placeholder: "section" },
    { key: "at", label: "Date established", placeholder: "2026-01-01" },
  ],
  def: [
    {
      key: "meaning",
      label: "Definition",
      placeholder: "The meaning of the term",
    },
    { key: "abbr", label: "Abbreviation", placeholder: "ABBR" },
    { key: "context", label: "Usage context", placeholder: "legal" },
    { key: "see", label: "See also", placeholder: "related-term" },
  ],
  metric: [
    { key: "value", label: "Measured value", placeholder: "0" },
    { key: "unit", label: "Unit of measure", placeholder: "unit" },
    { key: "target", label: "Target value", placeholder: "0" },
    {
      key: "trend",
      label: "Trend direction",
      options: ["up", "down", "stable", "at-risk"],
    },
    { key: "period", label: "Measurement period", placeholder: "Q1 2026" },
    { key: "source", label: "Data source", placeholder: "source" },
  ],
  amendment: [
    { key: "section", label: "Amended section", placeholder: "Section Name" },
    { key: "was", label: "Previous value", placeholder: "old text" },
    { key: "now", label: "New value", placeholder: "new text" },
    { key: "ref", label: "Amendment reference", placeholder: "Amendment #1" },
    { key: "by", label: "Amended by", placeholder: "name" },
    { key: "at", label: "Amendment date", placeholder: "2026-01-01" },
  ],
  figure: [
    { key: "src", label: "Image source", placeholder: "https://..." },
    { key: "caption", label: "Figure caption", placeholder: "caption" },
    { key: "alt", label: "Alt text", placeholder: "description" },
    { key: "width", label: "Width", placeholder: "100%" },
    { key: "align", label: "Alignment", options: ["left", "center", "right"] },
  ],
  signline: [
    {
      key: "label",
      label: "Signature label",
      placeholder: "Authorized Signatory",
    },
    { key: "name", label: "Signer name", placeholder: "Full Name" },
    { key: "role", label: "Signer role", placeholder: "CEO" },
    { key: "date", label: "Show date line", options: ["true", "false"] },
  ],
  contact: [
    { key: "role", label: "Role", placeholder: "role" },
    { key: "org", label: "Organization", placeholder: "org" },
    { key: "email", label: "Email", placeholder: "email@example.com" },
    { key: "phone", label: "Phone", placeholder: "+1-555-0100" },
    { key: "url", label: "Website", placeholder: "https://..." },
  ],
  deadline: [
    { key: "date", label: "Deadline date", placeholder: "2026-12-31" },
    {
      key: "consequence",
      label: "Consequence if missed",
      placeholder: "penalty",
    },
    { key: "owner", label: "Responsible person", placeholder: "person" },
    {
      key: "status",
      label: "Status",
      options: ["pending", "met", "missed", "extended"],
    },
  ],
  track: [
    { key: "version", label: "Document version", placeholder: "1.0" },
    { key: "by", label: "Author", placeholder: "name" },
  ],
  approve: [
    { key: "by", label: "Approved by", placeholder: "name" },
    { key: "role", label: "Role", placeholder: "Legal Counsel" },
    { key: "at", label: "Timestamp", placeholder: "2026-01-01T00:00:00Z" },
  ],
  sign: [
    { key: "role", label: "Signer role", placeholder: "CEO" },
    { key: "at", label: "Timestamp", placeholder: "2026-01-01T00:00:00Z" },
    { key: "hash", label: "Document hash", placeholder: "sha256:..." },
  ],
  freeze: [
    {
      key: "at",
      label: "Freeze timestamp",
      placeholder: "2026-01-01T00:00:00Z",
    },
    { key: "hash", label: "Document hash", placeholder: "sha256:..." },
    { key: "status", label: "Lock status", options: ["locked"] },
  ],
  meta: [
    { key: "author", label: "Author", placeholder: "name" },
    { key: "lang", label: "Language", placeholder: "en" },
    {
      key: "theme",
      label: "Theme",
      options: [
        "corporate",
        "minimal",
        "warm",
        "technical",
        "print",
        "legal",
        "editorial",
        "dark",
      ],
    },
  ],
  header: [
    { key: "text", label: "Header text", placeholder: "text" },
    { key: "align", label: "Alignment", options: ["left", "center", "right"] },
  ],
  footer: [
    { key: "text", label: "Footer text", placeholder: "Page {{page}}" },
    { key: "align", label: "Alignment", options: ["left", "center", "right"] },
  ],
  watermark: [
    { key: "text", label: "Watermark text", placeholder: "DRAFT" },
    { key: "opacity", label: "Opacity", placeholder: "0.1" },
  ],
  text: [],
  cite: [],
  danger: [],
  signal: [{ key: "event", label: "Event name", placeholder: "event-name" }],
  columns: [],
  input: [
    {
      key: "type",
      label: "Input type",
      options: ["text", "number", "email", "date", "url"],
    },
    { key: "required", label: "Required", options: ["true", "false"] },
    {
      key: "placeholder",
      label: "Placeholder text",
      placeholder: "Enter value",
    },
    { key: "default", label: "Default value", placeholder: "value" },
  ],
  output: [{ key: "format", label: "Output format", placeholder: "text" }],
  memory: [
    { key: "key", label: "Memory key", placeholder: "key" },
    { key: "value", label: "Memory value", placeholder: "value" },
  ],
  prompt: [],
  tool: [
    { key: "input", label: "Tool input", placeholder: "data" },
    { key: "output", label: "Tool output", placeholder: "var" },
  ],
  assert: [
    { key: "expect", label: "Expected value", placeholder: "value" },
    { key: "actual", label: "Actual value", placeholder: "variable" },
  ],
  secret: [
    { key: "env", label: "Environment variable", placeholder: "SECRET_KEY" },
  ],
  history: [],
};
