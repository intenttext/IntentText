import {
  IntentBlock,
  BlockType,
  IntentDocument,
  IntentDocumentMetadata,
  Diagnostic,
  InlineNode,
  ParseOptions,
  IntentExtension,
  KEYWORDS,
  HistorySection,
  RegistryEntry,
  RevisionEntry,
} from "./types";
import { ALIASES } from "./aliases";
import {
  DEPRECATED_ALIASES,
  CALLOUT_ALIAS_MAP,
  EXTENSION_KEYWORDS,
  EXTENSION_NS_MAP,
  CANONICAL_KEYWORDS,
} from "./language-registry";

// Fast sequential ID generator — deterministic and allocation-free vs uuid
let _idCounter = 0;
function nextId(): string {
  return `b-${++_idCounter}`;
}
/** Reset the ID counter (useful for deterministic tests). */
export function _resetIdCounter(): void {
  _idCounter = 0;
}

// Safety limits
const MAX_INPUT_LENGTH = 10_000_000; // 10 MB
const MAX_LINE_COUNT = 500_000;
const MAX_INLINE_LENGTH = 100_000;

// Property keys that must never be set from user input (prototype pollution guard)
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// v2 agentic block types that are treated as content blocks within sections
const AGENTIC_BLOCK_TYPES = new Set<string>([
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
  "tool",
  "prompt",
  "memory",
  // v2.1
  "result",
  "handoff",
  "wait",
  "parallel",
  "retry",
  // v2.2
  "gate",
  "call",
  "signal",
  // v2.7
  "policy",
  // v2.13
  "assert",
  "secret",
]);

// v2.1+ inter-agent block types (subset of AGENTIC_BLOCK_TYPES)
const V21_BLOCK_TYPES = new Set<string>([
  "result",
  "handoff",
  "wait",
  "parallel",
  "retry",
]);

// v2.2 block types
const V22_BLOCK_TYPES = new Set<string>(["gate", "call", "signal"]);

// v2.5 document generation layout block types
const DOCGEN_LAYOUT_TYPES = new Set<string>([
  "font",
  "page",
  "break",
  "header",
  "footer",
  "watermark",
  "signline",
]);

// v2.5 document generation writer block types
const DOCGEN_WRITER_TYPES = new Set<string>([
  "byline",
  "epigraph",
  "caption",
  "footnote",
  "toc",
  "dedication",
]);

// v2 metadata-only keywords: when these appear before any section block,
// they populate document metadata instead of emitting a block.
const METADATA_KEYWORDS = new Set<string>(["agent", "model"]);

// v2.8 trust keywords
const TRUST_KEYWORDS = new Set<string>([
  "approve",
  "sign",
  "freeze",
  "amendment",
  "history",
]);

// v2.8 document identity keywords (track joins title, summary)
const DOCUMENT_IDENTITY_KEYWORDS = new Set<string>([
  "title",
  "summary",
  "track",
]);

// v2.8 history keywords — below boundary only, parser skips for block output
const HISTORY_KEYWORDS = new Set<string>(["revision"]);

// v2.11 keyword expansion block types
const V211_BLOCK_TYPES = new Set<string>([
  "def",
  "metric",
  "amendment",
  "figure",
  "signline",
  "contact",
  "deadline",
]);

/**
 * Detect the history boundary in an array of lines.
 * v2.12: looks for `history:` keyword line.
 * Backward compat: also detects legacy `---` + `// history` pattern.
 * Returns the line index of the boundary, or -1 if not found.
 */
export function detectHistoryBoundary(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // v2.12: history: keyword is the canonical boundary
    if (trimmed === "history:" || trimmed === "history: ") {
      return i;
    }
    // Legacy v2.11: --- followed by // history
    if (trimmed === "---" && i < lines.length - 1) {
      const next = lines[i + 1]?.trim();
      if (next === "// history" || next?.startsWith("// history")) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Parse the raw history section text into structured data.
 */
function parseHistorySectionText(raw: string): HistorySection {
  const lines = raw.split("\n");
  const registry: RegistryEntry[] = [];
  const revisions: RevisionEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;

    if (trimmed.startsWith("revision:")) {
      const content = trimmed.replace(/^revision:\s*\|?\s*/, "");
      const props: Record<string, string> = Object.create(null);
      const segments = content.split(" | ");
      for (const seg of segments) {
        const colonIdx = seg.indexOf(":");
        if (colonIdx > -1) {
          props[seg.slice(0, colonIdx).trim()] = seg.slice(colonIdx + 1).trim();
        }
      }
      revisions.push({
        version: props.version || "",
        at: props.at || "",
        by: props.by || "",
        change: (props.change || "added") as RevisionEntry["change"],
        id: props.id || "",
        block: props.block || "",
        section: props.section,
        was: props.was,
        now: props.now,
        wasSection: props["was-section"],
        nowSection: props["now-section"],
      });
    } else if (/^[a-z0-9]{5}\s*\|/.test(trimmed)) {
      const parts = trimmed.split("|").map((p) => p.trim());
      if (parts.length >= 4) {
        registry.push({
          id: parts[0],
          blockType: parts[1],
          section: parts[2],
          fingerprint: parts[3],
          dead: parts[4] === "dead" || undefined,
        });
      }
    }
  }

  return { registry, revisions, raw };
}

/**
 * Parse context key=value pairs from raw content.
 * Supports both legacy syntax: key = "value" | key2 = "value2"
 * and pipe syntax: | key: value | key2: value2
 * Input: 'userId = "u_123" | plan = "pro"'
 * Output: { userId: 'u_123', plan: 'pro' }
 */
function parseContextKeyValuePairs(rawContent: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  // Strip leading pipe if present (for pipe-first syntax: | key: value | key2: value2)
  let content = rawContent.trim();
  if (content.startsWith("|")) {
    content = content.substring(1).trim();
  }
  // Split on " | " for multiple pairs
  const pairs = splitPipeMetadata(content);
  for (const pair of pairs) {
    const trimmed = pair.trim();
    // Strip leading pipe from individual pairs too
    const cleaned = trimmed.startsWith("|")
      ? trimmed.substring(1).trim()
      : trimmed;
    // Try legacy syntax: key = "value" or key = value
    const kvMatch =
      cleaned.match(/^([\w]+)\s*=\s*"([^"]*)"/) ||
      cleaned.match(/^([\w]+)\s*=\s*(\S+)/);
    if (kvMatch) {
      const key = kvMatch[1];
      if (!DANGEROUS_KEYS.has(key)) result[key] = kvMatch[2];
      continue;
    }
    // Try pipe property syntax: key: value
    const pipeMatch = cleaned.match(/^([\p{L}\p{N}_][\p{L}\p{N}_-]*):\s*(.*)$/u);
    if (pipeMatch) {
      const key = pipeMatch[1].trim();
      if (!DANGEROUS_KEYS.has(key)) result[key] = pipeMatch[2].trim();
    }
  }
  return result;
}

// Helper function to detect Arabic text (RTL)
function detectArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}

function splitPipeMetadata(rest: string): string[] {
  // Split on unescaped " | " (space-pipe-space). Escaped pipes ("\|") must not split.
  const parts: string[] = [];
  let current = "";

  for (let i = 0; i < rest.length; i++) {
    // Delimiter candidate at i+1 == '|' with surrounding spaces
    if (
      i + 2 < rest.length &&
      rest[i] === " " &&
      rest[i + 1] === "|" &&
      rest[i + 2] === " "
    ) {
      // Check if the pipe is escaped by an odd number of backslashes.
      let backslashes = 0;
      for (let j = i; j - 1 >= 0 && rest[j - 1] === "\\"; j--) backslashes++;
      const escaped = backslashes % 2 === 1;

      if (!escaped) {
        parts.push(current);
        current = "";
        i += 2;
        continue;
      }
    }

    current += rest[i];
  }

  parts.push(current);
  return parts;
}

function splitTableRow(text: string): string[] {
  // Split on unescaped '|' and then unescape cell contents.
  const cells: string[] = [];
  let current = "";
  let escaping = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaping = true;
      continue;
    }

    if (ch === "|") {
      cells.push(unescapeIntentText(current.trim()));
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(unescapeIntentText(current.trim()));
  return cells.filter((c) => c !== "");
}

