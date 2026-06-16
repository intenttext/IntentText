import { IntentDocument, IntentBlock } from "./types";

/**
 * Escape reserved characters for emission into a `.it` line: `\` → `\\` and
 * `|` → `\|`. The parser unescapes these anywhere in content/property values,
 * so serialization round-trips literal pipes instead of corrupting them into
 * property delimiters (found by escape round-trip testing).
 */
function escapeIntentText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * Canonical property order for specific block types.
 * Properties not in the list are appended alphabetically.
 */
const PROPERTY_ORDER: Record<string, string[]> = {
  step: ["tool", "input", "output", "depends", "id", "status", "timeout"],
  task: ["owner", "due", "priority", "status"],
  done: ["owner", "time"],
  decision: ["if", "then", "else"],
  trigger: ["event", "condition"],
  loop: ["over", "do", "max"],
  wait: ["timeout", "fallback"],
  parallel: ["steps", "join"],
  retry: ["max", "delay", "backoff"],
  gate: ["approver", "timeout"],
  call: ["to", "input", "output"],
  handoff: ["from", "to"],
  signal: ["event", "data"],
  policy: [
    "if",
    "always",
    "never",
    "action",
    "requires",
    "notify",
    "priority",
    "scope",
    "after",
    "id",
  ],
  image: ["src", "at", "caption", "width", "height"],
  link: ["to"],
  ref: ["to"],
  embed: ["to"],
  quote: ["by"],
  font: ["size", "family", "weight", "color"],
  page: ["size", "margin", "orientation"],
  // v2.8 trust keywords
  sign: ["role", "at", "hash"],
  approve: ["by", "role", "at", "ref"],
  freeze: ["at", "hash", "status"],
  track: ["version", "by"],
  // v2.8.1 metadata keyword — empty = preserve insertion order
  meta: [],
  // v2.9 print layout keywords
  header: ["left", "center", "right", "skip-first"],
  footer: ["left", "center", "right", "skip-first"],
  watermark: ["color", "angle", "size"],
};

/** Properties that are internal / default-valued and should be skipped. */
const SKIP_INTERNAL = new Set(["id", "x-type", "x-ns"]);

/** Header block types that should be emitted first. */
const HEADER_TYPES = new Set([
  "agent",
  "context",
  "font",
  "page",
  "meta",
  "header",
  "footer",
  "watermark",
]);

/**
 * Convert a parsed IntentDocument back to .it source text.
 * Pure function — does not mutate the input.
 *
 * Round-trip guarantee: parseIntentText(documentToSource(doc)) produces
 * blocks with identical types, content, and properties (IDs may differ).
 */
