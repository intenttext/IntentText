import { v4 as uuidv4 } from "uuid";
import {
  IntentBlock,
  BlockType,
  IntentDocument,
  Diagnostic,
  InlineNode,
  ParseOptions,
  IntentExtension,
} from "./types";

// Reserved keywords (case-insensitive)
const KEYWORDS = [
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

// Keyword aliases: maps a written keyword to its canonical block type
const KEYWORD_ALIASES: Record<string, string> = {
  question: "ask",
  subsection: "sub",
  done: "task",
};

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

  let i = 0;
  while (i < text.length) {
    // Check for link pattern [text](url)
    if (text[i] === "[") {
      const linkEnd = text.indexOf("](", i);
      const urlEnd = linkEnd >= 0 ? text.indexOf(")", linkEnd + 2) : -1;
      if (linkEnd > i && urlEnd > linkEnd) {
        const linkText = text.slice(i + 1, linkEnd);
        const linkUrl = text.slice(linkEnd + 2, urlEnd);
        addNode({ type: "link", value: linkText, href: linkUrl });
        i = urlEnd + 1;
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

    // Check for bold/italic/strike with */_/~
    const ch = text[i];
    if (ch === "*" || ch === "_" || ch === "~") {
      const end = text.indexOf(ch, i + 1);
      if (end === -1) {
        currentText += ch;
        i++;
        continue;
      }
      const innerText = text.slice(i + 1, end);
      const type = ch === "*" ? "bold" : ch === "_" ? "italic" : "strike";
      addNode({ type, value: innerText });
      i = end + 1;
      continue;
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
  const shortcuts: Record<string, string> = {};

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
  },
): IntentBlock | null {
  const trimmed = line.trim();

  if (!trimmed) return null;

  // Check for keyword blocks
  const keywordMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9-]*):\s*(.*)$/);
  if (keywordMatch) {
    const keyword = keywordMatch[1].toLowerCase();
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
          id: uuidv4(),
          type: "extension",
          content: cleanContent,
          originalContent: trimmed,
          inline,
          properties: { keyword },
        };
      }

      const { content: cleanContent, inline } = ctx.parseInline(trimmed);
      return {
        id: uuidv4(),
        type: "body-text",
        content: cleanContent,
        originalContent: trimmed,
        inline,
      };
    }

    // Spec rule: split on " | " (space-pipe-space). Non key:value segments
    // after the first are treated as content continuation.
    // But NOT for headers and rows which use | as data separator.
    let content: string;
    const properties: Record<string, string | number> = {};

    if (keyword === "headers" || keyword === "row") {
      content = rest;
    } else {
      const parts = splitPipeMetadata(rest);
      content = unescapeIntentText(parts[0] || "");

      for (let i = 1; i < parts.length; i++) {
        const segment = parts[i];
        const propMatch = segment.match(/^([^:]+):\s*(.*)$/);
        if (propMatch) {
          const key = propMatch[1].trim();
          const rawValue = propMatch[2].trim();

          // v1 policy: property keys are not escapable (keep simple + deterministic).
          if (key.includes("\\") || key.includes("|")) {
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
        id: uuidv4(),
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

    // Apply keyword aliases (e.g. question → ask, subsection → sub, done → task)
    const resolvedType = (KEYWORD_ALIASES[keyword] ?? keyword) as BlockType;

    // done: always carries status: "done" on the normalized task block
    if (keyword === "done") {
      properties.status = "done";
    }

    return {
      id: uuidv4(),
      type: resolvedType,
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
      id: uuidv4(),
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
    const embedded = parseLine(payload, {
      ...ctx,
      // embedded content shares same line number
    });
    if (
      embedded &&
      embedded.type !== "list-item" &&
      embedded.type !== "step-item"
    ) {
      return {
        id: uuidv4(),
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
      id: uuidv4(),
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
      id: uuidv4(),
      type: "step-item",
      content: cleanContent,
      originalContent: content,
      inline,
    };
  }

  // Default to body-text
  const unescaped = unescapeIntentText(trimmed);
  const { content: cleanContent, inline } = ctx.parseInline(unescaped);

  return {
    id: uuidv4(),
    type: "body-text",
    content: cleanContent,
    originalContent: unescaped,
    inline,
  };
}

// Main parser function
export function parseIntentText(
  fileContent: string,
  options?: ParseOptions,
): IntentDocument {
  const lines = fileContent.split(/\r?\n/);
  const blocks: IntentBlock[] = [];
  const diagnostics: Diagnostic[] = [];
  let currentSection: IntentBlock | null = null;
  let codeCaptureMode = false;
  let codeCaptureType: "keyword" | "fence" = "keyword";
  let codeContent: string[] = [];
  let codeStartLine = 0;

  const extensions = options?.extensions || [];
  const keywords = new Set(KEYWORDS);
  for (const ext of extensions) {
    for (const k of ext.keywords || []) {
      keywords.add(k.toLowerCase());
    }
  }

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
  } | null = null;

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
      id: uuidv4(),
      type: "table",
      content: pendingTable.originalHeaders || "",
      table: {
        headers: pendingTable.headers,
        rows: pendingTable.rows,
      },
    };

    if (currentSection && currentSection.children) {
      currentSection.children.push(block);
    } else {
      blocks.push(block);
    }

    pendingTable = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle multi-line code blocks (both keyword and fence modes)
    // NOTE: This must come BEFORE the comment check so that // lines inside code blocks are preserved
    if (codeCaptureMode) {
      const isEndKeyword =
        codeCaptureType === "keyword" && trimmed.toLowerCase() === "end:";
      const isEndFence =
        codeCaptureType === "fence" && trimmed.startsWith("```");

      if (isEndKeyword || isEndFence) {
        const codeBlock: IntentBlock = {
          id: uuidv4(),
          type: "code",
          content: codeContent.join("\n"),
        };
        if (currentSection && currentSection.children) {
          currentSection.children.push(codeBlock);
        } else {
          blocks.push(codeBlock);
        }
        codeCaptureMode = false;
        codeCaptureType = "keyword";
        codeContent = [];
        codeStartLine = 0;
      } else {
        codeContent.push(line);
      }
      continue;
    }

    // Comment lines (// ...) are silently ignored
    if (trimmed.startsWith("//")) continue;

    // If we have a pending table and current line is not a row (keyword or MD pipe), flush it.
    const isMdPipeRow = /^\|.+\|$/.test(trimmed);
    if (pendingTable && !/^row:\s*/i.test(trimmed) && !isMdPipeRow) {
      flushPendingTable();
    }

    // ``` fence — start a fenced code block
    if (trimmed.startsWith("```")) {
      codeCaptureMode = true;
      codeCaptureType = "fence";
      codeStartLine = i + 1;
      continue;
    }

    // --- horizontal rule / divider
    if (trimmed === "---") {
      const dividerBlock: IntentBlock = {
        id: uuidv4(),
        type: "divider",
        content: "",
      };
      if (currentSection && currentSection.children) {
        currentSection.children.push(dividerBlock);
      } else {
        blocks.push(dividerBlock);
        currentSection = null;
      }
      continue;
    }

    // Stray end: outside code capture mode
    if (trimmed.toLowerCase() === "end:") {
      diagnostics.push({
        severity: "warning",
        code: "UNEXPECTED_END",
        message: "Unexpected 'end:' outside of a code block.",
        line: i + 1,
        column: 1,
      });
      continue;
    }

    // Check for code block start via keyword
    const codeMatch = trimmed.match(/^code:\s*(.*)$/);
    if (codeMatch) {
      const inlineCode = codeMatch[1];
      if (inlineCode === "") {
        codeCaptureMode = true;
        codeCaptureType = "keyword";
        codeStartLine = i + 1;
      } else {
        const codeBlock: IntentBlock = {
          id: uuidv4(),
          type: "code",
          content: inlineCode,
        };
        if (currentSection && currentSection.children) {
          currentSection.children.push(codeBlock);
        } else {
          blocks.push(codeBlock);
        }
      }
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

    // Table grouping: headers starts a table, rows are appended.
    if (block.type === "headers") {
      flushPendingTable();
      pendingTable = {
        headers: splitTableRow(block.originalContent || block.content),
        rows: [],
        originalHeaders: block.originalContent || block.content,
        headerLine: i + 1,
      };
      continue;
    }

    if (block.type === "row") {
      const rowCells = splitTableRow(block.originalContent || block.content);
      if (pendingTable) {
        pendingTable.rows.push(rowCells);
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
      continue;
    }

    // Handle section hierarchy (section -> sub -> sub2, max 3 levels)
    if (block.type === "section") {
      currentSection = block;
      currentSection.children = [];
      blocks.push(currentSection);
    } else if (block.type === "sub") {
      if (currentSection) {
        block.children = [];
        currentSection.children!.push(block);
      } else {
        // No parent section, add to root
        blocks.push(block);
      }
    } else if (block.type === "title" || block.type === "summary") {
      // These can appear anywhere, don't affect current section
      blocks.push(block);
    } else if (
      block.type === "divider" ||
      block.type === "image" ||
      block.type === "link" ||
      block.type === "ref" ||
      block.type === "embed" ||
      block.type === "code" ||
      block.type === "table" ||
      block.type === "body-text"
    ) {
      // Top-level blocks reset current section
      blocks.push(block);
      currentSection = null;
    } else {
      // Content blocks (task, note, question, list-item, etc.)
      // Find target section (deepest nested)
      let target = currentSection;
      if (target) {
        const lastSub = target.children?.[target.children.length - 1];
        if (lastSub?.type === "sub") {
          target = lastSub;
        }
        if (!target.children) target.children = [];
        target.children.push(block);
      } else {
        blocks.push(block);
      }
    }
  }

  // Flush any remaining table at EOF
  flushPendingTable();

  // EOF while still capturing code
  if (codeCaptureMode) {
    diagnostics.push({
      severity: "error",
      code: "UNTERMINATED_CODE_BLOCK",
      message: "Unterminated code block. Expected 'end:' before end of file.",
      line: codeStartLine || lines.length,
      column: 1,
    });

    // Best-effort: still emit the code block we captured.
    const codeBlock: IntentBlock = {
      id: uuidv4(),
      type: "code",
      content: codeContent.join("\n"),
    };

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

  const document: IntentDocument = {
    version: "1.2",
    blocks,
    metadata: {
      title: titleBlock?.content,
      summary: summaryBlock?.content,
      language: hasArabic ? "rtl" : "ltr",
    },
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
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