function parseInlineNodes(text: string): {
  content: string;
  inline: InlineNode[];
} {
  // Fast path: skip inline parsing for very long or empty content
  if (!text || text.length > MAX_INLINE_LENGTH) {
    return {
      content: text || "",
      inline: [{ type: "text", value: text || "" }],
    };
  }

  const inline: InlineNode[] = [];
  let content = "";
  let currentText = "";

  const flushText = () => {
    if (currentText) {
      inline.push({ type: "text", value: currentText });
      content += currentText;
      currentText = "";
    }
  };

  const addNode = (node: InlineNode) => {
    flushText();
    inline.push(node);
    content += node.value;
  };

  const resolveDateToken = (token: string): string | null => {
    const lower = token.toLowerCase();
    if (lower === "today") {
      return new Date().toISOString().slice(0, 10);
    }
    if (lower === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
      return token;
    }
    return null;
  };

  let i = 0;
  while (i < text.length) {
    // Check for link pattern [text](url)
    if (text[i] === "[") {
      // Footnote reference: [^N]
      const fnRefMatch = text.slice(i).match(/^\[\^(\d+)\]/);
      if (fnRefMatch) {
        addNode({ type: "footnote-ref", value: fnRefMatch[1] });
        i += fnRefMatch[0].length;
        continue;
      }

      const linkEnd = text.indexOf("](", i);
      const urlEnd = linkEnd >= 0 ? text.indexOf(")", linkEnd + 2) : -1;
      if (linkEnd > i && urlEnd > linkEnd) {
        const linkText = text.slice(i + 1, linkEnd);
        const linkUrl = text.slice(linkEnd + 2, urlEnd);
        addNode({ type: "link", value: linkText, href: linkUrl });
        i = urlEnd + 1;
        continue;
      }

      // Inline styled span: [text]{color: red | weight: bold}
      // (not [[note]] and not [text](url), handled above)
      if (text[i + 1] !== "[") {
        const close = text.indexOf("]", i + 1);
        if (close > i && text[close + 1] === "{") {
          const braceEnd = text.indexOf("}", close + 2);
          if (braceEnd > close + 1 && text[braceEnd + 1] !== "}") {
            // Span props are `;`-separated (CSS-like) — `|` is reserved for the
            // line-level property delimiter and can't appear inside a line.
            const props: Record<string, string> = {};
            for (const seg of text.slice(close + 2, braceEnd).split(";")) {
              const c = seg.indexOf(":");
              if (c > 0) {
                const k = seg.slice(0, c).trim();
                if (k) props[k] = seg.slice(c + 1).trim();
              }
            }
            if (Object.keys(props).length > 0) {
              addNode({ type: "styled", value: text.slice(i + 1, close), props });
              i = braceEnd + 1;
              continue;
            }
          }
        }
      }
    }

    // Inline side-note [[note text]]
    if (text.startsWith("[[", i)) {
      const end = text.indexOf("]]", i + 2);
      if (end > i + 2) {
        const noteText = text.slice(i + 2, end).trim();
        const pipeAt = noteText.indexOf("|");
        if (pipeAt > 0 && pipeAt < noteText.length - 1) {
          const label = noteText.slice(0, pipeAt).trim();
          const href = noteText.slice(pipeAt + 1).trim();
          if (label && href) {
            addNode({ type: "link", value: label, href });
            i = end + 2;
            continue;
          }
        }
        addNode({ type: "inline-note", value: noteText });
        i = end + 2;
        continue;
      }
    }

    // Inline quote ==quoted text==
    if (text.startsWith("==", i)) {
      const end = text.indexOf("==", i + 2);
      if (end > i + 2) {
        const quoteText = text.slice(i + 2, end);
        addNode({ type: "inline-quote", value: quoteText });
        i = end + 2;
        continue;
      }
    }

    // Check for code span ```text```
    if (text.startsWith("```", i)) {
      const end = text.indexOf("```", i + 3);
      if (end === -1) {
        currentText += "```";
        i += 3;
        continue;
      }
      const codeText = text.slice(i + 3, end);
      addNode({ type: "code", value: codeText });
      i = end + 3;
      continue;
    }

    // Check for single-backtick label `text` — renders as badge/pill
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        const labelText = text.slice(i + 1, end);
        addNode({ type: "label", value: labelText });
        i = end + 1;
        continue;
      }
      currentText += "`";
      i++;
      continue;
    }

    // Markdown-compatible DOUBLE marks: **bold** / __bold__ → bold, ~~strike~~ → strike.
    // A double delimiter binds before the single marks below, so a stray Markdown-style
    // `**x**` renders bold instead of two empty markers around plain text. Native single
    // marks (*bold* _italic_ ~strike~) are unaffected. Source bytes are untouched, so this
    // never alters a seal's content hash.
    if (
      text.startsWith("**", i) ||
      text.startsWith("__", i) ||
      text.startsWith("~~", i)
    ) {
      const delim = text.slice(i, i + 2);
      const end = text.indexOf(delim, i + 2);
      if (end > i + 2) {
        addNode({
          type: delim === "~~" ? "strike" : "bold",
          value: text.slice(i + 2, end),
        });
        i = end + 2;
        continue;
      }
    }

    // Check for bold/italic/strike/highlight with */_/~/^
    const ch = text[i];
    if (ch === "*" || ch === "_" || ch === "~" || ch === "^") {
      const end = text.indexOf(ch, i + 1);
      if (end === -1) {
        currentText += ch;
        i++;
        continue;
      }
      const innerText = text.slice(i + 1, end);
      const type =
        ch === "*"
          ? "bold"
          : ch === "_"
            ? "italic"
            : ch === "~"
              ? "strike"
              : "highlight";
      addNode({ type, value: innerText });
      i = end + 1;
      continue;
    }

    // Mentions and tags for lightweight writer metadata
    const dateTokenMatch = text
      .slice(i)
      .match(/^@(today|tomorrow|\d{4}-\d{2}-\d{2})\b/i);
    if (dateTokenMatch) {
      const token = dateTokenMatch[1];
      const iso = resolveDateToken(token);
      if (iso) {
        addNode({ type: "date", value: `@${token}`, iso });
        i += dateTokenMatch[0].length;
        continue;
      }
    }

    const mentionMatch = text.slice(i).match(/^@([A-Za-z0-9_-]+)/);
    if (mentionMatch) {
      addNode({ type: "mention", value: mentionMatch[1] });
      i += mentionMatch[0].length;
      continue;
    }

    const tagMatch = text.slice(i).match(/^#([A-Za-z0-9_-]+)/);
    if (tagMatch) {
      addNode({ type: "tag", value: tagMatch[1] });
      i += tagMatch[0].length;
      continue;
    }

    // Inline label {Name} — renders as a badge/pill
    // Skip {{var}} template syntax: don't match if preceded or followed by '{'
    if (
      text[i] === "{" &&
      text[i + 1] !== "{" &&
      (i === 0 || text[i - 1] !== "{")
    ) {
      const end = text.indexOf("}", i + 1);
      if (end > i + 1 && text[end + 1] !== "}") {
        const labelText = text.slice(i + 1, end).trim();
        if (labelText && !labelText.includes("{")) {
          addNode({ type: "label", value: labelText });
          i = end + 1;
          continue;
        }
      }
    }

    // Regular character
    currentText += text[i];
    i++;
  }

  // Flush any remaining text
  flushText();

  return { content, inline };
}

function expandPropertyShortcuts(content: string): {
  content: string;
  shortcuts: Record<string, string>;
} {
  const shortcuts: Record<string, string> = Object.create(null);

  // Priority shortcuts: !low, !medium, !high, !critical
  content = content.replace(/!low\b/gi, () => {
    shortcuts.priority = "low";
    return "";
  });
  content = content.replace(/!medium\b/gi, () => {
    shortcuts.priority = "medium";
    return "";
  });
  content = content.replace(/!high\b/gi, () => {
    shortcuts.priority = "high";
    return "";
  });
  content = content.replace(/!critical\b/gi, () => {
    shortcuts.priority = "critical";
    return "";
  });

  // Owner shortcuts: @username
  content = content.replace(/@(\w+)/g, (_match, username) => {
    shortcuts.owner = username;
    return "";
  });

  // Emoji shortcuts (v1.3 Phase 2)
  // 🚨 urgent/priority, 📅 due date, ✅ status/completed, ⏰ time
  content = content.replace(/🚨/g, () => {
    shortcuts.priority = "urgent";
    return "";
  });
  content = content.replace(/📅\s*(\S.*)/g, (_match, dateText) => {
    shortcuts.due = dateText.trim();
    return "";
  });
  content = content.replace(/✅/g, () => {
    shortcuts.status = "completed";
    return "";
  });
  content = content.replace(/⏰\s*(\S.*)/g, (_match, timeText) => {
    shortcuts.time = timeText.trim();
    return "";
  });

  // Clean up extra spaces from removed shortcuts
  content = content.replace(/\s+/g, " ").trim();

  return { content, shortcuts };
}

