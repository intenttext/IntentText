/**
 * HTML-to-IntentText converter (Node.js only).
 * Uses node-html-parser for server-side HTML parsing.
 * For browser usage, see the web-to-it app which uses native DOMParser.
 *
 * Node.js: uses node-html-parser
 */

// Tags to strip entirely (including children)
const STRIP_TAGS = new Set([
  "script",
  "style",
  "meta",
  "link",
  "noscript",
  "head",
]);

// Tags that are transparent containers (just recurse into children)
const TRANSPARENT_TAGS = new Set([
  "div",
  "span",
  "main",
  "article",
  "header",
  "footer",
  "nav",
  "aside",
  "section",
  "figure",
  "figcaption",
  "details",
  "summary",
  "body",
  "html",
]);

interface SimpleNode {
  nodeType: number;
  tagName: string;
  text: string;
  childNodes: SimpleNode[];
  getAttribute(name: string): string | null;
  querySelectorAll(selector: string): SimpleNode[];
}

function parseHtml(html: string): SimpleNode {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parse } = require("node-html-parser");
  return parse(html, { comment: false });
}

/**
 * Convert HTML string to IntentText format.
 */
export function convertHtmlToIntentText(html: string): string {
  if (typeof html !== "string" || html.length === 0) return "";

  const root = parseHtml(html);
  const lines: string[] = [];
  processChildren(root, lines);

  // Clean up: collapse 3+ blank lines to 1, trim
  const cleaned: string[] = [];
  let blankCount = 0;
  for (const line of lines) {
    if (line === "") {
      blankCount++;
      if (blankCount <= 1) cleaned.push("");
    } else {
      blankCount = 0;
      cleaned.push(line);
    }
  }

  // Trim trailing blank lines
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") {
    cleaned.pop();
  }

  return cleaned.join("\n");
}

function processChildren(node: SimpleNode, lines: string[]): void {
  for (const child of node.childNodes) {
    processNode(child, lines);
  }
}

function processNode(node: SimpleNode, lines: string[]): void {
  // Text nodes
  if (node.nodeType === 3) {
    const text = (node.text || "").trim();
    if (text) {
      // Standalone text not inside any element — treat as note
      lines.push(`note: ${text}`);
    }
    return;
  }

  // Only process element nodes
  if (node.nodeType !== 1) return;

  const tag = (node.tagName || "").toLowerCase();

  // Strip dangerous/unwanted elements
  if (STRIP_TAGS.has(tag)) return;

  // Transparent containers: recurse into children
  if (TRANSPARENT_TAGS.has(tag)) {
    processChildren(node, lines);
    return;
  }

  switch (tag) {
    case "h1":
      lines.push(`title: ${getInlineText(node)}`);
      lines.push("");
      break;

    case "h2":
      lines.push(`section: ${getInlineText(node)}`);
      lines.push("");
      break;

    case "h3":
    case "h4":
    case "h5":
    case "h6":
      lines.push(`sub: ${getInlineText(node)}`);
      lines.push("");
      break;

    case "p":
      handleParagraph(node, lines);
      lines.push("");
      break;

    case "ul":
      processListItems(node, lines, "unordered");
      lines.push("");
      break;

    case "ol":
      processListItems(node, lines, "ordered");
      lines.push("");
      break;

    case "blockquote":
      lines.push(`quote: ${getInlineText(node)}`);
      lines.push("");
      break;

    case "pre":
      processCodeBlock(node, lines);
      lines.push("");
      break;

    case "table":
      processTable(node, lines);
      lines.push("");
      break;

    case "img":
      processImage(node, lines);
      break;

    case "a":
      processBlockLink(node, lines);
      break;

    case "hr":
      lines.push("---");
      lines.push("");
      break;

    case "br":
      break;

    default:
      // Unknown elements: try to recurse into children
      processChildren(node, lines);
      break;
  }
}

/**
 * Handle a paragraph — may contain a standalone image or link.
 */
function handleParagraph(node: SimpleNode, lines: string[]): void {
  const children = node.childNodes.filter(
    (c) => c.nodeType === 1 || (c.nodeType === 3 && (c.text || "").trim()),
  );

  // Single image inside <p>
  if (
    children.length === 1 &&
    children[0].nodeType === 1 &&
    (children[0].tagName || "").toLowerCase() === "img"
  ) {
    processImage(children[0], lines);
    return;
  }

  // Single link inside <p>
  if (
    children.length === 1 &&
    children[0].nodeType === 1 &&
    (children[0].tagName || "").toLowerCase() === "a"
  ) {
    processBlockLink(children[0], lines);
    return;
  }

  const text = getInlineText(node);
  if (text) {
    lines.push(`note: ${text}`);
  }
}

/**
 * Extract inline text with IntentText formatting.
 */
