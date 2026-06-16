/**
 * attachments.ts — `.it` as a CONTAINER (Forms V2).
 *
 * A business PDF often bundles things: a scanned ID, a receipt photo, a prior
 * contract. `.it` is born-digital text, so to replace PDF-as-envelope it must be
 * able to CARRY files. This module adds that: an `attach:` block embeds (or
 * references) a file, linked by `key` to an `type: attachment` form field.
 *
 *   attach: <key> | name: <file> | mime: <type> | size: <bytes> | sha256: <hex> | data: <base64>
 *   attach: <key> | name: <file> | mime: <type> | href: <url>          (external, not embedded)
 *
 * Because the `attach:` block is part of the source, a sealed document's hash
 * covers its attachments — embedding a file makes it tamper-evident along with the
 * rest of the record. Base64 carries no `|`/newline, so it is safe in a pipe prop.
 *
 * PREFER `href:` (a reference). `.it`'s DNA is lean, queryable, diffable text; a
 * large base64 blob is opaque and bloats the file, so reference mode is the default
 * story and embedding is the escape hatch for the rare "must be self-contained AND
 * sealed" case. addAttachment caps embedded size (MAX_EMBED_BYTES) to keep that
 * accidental bloat from creeping in — raise it deliberately per call if you must.
 *
 * String-based (no parser dependency), so the trust gate, the fill UI and tooling
 * can all use it cheaply. Pairs with forms.ts: an attachment field is "filled" when
 * its `value:` (the filename) is set; the bytes live in the linked `attach:` block.
 */

export interface Attachment {
  /** Links to the form field (`input: … | key: <key> | type: attachment`). */
  key: string;
  /** Original filename. */
  name: string;
  /** Content type (e.g. "application/pdf", "image/png"). */
  mime: string;
  /** Size in bytes (0 if unknown). */
  size: number;
  /** sha256 hex of the bytes, when provided (integrity). */
  sha256?: string;
  /** Base64 of the file bytes — embedded (the container case). */
  data?: string;
  /** External URL — referenced, not embedded. */
  href?: string;
}

const ATTACH_LINE = /^\s*attach:\s*(.*)$/i;

/** Split a `key: value | key: value` tail into a lowercased-key map. */
function parsePipeProps(rest: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seg of rest.split("|")) {
    const c = seg.indexOf(":");
    if (c > 0) {
      const k = seg.slice(0, c).trim().toLowerCase();
      if (k) out[k] = seg.slice(c + 1).trim();
    }
  }
  return out;
}

function parseAttachLine(line: string): Attachment | null {
  const m = ATTACH_LINE.exec(line);
  if (!m) return null;
  const rest = m[1];
  const firstPipe = rest.indexOf("|");
  const key = (firstPipe >= 0 ? rest.slice(0, firstPipe) : rest).trim();
  if (!key) return null;
  const p = firstPipe >= 0 ? parsePipeProps(rest.slice(firstPipe + 1)) : {};
  const size = Number.parseInt(p.size ?? "", 10);
  return {
    key,
    name: p.name ?? key,
    mime: p.mime ?? "application/octet-stream",
    size: Number.isFinite(size) ? size : 0,
    ...(p.sha256 ? { sha256: p.sha256 } : {}),
    ...(p.data ? { data: p.data } : {}),
    ...(p.href ? { href: p.href } : {}),
  };
}

/** Every `attach:` block in the document, in order. */
export function extractAttachments(source: string): Attachment[] {
  const out: Attachment[] = [];
  if (!source) return out;
  for (const line of source.split(/\r?\n/)) {
    const a = parseAttachLine(line);
    if (a) out.push(a);
  }
  return out;
}

/** The attachment with this key, or null. */
export function getAttachment(source: string, key: string): Attachment | null {
  return extractAttachments(source).find((a) => a.key === key) ?? null;
}

/** True when an attachment with this key exists (and carries data or an href). */
export function hasAttachment(source: string, key: string): boolean {
  const a = getAttachment(source, key);
  return !!a && (!!a.data || !!a.href);
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Default cap on an EMBEDDED attachment's decoded size (1 MiB). Above this, prefer
 * `href:` (a reference) — `.it` should stay lean and diffable. Override per call via
 * addAttachment's `maxEmbedBytes` when a larger self-contained embed is intended.
 */
export const MAX_EMBED_BYTES = 1024 * 1024;

/** Decoded byte length of a base64 string (without allocating the bytes). */
function base64Bytes(b64: string): number {
  const s = b64.replace(/\s+/g, "");
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((s.length * 3) / 4) - pad);
}

/** Serialize an Attachment to its single-line `attach:` block. */
function attachToLine(a: Attachment): string {
  const parts = [
    `attach: ${a.key}`,
    `name: ${sanitize(a.name)}`,
    `mime: ${sanitize(a.mime)}`,
  ];
  if (a.size) parts.push(`size: ${a.size}`);
  if (a.sha256) parts.push(`sha256: ${sanitize(a.sha256)}`);
  if (a.href) parts.push(`href: ${sanitize(a.href)}`);
  if (a.data) parts.push(`data: ${a.data.replace(/\s+/g, "")}`);
  return parts.join(" | ");
}

// Property values are pipe-delimited, so a value can't contain a raw `|` or newline.
function sanitize(v: string): string {
  return v.replace(/[\r\n]+/g, " ").replace(/\|/g, "/").trim();
}

/**
 * Add (or replace, by key) an attachment block. Embedded attachments must carry
 * valid base64 in `data`. Returns the new source; the block is appended (or the
 * existing block with the same key is replaced in place).
 */
export function addAttachment(
  source: string,
  att: Attachment,
  opts?: { maxEmbedBytes?: number },
): string {
  if (att.data && !BASE64.test(att.data.replace(/\s+/g, ""))) {
    throw new Error(`Attachment "${att.key}" data is not valid base64.`);
  }
  if (!att.data && !att.href) {
    throw new Error(`Attachment "${att.key}" needs either data (embedded) or href (referenced).`);
  }
  if (att.data) {
    const cap = opts?.maxEmbedBytes ?? MAX_EMBED_BYTES;
    const bytes = base64Bytes(att.data);
    if (bytes > cap) {
      throw new Error(
        `Attachment "${att.key}" is ${Math.round(bytes / 1024)} KiB embedded, over the ${Math.round(cap / 1024)} KiB cap. ` +
          `Prefer href: (a reference) for large files, or pass a larger maxEmbedBytes deliberately.`,
      );
    }
  }
  const line = attachToLine(att);
  const lines = (source ?? "").split(/\r?\n/);
  const idx = lines.findIndex((l) => {
    const a = parseAttachLine(l);
    return a && a.key === att.key;
  });
  if (idx >= 0) {
    lines[idx] = line;
    return lines.join("\n");
  }
  const base = source ?? "";
  return base === "" ? line : `${base.replace(/\n*$/, "")}\n${line}`;
}

/** Remove the attachment block with this key. Returns the new source. */
export function removeAttachment(source: string, key: string): string {
  return (source ?? "")
    .split(/\r?\n/)
    .filter((l) => {
      const a = parseAttachLine(l);
      return !(a && a.key === key);
    })
    .join("\n");
}

/** A `data:<mime>;base64,<data>` URI for download/preview, or null if not embedded. */
export function attachmentDataUri(att: Attachment): string | null {
  if (!att.data) return null;
  return `data:${att.mime};base64,${att.data.replace(/\s+/g, "")}`;
}