function unescapeIntentText(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === "\\" || next === "|") {
        result += next;
        i++;
        continue;
      }
    }
    result += ch;
  }
  return result;
}

// Helper function to parse a single line
function parseLine(
  line: string,
  ctx: {
    keywords: Set<string>;
    extensions: IntentExtension[];
    lineNumber: number;
    diagnostics: Diagnostic[];
    parseInline: (text: string) => { content: string; inline: InlineNode[] };
    /** Depth of embedded re-parses (list-item shorthand). Bounded — see below. */
    embedDepth?: number;
  },
): IntentBlock | null {
  const trimmed = line.trim();

  if (!trimmed) return null;

  // v2.14: x-ns: prefix form — e.g. "x-writer: byline | content: Emad | date: 2026"
  // Skip if an extension has registered this exact keyword (e.g. "x-alert")
  const xNsMatch = trimmed.match(/^x-([a-z]+):\s*(.*)$/);
  const fullXKeyword = xNsMatch ? `x-${xNsMatch[1]}` : "";
  const extensionOwnsKeyword = ctx.extensions.some((ext) =>
    (ext.keywords || []).some((k) => k.toLowerCase() === fullXKeyword),
  );
  if (xNsMatch && !extensionOwnsKeyword) {
    const namespace = xNsMatch[1];
    const afterColon = xNsMatch[2];
    const parts = splitPipeMetadata(afterColon);
    const xType = (parts[0] || "").trim();
    const properties: Record<string, string | number> = Object.create(null);

    let blockContent = "";
    for (let i = 1; i < parts.length; i++) {
      const segment = parts[i];
      const propMatch = segment.match(/^([^:]+):\s*(.*)$/);
      if (propMatch) {
        const key = propMatch[1].trim();
        const rawValue = propMatch[2].trim();
        if (!DANGEROUS_KEYS.has(key)) {
          if (key === "content") {
            blockContent = unescapeIntentText(rawValue);
          } else {
            properties[key] = unescapeIntentText(rawValue);
          }
        }
      }
    }

    const { content: cleanContent, inline } = ctx.parseInline(blockContent);

    // Known extension keyword → emit real type directly
    const isKnownExt = EXTENSION_KEYWORDS.has(xType);
    if (isKnownExt) {
      return {
        id: nextId(),
        type: xType as BlockType,
        content: cleanContent,
        originalContent: afterColon,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        inline,
      };
    }

    // Unknown extension → keep type: "extension" with x-type/x-ns metadata
    properties["x-type"] = xType;
    properties["x-ns"] = namespace;
    return {
      id: nextId(),
      type: "extension" as BlockType,
      content: cleanContent,
      originalContent: afterColon,
      properties,
      inline,
    };
  }

  // Check for keyword blocks. Keywords are Unicode words (\p{L}) — Arabic,
  // Chinese, etc. domain keywords (`مصروف: …`) parse as typed `custom` blocks
  // exactly like ASCII ones, so non-English documents stay fully queryable.
  const keywordMatch = trimmed.match(/^(\p{L}[\p{L}\p{N}-]*):\s*(.*)$/u);
  if (keywordMatch) {
    const keyword = keywordMatch[1].toLowerCase();
    // Preserve the AS-WRITTEN keyword for unknown (custom/extension) blocks so a
    // `Note:`/`Ref:` line round-trips with its original case (lowercasing it broke
    // byte-preservation and surprised authors). The lowercased `keyword` is used only
    // for registry lookup; the original is what we store + re-emit. (G-18)
    const originalKeyword = keywordMatch[1];
    const rest = keywordMatch[2];

    const isKnown = ctx.keywords.has(keyword);
    const isCoreKeyword = KEYWORDS.includes(keyword);
    const looksLikeExtension =
      keyword.startsWith("x-") || keyword.startsWith("ext-");

    if (!isKnown) {
      if (looksLikeExtension) {
        ctx.diagnostics.push({
          severity: "warning",
          code: "UNKNOWN_EXTENSION_KEYWORD",
          message: `Unknown extension keyword '${keyword}:'`,
          line: ctx.lineNumber,
          column: 1,
        });

        const { content: cleanContent, inline } = ctx.parseInline(trimmed);
        return {
          id: nextId(),
          type: "extension",
          content: cleanContent,
          originalContent: trimmed,
          inline,
          properties: { keyword: originalKeyword },
        };
      }

      // Custom (user-defined) keyword: parse pipe metadata, then pass through.
      const customParts = splitPipeMetadata(rest);
      const customContent = unescapeIntentText(customParts[0] || "");
      const customProps: Record<string, string | number> = Object.create(null);
      customProps["keyword"] = originalKeyword;
      for (let i = 1; i < customParts.length; i++) {
        const seg = customParts[i];
        const pm = seg.match(/^([^:]+):\s*(.*)$/);
        if (pm) {
          const k = pm[1].trim();
          if (!k.includes("\\") && !k.includes("|") && !DANGEROUS_KEYS.has(k)) {
            customProps[k] = unescapeIntentText(pm[2].trim());
          }
        }
      }
      const { content: parsedContent, inline } = ctx.parseInline(customContent);
      return {
        id: nextId(),
        type: "custom",
        content: parsedContent,
        originalContent: trimmed,
        inline,
        properties: customProps,
      };
    }

    // Spec rule: split on " | " (space-pipe-space). Non key:value segments
    // after the first are treated as content continuation.
    // But NOT for headers and rows which use | as data separator.
    let content: string;
    const properties: Record<string, string | number> = Object.create(null);

    // Resolve aliases for this check so localized table keywords (e.g. Arabic
    // صف → row) keep `|` as the cell separator, not property metadata.
    const tableResolved = (ALIASES[keyword] ?? keyword) as string;
    if (
      tableResolved === "headers" ||
      tableResolved === "row"
    ) {
      content = rest;
    } else {
      const parts = splitPipeMetadata(rest);
      content = unescapeIntentText(parts[0] || "");

      // Handle pipe-first syntax: "font: | family: Georgia" → content is empty,
      // first part starts with "|" and contains a property.
      let propStart = 1;
      const trimmedContent = content.trim();
      if (trimmedContent.startsWith("|")) {
        const firstProp = trimmedContent.substring(1).trim();
        const propMatch = firstProp.match(/^([^:]+):\s*(.*)$/);
        if (propMatch) {
          const key = propMatch[1].trim();
          const rawValue = propMatch[2].trim();
          if (
            !key.includes("\\") &&
            !key.includes("|") &&
            !DANGEROUS_KEYS.has(key)
          ) {
            properties[key] = unescapeIntentText(rawValue);
            content = "";
          }
        }
      }

      for (let i = 1; i < parts.length; i++) {
        const segment = parts[i];
        const propMatch = segment.match(/^([^:]+):\s*(.*)$/);
        if (propMatch) {
          const key = propMatch[1].trim();
          const rawValue = propMatch[2].trim();

          // v1 policy: property keys are not escapable (keep simple + deterministic).
          if (
            key.includes("\\") ||
            key.includes("|") ||
            DANGEROUS_KEYS.has(key)
          ) {
            ctx.diagnostics.push({
              severity: "warning",
              code: "INVALID_PROPERTY_SEGMENT",
              message: `Invalid property key '${key}'. Property keys must not contain escapes.`,
              line: ctx.lineNumber,
              column: 1,
            });
            content += ` | ${unescapeIntentText(segment)}`;
            continue;
          }

          properties[key] = unescapeIntentText(rawValue);
        } else {
          ctx.diagnostics.push({
            severity: "warning",
            code: "INVALID_PROPERTY_SEGMENT",
            message: `Invalid property segment '${segment.trim()}'. Expected 'key: value'.`,
            line: ctx.lineNumber,
            column: 1,
          });
          content += ` | ${unescapeIntentText(segment)}`;
        }
      }
    }

    const { content: cleanContent, inline } = ctx.parseInline(content);

    // Let extensions override keyword block construction.
    let handledByExtension = false;
    for (const ext of ctx.extensions) {
      const wantsKeyword = (ext.keywords || []).some(
        (k) => k.toLowerCase() === keyword,
      );
      if (!wantsKeyword || !ext.parseBlock) continue;

      const overridden = ext.parseBlock({
        keyword,
        content,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        line: ctx.lineNumber,
        column: 1,
        parseInline: ctx.parseInline,
      });

      handledByExtension = true;
      if (overridden) return overridden;
      if (overridden === null) return null;
    }

    // If this is an extension keyword (registered or prefixed) and not handled by an
    // extension, emit a generic extension block.
    if (!isCoreKeyword && (handledByExtension || looksLikeExtension)) {
      return {
        id: nextId(),
        type: "extension",
        content: cleanContent,
        originalContent: content,
        properties: {
          ...(Object.keys(properties).length > 0 ? properties : {}),
          keyword,
        },
        inline,
      };
    }

    // Apply keyword aliases — all keywords (canonical, extension, legacy aliases)
    // resolve through the unified ALIASES map then emit their real type.
    const resolvedType = (ALIASES[keyword] ?? keyword) as BlockType;

    // Emit deprecation warning for deprecated aliases
    if (DEPRECATED_ALIASES.has(keyword)) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "DEPRECATED_KEYWORD",
        message: `'${keyword}:' is deprecated. Use '${resolvedType}:' instead.`,
        line: ctx.lineNumber,
        column: 1,
      });
    }

    // v2.14: Callout alias → info with type property injection
    // When warning/danger/tip/success (or their sub-aliases) resolve to 'info',
    // inject properties.type with the callout variant name.
    if (CALLOUT_ALIAS_MAP[keyword] && resolvedType === "info") {
      properties.type = CALLOUT_ALIAS_MAP[keyword];
    }

    // NOTE: Block-type DEFAULTS (a `done:` line's status, a `step:`'s pending, a
    // bare `toc:`'s depth/title, …) are deliberately NOT injected into the model.
    // The parser is a faithful recorder so the source round-trips byte-for-byte;
    // defaults are applied at READ time in defaults.ts (effectiveProperties),
    // used by the renderer, query, and index. Do not re-introduce injection here.

    // v2: context blocks parse key=value pairs into properties
    if (resolvedType === "context") {
      const kvPairs = parseContextKeyValuePairs(rest);
      for (const [k, v] of Object.entries(kvPairs)) {
        properties[k] = v;
      }
    }

    // v2.1: retry blocks coerce numeric properties
    if (resolvedType === "retry") {
      if (properties.max) properties.max = Number(properties.max);
      if (properties.delay) properties.delay = Number(properties.delay);
      if (properties.retries) properties.retries = Number(properties.retries);
    }

    // v2.14: image at: is deprecated in favour of src: — warn, but DO NOT rewrite
    // the bytes (faithful recorder). Read-time treats `at:` as `src:` (defaults.ts).
    if (resolvedType === "image" && properties.at && !properties.src) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "DEPRECATED_PROPERTY",
        message: "'at:' is deprecated on image: blocks. Use 'src:' instead.",
        line: ctx.lineNumber,
        column: 1,
      });
    }

    // v2.1: coerce numeric properties for any block that uses them
    if (properties.timeout && !isNaN(Number(properties.timeout))) {
      properties.timeout = Number(properties.timeout);
    }
    if (properties.priority && !isNaN(Number(properties.priority))) {
      properties.priority = Number(properties.priority);
    }
    if (properties.retries && !isNaN(Number(properties.retries))) {
      properties.retries = Number(properties.retries);
    }
    if (properties.delay && !isNaN(Number(properties.delay))) {
      properties.delay = Number(properties.delay);
    }

    // v2.5: font blocks coerce numeric leading
    if (resolvedType === "font") {
      if (properties.leading) properties.leading = Number(properties.leading);
    }

    // v2.5: page blocks coerce numeric columns, handle boolean numbering.
    // Accept BOTH the authored `true` AND the serialized `1` as on (and `1`/`0`
    // numbers) so the coercion is IDEMPOTENT — `numbering: true` serializes to
    // `numbering: 1`, which must re-parse to 1, not flip to 0 (round-trip bug).
    if (resolvedType === "page") {
      if (properties.columns) properties.columns = Number(properties.columns);
      if (properties.numbering !== undefined) {
        const n = properties.numbering;
        properties.numbering = n === "true" || n === "1" || n === 1 ? 1 : 0;
      }
    }

    // v2.5: toc blocks default depth to 2
    // toc: coerce an AUTHORED depth to a number (byte-neutral); the depth/title
    // defaults are applied at read time, not injected (faithful recorder).
    if (resolvedType === "toc" && properties.depth) {
      properties.depth = Number(properties.depth);
    }

    // v2.5: break blocks have no content
    if (resolvedType === "break") {
      return {
        id: nextId(),
        type: "break" as BlockType,
        content: "",
        properties: Object.keys(properties).length > 0 ? properties : undefined,
      };
    }

    return {
      id: nextId(),
      type: resolvedType,
      // Preserve the keyword AS WRITTEN when an alias was used (incl. localized
      // aliases like Arabic) — documentToSource re-emits it, so round-trips are
      // byte-stable and an Arabic document never silently turns English.
      ...(keyword !== resolvedType ? { keywordAlias: keyword } : {}),
      content: cleanContent,
      originalContent: content,
      properties: Object.keys(properties).length > 0 ? properties : undefined,
      inline,
    };
  }

  // Check for checkbox tasks (v1.3) - [ ] and [x]
  const checkboxMatch = trimmed.match(/^(\[ \]|\[x\])\s*(.+)$/);
  if (checkboxMatch) {
    const isDone = checkboxMatch[1] === "[x]";
    let content = unescapeIntentText(checkboxMatch[2]);

    // Expand property shortcuts (v1.3)
    const { content: cleanContent, shortcuts } =
      expandPropertyShortcuts(content);
    content = cleanContent;

    const { content: finalContent, inline } = ctx.parseInline(content);

    if (isDone) shortcuts.status = "done";

    return {
      id: nextId(),
      type: "task",
      content: finalContent,
      originalContent: content,
      properties: Object.keys(shortcuts).length > 0 ? shortcuts : undefined,
      inline,
    };
  }

  // Check for list items
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    const payload = trimmed.substring(2);

    // Inline task shorthand: "- task: ..." should parse the same as a
    // standalone keyword block, but preserve list positioning.
    // Depth-bounded: a pathological line like "- - - - …" would otherwise
    // recurse once per marker and overflow the stack (found by fuzzing).
    const depth = ctx.embedDepth ?? 0;
    const embedded =
      depth < 2
        ? parseLine(payload, {
            ...ctx,
            embedDepth: depth + 1,
            // embedded content shares same line number
          })
        : null;
    if (
      embedded &&
      embedded.type !== "list-item" &&
      embedded.type !== "step-item"
    ) {
      return {
        id: nextId(),
        type: "list-item",
        content: embedded.content,
        originalContent: embedded.originalContent,
        properties: embedded.properties,
        inline: embedded.inline,
        children: [embedded],
      };
    }

    const unescaped = unescapeIntentText(payload);
    const { content: cleanContent, inline } = ctx.parseInline(unescaped);
    return {
      id: nextId(),
      type: "list-item",
      content: cleanContent,
      originalContent: unescaped,
      inline,
    };
  }

  // Check for ordered list items
  const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
  if (orderedMatch) {
    const content = unescapeIntentText(orderedMatch[2]);
    const { content: cleanContent, inline } = ctx.parseInline(content);

    return {
      id: nextId(),
      type: "step-item",
      content: cleanContent,
      originalContent: content,
      inline,
    };
  }

  // Default to text (implicit text block — bare prose without a keyword prefix).
  // _bare records that it was authored without `text:` so documentToSource can
  // re-emit it bare (natural source round-trips byte-for-byte, hash unchanged).
  const unescaped = unescapeIntentText(trimmed);
  const { content: cleanContent, inline } = ctx.parseInline(unescaped);

  return {
    id: nextId(),
    type: "text",
    content: cleanContent,
    originalContent: unescaped,
    inline,
    _bare: true,
  };
}

