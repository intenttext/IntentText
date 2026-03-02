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

export const KEYWORDS = [
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
];

export type BlockType =
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
  | "body-text";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

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

export interface IntentDocument {
  version?: string;
  blocks: IntentBlock[];
  metadata?: {
    title?: string;
    summary?: string;
    language?: "ltr" | "rtl";
  };
  diagnostics?: Diagnostic[];
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