export function documentToSource(doc: IntentDocument): string {
  if (!doc || !Array.isArray(doc.blocks)) return "";

  // Lossless mode: the document carries the verbatim source trivia captured by
  // parseIntentText (`_lead` on blocks, `_liftedLines`, `_trailing`). Reproduce
  // the exact line/blank-line layout so the canonical text round-trips and the
  // bytes computeDocumentHash sees are unchanged (sealed documents keep their
  // hash). Re-parsing the output reproduces the same trivia, so this is also
  // idempotent.
  const hasTrivia =
    (doc._liftedLines && doc._liftedLines.length > 0) ||
    doc._trailing != null ||
    blocksHaveLead(doc.blocks);

  if (hasTrivia) {
    return serializeLossless(doc);
  }

  // Legacy / synthetic mode: documents built without the trivia fields (e.g. by
  // the visual editor, or hand-constructed JSON). Emit a deterministic canonical
  // form: header blocks first, then content, with a blank line separating
  // consecutive prose blocks so two distinct `text:` blocks never re-merge.
  const lines: string[] = [];

  const headerBlocks: IntentBlock[] = [];
  const contentBlocks: IntentBlock[] = [];

  for (const block of doc.blocks) {
    if (HEADER_TYPES.has(block.type)) {
      headerBlocks.push(block);
    } else {
      contentBlocks.push(block);
    }
  }

  // Emit header blocks first, in canonical order
  const headerOrder = [
    "agent",
    "context",
    "font",
    "page",
    "header",
    "footer",
    "watermark",
    "meta",
  ];
  for (const hType of headerOrder) {
    for (const block of headerBlocks) {
      if (block.type === hType) {
        lines.push(serializeBlock(block));
      }
    }
  }

  // Reconstruct `meta:` lifted into metadata when no meta block is present —
  // otherwise meta-only documents would silently drop their metadata.
  if (
    !headerBlocks.some((b) => b.type === "meta") &&
    doc.metadata?.meta &&
    Object.keys(doc.metadata.meta).length > 0
  ) {
    const metaProps = Object.entries(doc.metadata.meta)
      .map(([k, v]) => `${k}: ${escapeIntentText(String(v))}`)
      .join(" | ");
    lines.push(`meta: | ${metaProps}`);
  }

  // Blank line after headers if any were emitted
  if (lines.length > 0 && contentBlocks.length > 0) {
    lines.push("");
  }

  // Emit content blocks, inserting a blank line between consecutive prose
  // (text/body-text) blocks so they re-parse as distinct blocks instead of
  // merging.
  let prevWasProse = false;
  for (const block of contentBlocks) {
    const isProse = block.type === "text" || block.type === "body-text";
    if (prevWasProse && isProse) lines.push("");
    emitBlock(block, lines);
    prevWasProse = isProse;
  }

  return lines.join("\n");
}

/** True if any block in the tree carries captured trivia or merge parts. */
function blocksHaveLead(blocks: IntentBlock[]): boolean {
  for (const b of blocks) {
    if (b._lead != null || (b._merged && b._merged.length > 0)) return true;
    if (b.children && b.children.length > 0 && blocksHaveLead(b.children))
      return true;
  }
  return false;
}

/**
 * Lossless serialization: walk top-level blocks in source order, emitting each
 * block's captured leading trivia, then the block (and its children), then any
 * lifted-metadata lines (meta:/track:) anchored after that block. Finally emit
 * the trailing trivia. Reproduces the exact canonical source bytes.
 */
function serializeLossless(doc: IntentDocument): string {
  const lines: string[] = [];
  const lifted = doc._liftedLines ?? [];

  const emitLifted = (afterIndex: number) => {
    for (const l of lifted) {
      if (l.afterBlockIndex === afterIndex) {
        // `lead === ""` means exactly one blank line — push it (it's not null).
        if (l.lead != null) lines.push(l.lead);
        lines.push(l.text);
      }
    }
  };

  // Lifted lines that precede every block (afterBlockIndex === -1).
  emitLifted(-1);

  for (let i = 0; i < doc.blocks.length; i++) {
    emitBlock(doc.blocks[i], lines);
    emitLifted(i);
  }

  if (doc._trailing != null) lines.push(doc._trailing);

  return lines.join("\n");
}

/**
 * Emit a block and, for container blocks, its children as following lines.
 * Prepends the block's captured leading trivia (`_lead`) verbatim.
 *
 * `list-item` / `step-item` are bullets: their single child carries the real
 * block (e.g. a `task`), and serializeBlock renders it inline (`- task: ...`),
 * so they must NOT re-emit their child as a separate line. Container blocks
 * (sections, etc.) emit children as following lines, recursively.
 */
function emitBlock(block: IntentBlock, lines: string[]): void {
  // `_lead === ""` means exactly one blank line — push it (it's not null).
  if (block._lead != null) lines.push(block._lead);
  // Re-split a merged prose paragraph back into its original per-line blocks so
  // the canonical text (and hashed bytes) round-trip exactly.
  if (block._merged && block._merged.length > 0) {
    for (const part of block._merged) lines.push(serializeBlock(part));
    return;
  }
  lines.push(serializeBlock(block));
  if (
    block.children &&
    block.children.length > 0 &&
    block.type !== "list-item" &&
    block.type !== "step-item"
  ) {
    for (const child of block.children) {
      emitBlock(child, lines);
    }
  }
}