/**
 * Merge a stray "pipe property continuation" into the line above. When a
 * property list gets hard-wrapped (templates, copy-paste, an editor splitting a
 * long line), a single property can land on its own line as `| label: Date`,
 * which would otherwise render as literal text in the output (seen leaking into
 * sealed-document signature blocks).
 *
 * This is deliberately conservative — it merges ONLY a line that is exactly one
 * `| key: value` segment (one leading pipe, a property key, a colon, and a value
 * with no further unescaped pipe), and only when the previous line is not itself
 * a table row. That distinguishes a wrapped property from markdown table rows
 * (`| Description | Qty | Total |`), which legitimately start with `|` and carry
 * multiple cells — those are never merged.
 */
const PIPE_PROP_CONTINUATION = /^\s*\|\s*[\p{L}][\p{L}\d_-]*\s*:\s*[^|]*$/u;
function mergePipeContinuations(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out.length > 0 ? out[out.length - 1] : "";
    const prevIsTableRow = prev.trimStart().startsWith("|");
    if (
      out.length > 0 &&
      !prevIsTableRow &&
      PIPE_PROP_CONTINUATION.test(line)
    ) {
      out[out.length - 1] = prev.trimEnd() + " " + line.trimStart();
    } else {
      out.push(line);
    }
  }
  return out;
}

