/**
 * Shared OOXML (Office Open XML) helpers for the XLSX/DOCX converters.
 *
 * XLSX and DOCX are both ZIP archives of XML parts. We unzip with fflate
 * and parse the XML with small, namespace-tolerant regex/string helpers that
 * are robust to the tight, well-known shapes OOXML emits (we are NOT a general
 * XML parser — we only read the specific elements we care about).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fflate = require("fflate");

export type ZipParts = Record<string, Uint8Array>;

/** Unzip an OOXML file into a map of part name → bytes. */
export function unzip(data: Uint8Array | Buffer): ZipParts {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return fflate.unzipSync(bytes) as ZipParts;
}

/** Zip a map of part name → string/bytes into an OOXML file. */
export function zip(parts: Record<string, string | Uint8Array>): Uint8Array {
  const enc: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(parts)) {
    enc[name] =
      typeof content === "string" ? fflate.strToU8(content) : content;
  }
  return fflate.zipSync(enc) as Uint8Array;
}

/** Decode a zip part to a UTF-8 string (empty string if missing). */
export function partText(parts: ZipParts, name: string): string {
  const part = parts[name];
  if (!part) return "";
  return fflate.strFromU8(part);
}

/**
 * Decode the standard XML entities found in OOXML text runs.
 * (OOXML only emits these five plus numeric references.)
 */
export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&"); // last, so &amp;lt; -> &lt;
}

/** Escape a string for safe inclusion in XML text/attribute content. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Strip an OOXML namespace prefix from a local element name for matching,
 * e.g. "w:p" → "p", "a:t" → "t". Returns a RegExp source fragment that
 * matches either the prefixed or unprefixed form.
 */
export function nsTag(local: string): string {
  // matches `local` or `prefix:local`
  return `(?:[A-Za-z0-9]+:)?${local}`;
}

/**
 * Find all top-level matches of an element (open...close) at the given
 * position, returning the inner XML of each match in document order.
 * Handles nesting of the SAME tag correctly (depth counting) and
 * self-closing tags (empty inner). Namespace-tolerant.
 */
export function findElements(
  xml: string,
  local: string,
): { inner: string; open: string; start: number; end: number }[] {
  const results: { inner: string; open: string; start: number; end: number }[] =
    [];
  const tag = nsTag(local);
  // Match an opening tag (capturing whether it self-closes) or a closing tag.
  // A `(?=[\\s/>])` lookahead after the tag name prevents `<w:p>` from also
  // matching siblings like `<w:pStyle>` / `<w:pPr>`.
  const re = new RegExp(
    `<(${tag})(?=[\\s/>])((?:[^>"']|"[^"]*"|'[^']*')*?)(/?)>|</(${tag})\\s*>`,
    "g",
  );
  let m: RegExpExecArray | null;
  let depth = 0;
  let openStart = -1;
  let openTag = "";
  let contentStart = -1;
  while ((m = re.exec(xml)) !== null) {
    const isClose = m[4] !== undefined;
    if (!isClose) {
      const selfClose = m[3] === "/";
      if (selfClose) {
        if (depth === 0) {
          results.push({
            inner: "",
            open: m[0],
            start: m.index,
            end: re.lastIndex,
          });
        }
        continue;
      }
      if (depth === 0) {
        openStart = m.index;
        openTag = m[0];
        contentStart = re.lastIndex;
      }
      depth++;
    } else {
      depth--;
      if (depth === 0 && openStart !== -1) {
        results.push({
          inner: xml.slice(contentStart, m.index),
          open: openTag,
          start: openStart,
          end: re.lastIndex,
        });
        openStart = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return results;
}

/** Read an attribute value from an opening-tag string (namespace-tolerant). */
export function attr(openTag: string, name: string): string | null {
  // match name or prefix:name
  const re = new RegExp(
    `(?:[A-Za-z0-9]+:)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*"([^"]*)"`,
  );
  const m = openTag.match(re);
  return m ? decodeXmlEntities(m[1]) : null;
}