function getInlineText(node: SimpleNode): string {
  if (node.nodeType === 3) return node.text || "";
  if (node.nodeType !== 1) return "";

  const tag = (node.tagName || "").toLowerCase();
  const inner = node.childNodes.map(getInlineText).join("");

  switch (tag) {
    case "strong":
    case "b":
      return `*${inner.trim()}*`;
    case "em":
    case "i":
      return `_${inner.trim()}_`;
    case "del":
    case "s":
    case "strike":
      return `~${inner.trim()}~`;
    case "code":
      return `\`\`\`${inner}\`\`\``;
    case "a": {
      const href = node.getAttribute("href") || "";
      if (!href || href.startsWith("javascript:") || href.startsWith("data:")) {
        return inner;
      }
      return `[${inner.trim()}](${href})`;
    }
    case "br":
      return "\n";
    case "img": {
      const alt = node.getAttribute("alt") || "";
      return alt;
    }
    default:
      return inner;
  }
}

/**
 * Process list items (<ul> or <ol>).
 */
function processListItems(
  node: SimpleNode,
  lines: string[],
  type: "ordered" | "unordered",
): void {
  let index = 1;
  for (const child of node.childNodes) {
    if (child.nodeType !== 1) continue;
    const childTag = (child.tagName || "").toLowerCase();
    if (childTag !== "li") continue;

    // Check for checkbox (task list)
    const checkbox = child.querySelectorAll("input");
    const cb =
      checkbox.length > 0 &&
      (checkbox[0].getAttribute("type") || "").toLowerCase() === "checkbox"
        ? checkbox[0]
        : null;

    if (cb) {
      const checked = cb.getAttribute("checked") !== undefined;
      const text = getInlineText(child)
        .replace(/^\s*\[.\]\s*/, "")
        .trim();
      if (checked) {
        lines.push(`done: ${text}`);
      } else {
        lines.push(`task: ${text}`);
      }
    } else {
      const text = getInlineText(child).trim();
      if (type === "ordered") {
        lines.push(`${index}. ${text}`);
        index++;
      } else {
        lines.push(`- ${text}`);
      }
    }
  }
}

/**
 * Process a code block (<pre>, usually containing <code>).
 */
function processCodeBlock(node: SimpleNode, lines: string[]): void {
  // node-html-parser treats <pre> content as raw text, so <code> tags
  // may appear as literal text rather than child elements. Strip them.
  let content = node.text || "";
  content = content.replace(/^<code[^>]*>/i, "").replace(/<\/code>$/i, "");

  lines.push("```");
  // Preserve original whitespace/newlines in code
  const codeLines = content.split("\n");
  // Trim trailing empty line (common in <pre> tags)
  if (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === "") {
    codeLines.pop();
  }
  if (codeLines.length > 0 && codeLines[0].trim() === "") {
    codeLines.shift();
  }
  lines.push(...codeLines);
  lines.push("```");
}

/**
 * Process a table element.
 */
function processTable(node: SimpleNode, lines: string[]): void {
  const rows = node.querySelectorAll("tr");
  let isFirstRow = true;

  for (const row of rows) {
    const thCells = row.querySelectorAll("th");
    const tdCells = row.querySelectorAll("td");
    const cells = thCells.length > 0 ? thCells : tdCells;

    const values = cells.map((c: SimpleNode) => getInlineText(c).trim());
    if (values.length === 0) continue;

    if (isFirstRow && thCells.length > 0) {
      // Header row with <th> elements
      lines.push(`| ${values.join(" | ")} |`);
      isFirstRow = false;
    } else if (isFirstRow) {
      // First row but no <th> — treat as header anyway
      lines.push(`| ${values.join(" | ")} |`);
      isFirstRow = false;
    } else {
      lines.push(`| ${values.join(" | ")} |`);
    }
  }
}

/**
 * Process a standalone image element.
 */
function processImage(node: SimpleNode, lines: string[]): void {
  const alt = node.getAttribute("alt") || "";
  const src = node.getAttribute("src") || "";
  const caption = node.getAttribute("title") || "";

  if (!src) return;

  let line = `image: ${alt || "image"} | src: ${src}`;
  if (caption) {
    line += ` | caption: ${caption}`;
  }
  lines.push(line);
}

/**
 * Process a standalone block-level link.
 */
function processBlockLink(node: SimpleNode, lines: string[]): void {
  const href = node.getAttribute("href") || "";
  const text = getInlineText(node).trim();

  if (!href || href.startsWith("javascript:") || href.startsWith("data:")) {
    if (text) lines.push(`note: ${text}`);
    return;
  }

  // Remove the link formatting from text since we're making it a link: block
  const cleanText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  lines.push(`link: ${cleanText || href} | to: ${href}`);
}