// Main parser function
export function parseIntentText(
  fileContent: string,
  options?: ParseOptions,
): IntentDocument {
  // Input validation
  if (typeof fileContent !== "string") {
    return { version: "1.4", blocks: [], metadata: {}, diagnostics: [] };
  }
  if (fileContent.length === 0) {
    return { version: "1.4", blocks: [], metadata: {}, diagnostics: [] };
  }
  if (fileContent.length > MAX_INPUT_LENGTH) {
    return {
      version: "1.4",
      blocks: [],
      metadata: {},
      diagnostics: [
        {
          severity: "error",
          code: "UNTERMINATED_CODE_BLOCK",
          message: `Input exceeds maximum allowed length of ${MAX_INPUT_LENGTH} characters.`,
          line: 1,
          column: 1,
        },
      ],
    };
  }

  // Reset ID counter for deterministic output per parse call
  _resetIdCounter();

  const lines = mergePipeContinuations(fileContent.split(/\r\n|\r|\n/));
  if (lines.length > MAX_LINE_COUNT) {
    return {
      version: "1.4",
      blocks: [],
      metadata: {},
      diagnostics: [
        {
          severity: "error",
          code: "UNTERMINATED_CODE_BLOCK",
          message: `Input exceeds maximum allowed line count of ${MAX_LINE_COUNT}.`,
          line: 1,
          column: 1,
        },
      ],
    };
  }

  const blocks: IntentBlock[] = [];
  const diagnostics: Diagnostic[] = [];
  let currentSection: IntentBlock | null = null;
  let codeCaptureMode = false;
  let codeCaptureType: "keyword" | "fence" = "keyword";
  let codeContent: string[] = [];
  let codeStartLine = 0;
  let pendingCodeProperties: Record<string, string | number> | null = null;
  let pendingCodeLead: string | undefined;

  // v2.8: Detect history boundary and split lines
  const historyBoundaryIdx = detectHistoryBoundary(lines);
  const parseLines =
    historyBoundaryIdx === -1 ? lines : lines.slice(0, historyBoundaryIdx);
  let historySection: HistorySection | undefined;
  if (options?.includeHistorySection && historyBoundaryIdx !== -1) {
    const historyRaw = lines.slice(historyBoundaryIdx).join("\n");
    historySection = parseHistorySectionText(historyRaw);
  }

  // v2.12: LEGACY_HISTORY_BOUNDARY warning when old --- + // history pattern used
  if (historyBoundaryIdx !== -1 && lines[historyBoundaryIdx].trim() === "---") {
    diagnostics.push({
      severity: "warning",
      code: "LEGACY_HISTORY_BOUNDARY",
      message:
        "Legacy history boundary detected: '---' followed by '// history'. " +
        "Use 'history:' keyword instead (v2.12+).",
      line: historyBoundaryIdx + 1,
      column: 1,
    });
  }

  // v2.8: trust metadata accumulators
  const signatureBlocks: Array<{
    signer: string;
    role?: string;
    at: string;
    hash: string;
  }> = [];
  let trackingMeta:
    | { version: string; by: string; active: boolean }
    | undefined;
  let freezeMeta:
    | { at: string; hash: string; spec?: number; appearance?: string; status: "locked" }
    | undefined;

  // v2: auto-ID counter for step blocks without explicit id
  let stepAutoIdCounter = 0;
  // v2: track whether we've seen a section block yet (for metadata detection)
  let seenSectionBlock = false;
  // v2: document-level metadata accumulator
  const agenticMetadata: {
    agent?: string;
    model?: string;
    context?: Record<string, string>;
  } = {};

  const extensions = options?.extensions || [];
  const keywords = new Set(KEYWORDS);
  // v2.8.1: register alias keywords so they are recognised as known
  for (const alias of Object.keys(ALIASES)) {
    keywords.add(alias);
  }
  for (const ext of extensions) {
    for (const k of ext.keywords || []) {
      keywords.add(k.toLowerCase());
    }
  }

  // v2.8.1: meta accumulator — merged from all meta: blocks before first section
  const metaAccumulator: Record<string, string> = Object.create(null);

  const defaultParseInline = (text: string) => parseInlineNodes(text);
  const parseInline = (text: string) => {
    for (const ext of extensions) {
      if (!ext.parseInline) continue;
      const result = ext.parseInline({ text, defaultParseInline });
      if (result) return result;
    }
    return defaultParseInline(text);
  };

  // Table grouping state
  let pendingTable: {
    headers?: string[];
    rows: string[][];
    originalHeaders?: string;
    headerLine?: number;
    /** Keywords as written (e.g. أعمدة/صف) — preserved on serialize. */
    headersKeyword?: string;
    rowKeyword?: string;
    /** Verbatim trivia before the table's first line (lossless round-trip). */
    lead?: string;
  } | null = null;

  let previousLineWasBlank = false;

  // Lossless round-trip: accumulate verbatim trivia (blank + comment lines) so
  // documentToSource can re-emit it. Without this the canonical text — and the
  // bytes computeDocumentHash sees — would drift, breaking sealed documents and
  // merging blank-separated prose blocks on re-parse.
  let pendingTrivia: string[] = [];
  function takeTrivia(): string | undefined {
    if (pendingTrivia.length === 0) return undefined;
    const text = pendingTrivia.join("\n");
    pendingTrivia = [];
    return text;
  }
  // Lifted-metadata lines (meta:/track: before a section, etc.) are not emitted
  // as blocks; record them verbatim with their position so they round-trip.
  const liftedLines: import("./types").LiftedSourceLine[] = [];
  function recordLifted(text: string): void {
    liftedLines.push({
      text,
      // undefined = no preceding trivia; "" = exactly one blank line.
      lead: pendingTrivia.length === 0 ? undefined : pendingTrivia.join("\n"),
      afterBlockIndex: blocks.length - 1,
    });
    pendingTrivia = [];
  }

  // Snapshot a prose block as a self-contained merge part (no trivia/children).
  function stripParts(b: IntentBlock): IntentBlock {
    return {
      id: b.id,
      type: b.type,
      content: b.content,
      ...(b.originalContent != null && { originalContent: b.originalContent }),
      ...(b.keywordAlias != null && { keywordAlias: b.keywordAlias }),
      ...(b._bare && { _bare: b._bare }),
      ...(b.properties && { properties: b.properties }),
      ...(b.inline && { inline: b.inline }),
    };
  }

  function appendBlockWithProseMerge(
    target: IntentBlock[],
    block: IntentBlock,
  ) {
    const last = target[target.length - 1];
    if (
      !previousLineWasBlank &&
      // Don't merge across trivia (e.g. a `// comment` line between two prose
      // lines) — that would silently drop the comment and break round-trip.
      !block._lead &&
      last &&
      (last.type === "text" || last.type === "body-text") &&
      (block.type === "text" || block.type === "body-text")
    ) {
      const mergedOriginal = `${last.originalContent || last.content} ${block.originalContent || block.content}`;
      const parsed = parseInline(mergedOriginal);
      // Lossless round-trip: record each consecutive prose line as a distinct
      // part so documentToSource re-emits them on their own lines (the form the
      // hash was computed over). Without this, two prose lines collapse to one
      // line on serialize and the document hash — and any seal — would break.
      // Re-parsing the re-split lines reproduces the same merged block + parts.
      const lastParts = last._merged ?? [stripParts(last)];
      last._merged = [...lastParts, stripParts(block)];
      last.originalContent = mergedOriginal;
      last.content = parsed.content;
      last.inline = parsed.inline;
      return;
    }
    target.push(block);
  }

  function flushPendingTable() {
    if (!pendingTable) return;

    if (
      pendingTable.headers &&
      pendingTable.headers.length > 0 &&
      pendingTable.rows.length === 0
    ) {
      diagnostics.push({
        severity: "warning",
        code: "HEADERS_WITHOUT_ROWS",
        message: "Table headers found with no following rows.",
        line: pendingTable.headerLine || 1,
        column: 1,
      });
    }

    const block: IntentBlock = {
      id: nextId(),
      type: "table",
      content: pendingTable.originalHeaders || "",
      _lead: pendingTable.lead,
      table: {
        headers: pendingTable.headers,
        rows: pendingTable.rows,
        headersKeyword: pendingTable.headersKeyword,
        rowKeyword: pendingTable.rowKeyword,
      },
    };

    if (currentSection && currentSection.children) {
      currentSection.children.push(block);
    } else {
      blocks.push(block);
    }

    pendingTable = null;
  }

  for (let i = 0; i < parseLines.length; i++) {
    const line = parseLines[i];
    const trimmed = line.trim();

    // Handle multi-line code blocks (fence mode only)
    // NOTE: This must come BEFORE the comment check so that // lines inside code blocks are preserved
    if (codeCaptureMode) {
      const isEndFence =
        codeCaptureType === "fence" && trimmed.startsWith("```");

      if (isEndFence) {
        // Extract pipe properties from closing fence (e.g., "``` | lang: js")
        const afterClosingFence = trimmed.replace(/^```/, "").trim();
        if (afterClosingFence.startsWith("|")) {
          if (!pendingCodeProperties)
            pendingCodeProperties = Object.create(null);
          const fenceProps = splitPipeMetadata(
            afterClosingFence.substring(1).trim(),
          );
          for (const fp of fenceProps) {
            const fpm = fp.trim().match(/^([\p{L}\p{N}_][\p{L}\p{N}_-]*):\s*(.*)$/u);
            if (fpm && !pendingCodeProperties![fpm[1].trim()]) {
              pendingCodeProperties![fpm[1].trim()] = fpm[2].trim();
            }
          }
        }

        const codeBlock: IntentBlock = {
          id: nextId(),
          type: "code",
          content: codeContent.join("\n"),
          ...(pendingCodeProperties
            ? { properties: pendingCodeProperties }
            : {}),
          _lead: pendingCodeLead,
        };
        pendingCodeLead = undefined;
        if (currentSection && currentSection.children) {
          currentSection.children.push(codeBlock);
        } else {
          blocks.push(codeBlock);
        }
        codeCaptureMode = false;
        codeCaptureType = "keyword";
        codeContent = [];
        codeStartLine = 0;
        pendingCodeProperties = null;
      } else {
        codeContent.push(line);
      }
      previousLineWasBlank = false;
      continue;
    }

    // Comment lines (// ...) — preserved verbatim as trivia for lossless
    // round-trip (they are part of the bytes computeDocumentHash sees).
    if (trimmed.startsWith("//")) {
      pendingTrivia.push(line);
      continue;
    }

    if (!trimmed) {
      previousLineWasBlank = true;
      pendingTrivia.push(line);
      continue;
    }

    // If we have a pending table and current line is not a row (keyword or MD pipe), flush it.
    // Row detection resolves aliases so localized rows (e.g. Arabic صف:) keep the table open.
    const isMdPipeRow = /^\|.+\|$/.test(trimmed);
    const rowKwMatch = trimmed.match(/^(\p{L}[\p{L}\p{N}-]*):/u);
    const isRowLine =
      !!rowKwMatch &&
      (ALIASES[rowKwMatch[1].toLowerCase()] ?? rowKwMatch[1].toLowerCase()) ===
        "row";
    if (pendingTable && !isRowLine && !isMdPipeRow) {
      flushPendingTable();
    }

    // ``` fence — start a fenced code block
    if (trimmed.startsWith("```")) {
      // Extract language hint from fence opening (e.g., ```javascript)
      const fenceLang = trimmed.replace(/^```/, "").trim();
      if (fenceLang) {
        pendingCodeProperties = { lang: fenceLang };
      }
      pendingCodeLead = takeTrivia();
      codeCaptureMode = true;
      codeCaptureType = "fence";
      codeStartLine = i + 1;
      previousLineWasBlank = false;
      continue;
    }

    // --- horizontal rule / divider
    if (trimmed === "---") {
      const dividerBlock: IntentBlock = {
        id: nextId(),
        type: "divider",
        content: "",
        _lead: takeTrivia(),
      };
      if (currentSection && currentSection.children) {
        currentSection.children.push(dividerBlock);
      } else {
        blocks.push(dividerBlock);
        currentSection = null;
      }
      previousLineWasBlank = false;
      continue;
    }

    // Check for code block start via keyword
    const codeMatch = trimmed.match(/^code:\s*(.*)$/);
    if (codeMatch) {
      const afterCode = codeMatch[1].trim();

      // code: ```...``` | props — backtick-delimited code value
      if (afterCode.startsWith("```")) {
        const afterOpen = afterCode.substring(3);

        // Check for closing ``` on the same line (single-line)
        const closeIdx = afterOpen.indexOf("```");
        if (closeIdx !== -1) {
          // Single-line: code: ```content``` | lang: js
          const codeValue = afterOpen.substring(0, closeIdx);
          const afterClose = afterOpen.substring(closeIdx + 3).trim();

          const props: Record<string, string | number> = Object.create(null);
          if (afterClose.startsWith("|")) {
            const parts = splitPipeMetadata(afterClose.substring(1).trim());
            for (const part of parts) {
              const pm = part.trim().match(/^([\p{L}\p{N}_][\p{L}\p{N}_-]*):\s*(.*)$/u);
              if (pm) props[pm[1].trim()] = pm[2].trim();
            }
          }

          const codeBlock: IntentBlock = {
            id: nextId(),
            type: "code",
            content: codeValue,
            ...(Object.keys(props).length > 0 ? { properties: props } : {}),
            _lead: takeTrivia(),
          };
          if (currentSection && currentSection.children) {
            currentSection.children.push(codeBlock);
          } else {
            blocks.push(codeBlock);
          }
          previousLineWasBlank = false;
          continue;
        } else {
          // Multi-line: code: ``` (content on subsequent lines until closing ```)
          if (afterOpen.trim()) {
            codeContent.push(afterOpen);
          }
          pendingCodeLead = takeTrivia();
          codeCaptureMode = true;
          codeCaptureType = "fence";
          codeStartLine = i + 1;
          previousLineWasBlank = false;
          continue;
        }
      }

      // Check if this is pipe-only metadata (no code content)
      // e.g., "code: | lang: javascript" or "code:"
      if (!afterCode || afterCode.startsWith("|")) {
        const props: Record<string, string | number> = Object.create(null);
        if (afterCode.startsWith("|")) {
          const parts = splitPipeMetadata(afterCode.substring(1).trim());
          for (const part of parts) {
            const propMatch = part.trim().match(/^([\p{L}\p{N}_][\p{L}\p{N}_-]*):\s*(.*)$/u);
            if (propMatch) {
              props[propMatch[1].trim()] = propMatch[2].trim();
            }
          }
        }

        // Look ahead for a ``` fence on the next non-blank line
        let nextIdx = i + 1;
        while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;

        if (nextIdx < lines.length && lines[nextIdx].trim().startsWith("```")) {
          // Extract language hint from fence if not already in properties
          const fenceLang = lines[nextIdx].trim().replace(/^```/, "").trim();
          if (fenceLang && !props.lang) {
            props.lang = fenceLang;
          }

          // Enter fence capture mode with properties from code: line
          pendingCodeProperties = Object.keys(props).length > 0 ? props : null;
          pendingCodeLead = takeTrivia();
          codeCaptureMode = true;
          codeCaptureType = "fence";
          codeStartLine = i + 1;
          i = nextIdx; // Skip to the fence line
          previousLineWasBlank = false;
          continue;
        }
      }

      // Single-line code block (content is everything after code:)
      const codeBlock: IntentBlock = {
        id: nextId(),
        type: "code",
        content: afterCode,
        _lead: takeTrivia(),
      };
      if (currentSection && currentSection.children) {
        currentSection.children.push(codeBlock);
      } else {
        blocks.push(codeBlock);
      }
      previousLineWasBlank = false;
      continue;
    }

    // Parse regular line
    const block = parseLine(line, {
      keywords,
      extensions,
      lineNumber: i + 1,
      diagnostics,
      parseInline,
    });
    if (!block) continue;

    // Markdown-style table detection (v1.3 Phase 2)
    // Pattern: | col1 | col2 | or | --- | --- |
    const mdTableMatch = trimmed.match(/^\|(.+)\|$/);
    if (mdTableMatch && trimmed.includes("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1) // Remove empty first and last
        .map((cell) => cell.trim())
        .filter((cell) => cell !== "");

      // Check if it's a separator row (| --- | --- |)
      const isSeparator = cells.every((cell) => /^[-:]+$/.test(cell));

      if (!isSeparator && cells.length > 0) {
        if (!pendingTable) {
          // First row becomes headers
          pendingTable = {
            headers: cells,
            rows: [],
            originalHeaders: trimmed,
            headerLine: i + 1,
            lead: takeTrivia(),
          };
        } else {
          // Subsequent rows are data rows
          pendingTable.rows.push(cells);
        }
        continue;
      } else if (isSeparator && pendingTable) {
        // Skip separator row, just continue with the table
        continue;
      }
    }

    // Table grouping: a headers block starts a table, rows are appended.
    if (block.type === "headers") {
      flushPendingTable();
      pendingTable = {
        headers: splitTableRow(block.originalContent || block.content),
        rows: [],
        originalHeaders: block.originalContent || block.content,
        headerLine: i + 1,
        headersKeyword: block.keywordAlias,
        lead: takeTrivia(),
      };
      previousLineWasBlank = false;
      continue;
    }

    if (block.type === "row") {
      const rowCells = splitTableRow(block.originalContent || block.content);
      if (pendingTable) {
        pendingTable.rows.push(rowCells);
        if (block.keywordAlias && !pendingTable.rowKeyword)
          pendingTable.rowKeyword = block.keywordAlias;
      } else {
        diagnostics.push({
          severity: "warning",
          code: "ROW_WITHOUT_HEADERS",
          message: "Table row found without preceding headers.",
          line: i + 1,
          column: 1,
        });
        // Row without headers becomes a single-row table.
        pendingTable = { rows: [rowCells] };
        flushPendingTable();
      }
      previousLineWasBlank = false;
      continue;
    }

    // v2: Track section appearance for metadata detection
    if (block.type === "section") {
      seenSectionBlock = true;
    }

    // v2.8.1: meta: blocks before any section populate metadata.meta
    // After a section, meta: is emitted as a normal content block
    if (block.type === ("meta" as BlockType)) {
      if (!seenSectionBlock) {
        const metaProps = block.properties || {};
        for (const [k, v] of Object.entries(metaProps)) {
          metaAccumulator[k] = String(v);
        }
        // Don't emit meta: as a visible block — metadata only. Record verbatim
        // so documentToSource can re-emit it in place (lossless round-trip).
        recordLifted(line);
        continue;
      }
      // After a section: fall through to normal block handling
    }

    // v2: agent: and model: at the top of the document (before any section)
    // are treated as document-level metadata, not blocks.
    // v2.14: These are now extension blocks (type: 'extension', x-type: 'agent'/'model')
    const xType =
      block.type === "extension" ? block.properties?.["x-type"] : undefined;
    if (
      (METADATA_KEYWORDS.has(block.type) ||
        xType === "agent" ||
        xType === "model") &&
      !seenSectionBlock
    ) {
      if (block.type === ("agent" as BlockType) || xType === "agent") {
        agenticMetadata.agent = block.content;
        if (block.properties?.model) {
          agenticMetadata.model = String(block.properties.model);
        }
      } else if (block.type === ("model" as BlockType) || xType === "model") {
        agenticMetadata.model = block.content;
      }
      recordLifted(line);
      continue;
    }

    // v2: context: blocks before any section populate document metadata
    if (block.type === "context" && !seenSectionBlock) {
      const ctxProps = block.properties || {};
      if (!agenticMetadata.context) agenticMetadata.context = {};
      for (const [k, v] of Object.entries(ctxProps)) {
        agenticMetadata.context[k] = String(v);
      }
      // Still emit the context block for rendering
    }

    // v2.8: track: block populates tracking metadata
    if (block.type === ("track" as BlockType)) {
      trackingMeta = {
        version: block.properties?.version
          ? String(block.properties.version)
          : "1.0",
        by: block.properties?.by ? String(block.properties.by) : "",
        active: true,
      };
      // Don't emit track: as a visible block — it's metadata. Record verbatim
      // for lossless round-trip.
      recordLifted(line);
      continue;
    }

    // v2.12: history: keyword produces no block output — it's a structural boundary
    if (block.type === ("history" as BlockType)) {
      continue;
    }

    // v2.8: sign: block populates signatures metadata
    if (block.type === ("sign" as BlockType)) {
      signatureBlocks.push({
        signer: block.content,
        role: block.properties?.role
          ? String(block.properties.role)
          : undefined,
        at: block.properties?.at ? String(block.properties.at) : "",
        hash: block.properties?.hash ? String(block.properties.hash) : "",
        ...(block.properties?.spec != null && {
          spec: Number(block.properties.spec),
        }),
      });
      // Still emit sign: as a block for rendering
    }

    // v2.8: freeze: block populates freeze metadata
    if (block.type === ("freeze" as BlockType)) {
      freezeMeta = {
        at: block.properties?.at ? String(block.properties.at) : "",
        hash: block.properties?.hash ? String(block.properties.hash) : "",
        ...(block.properties?.spec != null && {
          spec: Number(block.properties.spec),
        }),
        ...(block.properties?.appearance != null && {
          appearance: String(block.properties.appearance),
        }),
        status: "locked",
      };
      // Still emit freeze: as a block for rendering
    }

    // v2: auto-ID for step blocks
    if (block.type === "step") {
      stepAutoIdCounter++;
      if (block.properties?.id) {
        // Explicit id overrides auto-numbering
        block.id = String(block.properties.id);
      } else {
        block.id = `step-${stepAutoIdCounter}`;
        if (!block.properties) block.properties = {};
        block.properties.id = `step-${stepAutoIdCounter}`;
      }
    }

    // Lossless round-trip: attach accumulated trivia (blank/comment lines) that
    // preceded this block so documentToSource re-emits them verbatim.
    block._lead = takeTrivia();

    // Handle section hierarchy (section -> sub -> sub2, max 3 levels)
    if (block.type === "section") {
      currentSection = block;
      currentSection.children = [];
      blocks.push(currentSection);
    } else if (block.type === "sub") {
      if (currentSection) {
        block.children = [];
        appendBlockWithProseMerge(currentSection.children!, block);
      } else {
        // No parent section, add to root
        appendBlockWithProseMerge(blocks, block);
      }
    } else if (block.type === "title" || block.type === "summary") {
      // These can appear anywhere, don't affect current section
      appendBlockWithProseMerge(blocks, block);
    } else if (
      block.type === "divider" ||
      block.type === "image" ||
      block.type === "link" ||
      block.type === "code" ||
      block.type === "table" ||
      block.type === "body-text" ||
      block.type === "text" ||
      block.type === "page" ||
      block.type === "break" ||
      block.type === "toc" ||
      // v2.14: extension blocks that were formerly top-level layout/structure blocks
      (block.type === "extension" &&
        (DOCGEN_LAYOUT_TYPES.has(String(block.properties?.["x-type"])) ||
          String(block.properties?.["x-type"]) === "ref" ||
          String(block.properties?.["x-type"]) === "embed" ||
          String(block.properties?.["x-type"]) === "dedication" ||
          String(block.properties?.["x-type"]) === "toc"))
    ) {
      // Top-level blocks reset current section
      appendBlockWithProseMerge(blocks, block);
      currentSection = null;
    } else {
      // Content blocks (task, note, question, list-item, agentic blocks, etc.)
      // Find target section (deepest nested)
      let target = currentSection;
      if (target) {
        const lastSub = target.children?.[target.children.length - 1];
        if (lastSub?.type === "sub") {
          target = lastSub;
        }
        if (!target.children) target.children = [];
        appendBlockWithProseMerge(target.children, block);
      } else {
        appendBlockWithProseMerge(blocks, block);
      }
    }

    previousLineWasBlank = false;
  }

  // Flush any remaining table at EOF
  flushPendingTable();

  // EOF while still capturing code
  if (codeCaptureMode) {
    diagnostics.push({
      severity: "error",
      code: "UNTERMINATED_CODE_BLOCK",
      message:
        "Unterminated code block. Expected closing ``` before end of file.",
      line: codeStartLine || lines.length,
      column: 1,
    });

    // Best-effort: still emit the code block we captured.
    const codeBlock: IntentBlock = {
      id: nextId(),
      type: "code",
      content: codeContent.join("\n"),
      ...(pendingCodeProperties ? { properties: pendingCodeProperties } : {}),
      _lead: pendingCodeLead,
    };
    pendingCodeProperties = null;
    pendingCodeLead = undefined;

    if (currentSection && currentSection.children) {
      currentSection.children.push(codeBlock);
    } else {
      blocks.push(codeBlock);
    }
  }

  // Extract document metadata
  const titleBlock = blocks.find((b) => b.type === "title");
  const summaryBlock = blocks.find((b) => b.type === "summary");
  const hasArabic = blocks.some((b) => detectArabic(b.content));
  // Explicit direction override: `meta: | dir: rtl` (or any block carrying a
  // dir: property) beats auto-detection.
  const dirOverride = (() => {
    const m = metaAccumulator?.dir;
    if (m === "rtl" || m === "ltr") return m;
    for (const b of blocks) {
      const d = b.properties?.dir;
      if (d === "rtl" || d === "ltr") return d;
    }
    return undefined;
  })();

  // Determine version based on presence of agentic blocks/metadata
  const allBlocks = blocks.flatMap(function collect(
    b: IntentBlock,
  ): IntentBlock[] {
    return [b, ...(b.children ?? []).flatMap(collect)];
  });
  const hasDocgenContent = allBlocks.some(
    (b) => DOCGEN_LAYOUT_TYPES.has(b.type) || DOCGEN_WRITER_TYPES.has(b.type),
  );
  const hasTrustContent =
    trackingMeta != null ||
    signatureBlocks.length > 0 ||
    freezeMeta != null ||
    allBlocks.some((b) => TRUST_KEYWORDS.has(b.type));
  const hasV22Content = allBlocks.some((b) => V22_BLOCK_TYPES.has(b.type));
  const hasV21Content = allBlocks.some((b) => V21_BLOCK_TYPES.has(b.type));
  const hasAgenticContent =
    allBlocks.some((b) => AGENTIC_BLOCK_TYPES.has(b.type)) ||
    agenticMetadata.agent != null ||
    agenticMetadata.model != null ||
    agenticMetadata.context != null;

  const metadata: IntentDocumentMetadata = {
    title: titleBlock?.content,
    summary: summaryBlock?.content,
    language: dirOverride ?? (hasArabic ? "rtl" : "ltr"),
    ...(agenticMetadata.agent != null && { agent: agenticMetadata.agent }),
    ...(agenticMetadata.model != null && { model: agenticMetadata.model }),
    ...(agenticMetadata.context != null && {
      context: agenticMetadata.context,
    }),
    ...(trackingMeta != null && { tracking: trackingMeta }),
    ...(signatureBlocks.length > 0 && { signatures: signatureBlocks }),
    ...(freezeMeta != null && { freeze: freezeMeta }),
    ...(Object.keys(metaAccumulator).length > 0 && { meta: metaAccumulator }),
  };

  // v2.12: detect if history: keyword boundary is used (not legacy ---)
  const hasV212Content =
    (historyBoundaryIdx !== -1 &&
      lines[historyBoundaryIdx].trim().startsWith("history:")) ||
    allBlocks.some((b) => b.type === "history");

  // The feature level INFERRED from what the document actually uses.
  const detectedFeatureLevel = hasV212Content
    ? "2.12"
    : allBlocks.some((b) => V211_BLOCK_TYPES.has(b.type))
      ? "2.11"
      : hasTrustContent
        ? "2.8"
        : hasDocgenContent
          ? "2.5"
          : hasV22Content
            ? "2.2"
            : hasV21Content
              ? "2.1"
              : hasAgenticContent
                ? "2.0"
                : "1.4";

  // T-04: an OPTIONAL `// it-format: <version>` comment in the leading header
  // declares the grammar version the file claims to conform to. It is a comment, so
  // it never enters the seal hash and round-trips as trivia. Honored ONLY in the
  // top-of-file comment block (never inside body or code). When absent, `version`
  // falls back to the detected feature level — unchanged behavior for old consumers.
  const formatStamp = ((): string | undefined => {
    for (const raw of lines) {
      const t = raw.trim();
      if (t === "") continue;
      if (t.startsWith("//")) {
        const m = t.match(/^\/\/\s*it-format:\s*(\S+)/i);
        if (m) return m[1];
        continue;
      }
      break; // first real line — the stamp must live in the header comment block
    }
    return undefined;
  })();

  const document: IntentDocument = {
    // The version the document claims (the stamp) or, absent a stamp, the detected
    // level. detectedFeatureLevel is surfaced only WHEN a stamp is present (so you
    // can compare claim vs reality); without a stamp, `version` already is it.
    version: formatStamp ?? detectedFeatureLevel,
    ...(formatStamp != null && { detectedFeatureLevel }),
    blocks,
    metadata,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    ...(historySection != null && { history: historySection }),
    ...(liftedLines.length > 0 && { _liftedLines: liftedLines }),
    ...(pendingTrivia.length > 0 && { _trailing: pendingTrivia.join("\n") }),
  };

  // Extension validations
  for (const ext of extensions) {
    if (!ext.validate) continue;
    const extDiags = ext.validate(document);
    if (extDiags && extDiags.length > 0) {
      if (!document.diagnostics) document.diagnostics = [];
      document.diagnostics.push(...extDiags);
    }
  }

  return document;
}

// --- parseIntentTextSafe: production-grade parser wrapper ---

export interface SafeParseOptions {
  /** How to handle unrecognised keywords. Default: 'note' */
  unknownKeyword: "note" | "skip" | "throw";
  /** Maximum number of blocks to parse. Default: 10000 */
  maxBlocks: number;
  /** Maximum line length in characters. Default: 50000 */
  maxLineLength: number;
  /** If true, unknown keywords become errors instead of warnings. Default: false */
  strict: boolean;
}

export const DEFAULT_SAFE_PARSE_OPTIONS: SafeParseOptions = {
  unknownKeyword: "note",
  maxBlocks: 10000,
  maxLineLength: 50000,
  strict: false,
};

export interface ParseWarning {
  line: number;
  message: string;
  code: string;
  original: string;
}

export interface ParseError {
  line: number;
  message: string;
  code: string;
  original: string;
}

export interface SafeParseResult {
  document: IntentDocument;
  warnings: ParseWarning[];
  errors: ParseError[];
}

/**
 * Production-grade parser that never throws.
 * Wraps parseIntentText with line-length limits, block count caps,
 * and configurable unknown-keyword handling.
 */
export function parseIntentTextSafe(
  source: string,
  options?: Partial<SafeParseOptions>,
): SafeParseResult {
  const opts: SafeParseOptions = { ...DEFAULT_SAFE_PARSE_OPTIONS, ...options };
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];

  // Never throw — handle any input
  if (typeof source !== "string" || source.length === 0) {
    return {
      document: { version: "1.4", blocks: [], metadata: {}, diagnostics: [] },
      warnings: [],
      errors: [],
    };
  }

  try {
    // Pre-process: truncate long lines
    const rawLines = source.split(/\r\n|\r|\n/);
    const processedLines: string[] = [];
    const knownKeywords = new Set(KEYWORDS);

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];

      // Truncate long lines
      if (line.length > opts.maxLineLength) {
        warnings.push({
          line: i + 1,
          message: `Line truncated from ${line.length} to ${opts.maxLineLength} characters`,
          code: "LINE_TRUNCATED",
          original: line.slice(0, 200) + "...",
        });
        line = line.slice(0, opts.maxLineLength);
      }

      // Check for unknown keywords
      const kwMatch = line.match(/^(\s*)([a-zA-Z_-]+)\s*:/);
      if (kwMatch) {
        const kw = kwMatch[2].toLowerCase();
        if (!knownKeywords.has(kw) && !line.trim().startsWith("//")) {
          const entry = {
            line: i + 1,
            message: `Unknown keyword: "${kw}"`,
            code: "UNKNOWN_KEYWORD",
            original: line,
          };

          if (opts.strict || opts.unknownKeyword === "throw") {
            errors.push(entry);
          } else {
            warnings.push(entry);
          }

          if (opts.unknownKeyword === "skip") {
            continue; // skip this line entirely
          }
          // 'note' mode: keep the line as-is; the parser emits type:"custom" for
          // unknown keywords and preserves the original keyword in properties.
        }
      }

      processedLines.push(line);
    }

    // Enforce maxBlocks by truncating input if needed
    // We parse the full preprocessed source first, then trim
    const processedSource = processedLines.join("\n");
    const document = parseIntentText(processedSource);

    // Check block count
    if (document.blocks.length > opts.maxBlocks) {
      warnings.push({
        line: 0,
        message: `Document has ${document.blocks.length} blocks, truncated to ${opts.maxBlocks}`,
        code: "MAX_BLOCKS_REACHED",
        original: "",
      });
      document.blocks = document.blocks.slice(0, opts.maxBlocks);
    }

    return { document, warnings, errors };
  } catch (e: unknown) {
    // Never throw — wrap any unexpected error
    const message = e instanceof Error ? e.message : "Unknown parser error";
    errors.push({
      line: 0,
      message,
      code: "PARSE_EXCEPTION",
      original: "",
    });
    return {
      document: { version: "1.4", blocks: [], metadata: {}, diagnostics: [] },
      warnings,
      errors,
    };
  }
}