/**
 * Serialize a single block to its canonical `.it` line(s) — the same logic
 * `documentToSource` uses per block. Exposed so other surfaces (e.g. the visual
 * editor) can reuse the canonical serializer instead of reimplementing it and
 * drifting from the grammar. Does NOT emit a block's section-children as
 * following lines (that's `documentToSource`'s job); list/step bullets still
 * render their inline child.
 */
export function blockToSource(block: IntentBlock): string {
  return serializeBlock(block);
}

/**
 * True if a prose line can be emitted WITHOUT the `text:` keyword and still
 * re-parse as the same bare text block. Refuses content that the parser would
 * otherwise read as a different construct: a keyword/custom block (`word:`), a
 * list/step bullet (`- ` / `1. `), a code fence, divider, comment, or table /
 * pipe-property row. Empty content also stays explicit (a bare blank line is a
 * paragraph break, not an empty paragraph).
 */
function canEmitBare(content: string): boolean {
  const t = content.trimStart();
  if (t === "") return false;
  if (/^[\p{L}_][\p{L}\p{N}_-]*:(\s|$)/u.test(t)) return false; // word: … (keyword/custom)
  if (/^-\s/.test(t)) return false; // - bullet
  if (/^\d+\.\s/.test(t)) return false; // 1. ordered
  if (/^```/.test(t)) return false; // code fence
  if (/^---\s*$/.test(t)) return false; // divider
  if (/^\/\//.test(t)) return false; // comment line
  if (/^\|/.test(t)) return false; // table / pipe-property row
  return true;
}

function serializeBlock(block: IntentBlock): string {
  const type = block.type;

  // Special case: divider
  if (type === "divider") {
    const props = serializeProperties(block);
    return props ? `divider: ${props}` : "---";
  }

  // Special case: break
  if (type === "break") {
    const props = serializeProperties(block);
    return props ? `break: | ${props}` : "break:";
  }

  // Special case: toc — keyword + properties only
  if (type === "toc") {
    const props = serializeProperties(block);
    return props ? `toc: ${props}` : "toc:";
  }

  // Special case: code block
  if (type === "code") {
    const lang = block.properties?.lang ? String(block.properties.lang) : "";
    return "```" + lang + "\n" + block.content + "\n```";
  }

  // Custom (user-defined) keyword passthrough — emit with the original keyword,
  // not the internal "custom" type. The keyword is stored in properties.keyword.
  // Use `content` (the value), NOT `originalContent` — the latter still includes
  // the `keyword:` prefix, which we add back here (would otherwise duplicate it).
  if (type === "custom") {
    const keyword = block.properties?.keyword
      ? String(block.properties.keyword)
      : "";
    const content = escapeIntentText(block.content ?? "");
    const propStr = serializeProperties(block, ["keyword"]);
    const head = keyword ? `${keyword}: ${content}` : content;
    return propStr ? `${head} | ${propStr}` : head;
  }

  // List bullet `- ...`. The single child carries the real block (task/text/…),
  // rendered inline so `- task: Buy groceries` round-trips.
  if (type === "list-item") {
    const child = block.children?.[0];
    return `- ${child ? serializeBulletInner(child) : block.originalContent ?? block.content ?? ""}`;
  }

  // Numbered list bullet `1. ...`. (The ordinal is not preserved by the parser;
  // a constant `1.` still reparses as a step-item.)
  if (type === "step-item") {
    const child = block.children?.[0];
    return `1. ${child ? serializeBulletInner(child) : block.originalContent ?? block.content ?? ""}`;
  }

  // Special case: table — reconstruct pipe table
  if (type === "table" && block.table) {
    return serializeTable(block);
  }

  // Get content text — prefer originalContent to preserve inline formatting
  const content = block.originalContent ?? block.content ?? "";

  // Emit the keyword AS WRITTEN when the line used an alias (incl. localized/
  // Arabic aliases) — round-trips stay byte-stable and never silently rewrite an
  // Arabic document into English keywords (which would also break sealed docs).
  const kw = block.keywordAlias ?? type;

  // Callout aliases (warning:/tip:/…) parse to info + an injected `type` prop;
  // when re-emitting the alias itself that injected prop must not duplicate.
  const exclude =
    block.keywordAlias &&
    type === "info" &&
    block.properties?.type != null &&
    block.keywordAlias.toLowerCase() === String(block.properties.type)
      ? ["type"]
      : [];

  // Build the line. When content is empty but properties exist, use the canonical
  // `kw: | props` form (e.g. `font: | family: Inter`) — not `kw:  | props`.
  const escContent = escapeIntentText(content);
  const propStr = serializeProperties(block, exclude);

  // Bare prose: a text block authored without the `text:` keyword re-emits bare
  // (just the content) so natural hand-written documents round-trip exactly —
  // but ONLY when the line can't be mistaken for another construct on re-parse,
  // and only when it carries no properties (bare prose has no pipe-metadata).
  if (
    (type === "text" || type === "body-text") &&
    block._bare &&
    !propStr &&
    canEmitBare(escContent)
  ) {
    return escContent;
  }

  if (propStr) {
    return escContent
      ? `${kw}: ${escContent} | ${propStr}`
      : `${kw}: | ${propStr}`;
  }
  return escContent ? `${kw}: ${escContent}` : `${kw}:`;
}

/**
 * Render the inside of a list bullet — either `keyword: content | props`
 * (for a typed child like `task`) or plain `content` (for a `text` child).
 */
function serializeBulletInner(child: IntentBlock): string {
  if (child.type === "text") {
    const content = child.originalContent ?? child.content ?? "";
    const propStr = serializeProperties(child);
    return propStr ? `${content} | ${propStr}` : content;
  }
  return serializeBlock(child);
}

function serializeProperties(block: IntentBlock, exclude: string[] = []): string {
  const props = block.properties;
  if (!props) return "";

  const excludeSet = new Set(exclude);
  const keys = Object.keys(props).filter((k) => {
    if (SKIP_INTERNAL.has(k)) return false;
    if (excludeSet.has(k)) return false;
    // Skip status if it's the default "pending"
    if (k === "status" && props[k] === "pending") return false;
    return true;
  });

  if (keys.length === 0) return "";

  // Sort by canonical order for this block type, then alphabetically
  const order = PROPERTY_ORDER[block.type];
  if (order) {
    const orderMap = new Map(order.map((k, i) => [k, i]));
    keys.sort((a, b) => {
      const ia = orderMap.get(a) ?? 999;
      const ib = orderMap.get(b) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
  } else {
    keys.sort();
  }

  return keys
    .map((k) => {
      // An empty value (a template/optional fill-in slot) serialises as a clean
      // `key:` — no trailing space — so it round-trips byte-for-byte.
      const v = escapeIntentText(String(props[k]));
      return v === "" ? `${k}:` : `${k}: ${v}`;
    })
    .join(" | ");
}

function serializeTable(block: IntentBlock): string {
  const lines: string[] = [];
  const table = block.table!;
  // Emit the keywords as written (e.g. Arabic أعمدة/صف) so round-trips are
  // byte-stable; defaults match the historical output.
  const hk = table.headersKeyword ?? "headers";
  const rk = table.rowKeyword ?? "row";

  if (table.headers && table.headers.length > 0) {
    lines.push(`${hk}: ${table.headers.join(" | ")}`);
  }

  for (const row of table.rows) {
    lines.push(`${rk}: ${row.join(" | ")}`);
  }

  return lines.join("\n");
}
