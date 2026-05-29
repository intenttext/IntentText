export function convertMarkdownToIntentText(markdown: string): string {
  if (typeof markdown !== "string" || markdown.length === 0) return "";

  const lines = markdown.split(/\r?\n/);

  const out: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushCodeBlock = () => {
    out.push("code:");
    out.push(...codeLines);
    out.push("end:");
    codeLines = [];
  };

  const convertInline = (text: string): string => {
    let result = text;

    // Images/links are handled at the block level.

    // Inline code: Markdown `code` -> IntentText ```code``` (triple backtick)
    result = result.replace(/`([^`]+)`/g, "```$1```");

    // Protect bold markers during italic conversion
    const BOLD_START = "\x00BS\x00";
    const BOLD_END = "\x00BE\x00";
    let boldIndex = 0;
    result = result.replace(/\*\*/g, () =>
      boldIndex++ % 2 === 0 ? BOLD_START : BOLD_END,
    );

    // Italic: *text* -> _text_
    result = result.replace(/(^|\s)\*([^*\s][^*]*?)\*(?=(\s|$))/g, "$1_$2_");

    // Restore bold markers: **text** -> *text*
    result = result.replace(new RegExp(BOLD_START, "g"), "*");
    result = result.replace(new RegExp(BOLD_END, "g"), "*");

    // Strikethrough: ~~text~~ -> ~text~
    result = result.replace(/~~([^~]+)~~/g, "~$1~");

    return result;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Fenced code blocks
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        continue;
      } else {
        inCodeBlock = false;
        flushCodeBlock();
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    if (!trimmed) {
      out.push("");
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push("---");
      continue;
    }

    // Headings
    const h = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const text = convertInline(h[2].trim());
      if (level === 1) out.push(`title: ${text}`);
      else if (level === 2) out.push(`section: ${text}`);
      else out.push(`sub: ${text}`);
      continue;
    }

    // Image: ![alt](url)
    const img = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const alt = convertInline(img[1].trim());
      const url = img[2].trim();
      out.push(`image: ${alt} | src: ${url}`);
      continue;
    }

    // Link: [text](url)
    const link = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const text = convertInline(link[1].trim());
      const url = link[2].trim();
      out.push(`link: ${text} | to: ${url}`);
      continue;
    }

    // Unordered lists
    const ul = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      out.push(`- ${convertInline(ul[1].trim())}`);
      continue;
    }

    // Ordered lists
    const ol = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (ol) {
      out.push(`${ol[1]}. ${convertInline(ol[2].trim())}`);
      continue;
    }

    // Blockquote: > text -> quote: text
    const bq = trimmed.match(/^>\s*(.*)$/);
    if (bq) {
      out.push(`quote: ${convertInline(bq[1].trim())}`);
      continue;
    }

    // Markdown table: | col1 | col2 | col3 |
    if (/^\|.+\|$/.test(trimmed)) {
      // Skip separator rows (| --- | --- |)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => convertInline(c.trim()));
      // Check if previous line was empty or this is first table row
      const isHeader =
        i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim());
      if (isHeader) {
        out.push(`headers: ${cells.join(" | ")}`);
      } else {
        out.push(`row: ${cells.join(" | ")}`);
      }
      continue;
    }

    // Default: paragraph -> note
    out.push(`note: ${convertInline(trimmed)}`);
  }

  // Unterminated fenced code: best-effort flush
  if (inCodeBlock) {
    flushCodeBlock();
  }

  // Avoid accidental trailing whitespace-only lines while preserving a single newline at end.
  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop();
  }

  return out.join("\n");
}
