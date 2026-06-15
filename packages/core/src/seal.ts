/**
 * seal.ts — the Hash-Based Ambient Seal: a deterministic generative trust stamp.
 *
 * A SHA-256 hash (`sha256:9f3a…`) is invisible and unmemorable. This turns it into
 * something you can SEE: a notary-style ring whose radial "crown" silhouette is
 * derived deterministically from the document's content hash. The same document
 * always produces the identical seal; any change — one character — produces a
 * completely different crown. So tamper-evidence becomes visual: a reader spots a
 * different seal at a glance, without reading a single hex digit.
 *
 * The seal is tinted by trust TIER, so its colour states the strength of the claim:
 *   gray  draft           — no integrity/identity/authority
 *   blue  signed / sealed  — cryptographically signed (Ed25519) and/or sealed
 *   green certified        — carries a UTS certification (authority)
 *   gold  root-certified   — certification chains to the offline UTS root (ica:)
 *
 * Pure string output (no DOM), deterministic, dependency-free — safe in Node, the
 * browser, the renderer/print path, the editor, the desktop badge, and the verify
 * portal. NOTE: the tier here reflects what the document CLAIMS (which trust lines
 * are present); cryptographic VERIFICATION of those claims is @dotit/sign's job —
 * pass a verified tier in when you have one.
 */
import { computeDocumentHash, isSealed } from "./trust";
import { isTemplate } from "./template";

export type TrustTier =
  | "draft"
  | "signed"
  | "certified"
  | "root-certified"
  | "template";

export interface TierStyle {
  /** Primary ink — rings, monogram, arc text. */
  color: string;
  /** Lighter accent — the hash-derived radial crown. */
  accent: string;
}

/**
 * gray → blue → green → gold for the four trust tiers; slate for `template`,
 * which is OUTSIDE the trust workflow (a blueprint, not a record).
 */
export const TIER_STYLES: Record<TrustTier, TierStyle> = {
  draft: { color: "#6b7280", accent: "#9ca3af" },
  signed: { color: "#2f6fed", accent: "#2f6fed" },
  certified: { color: "#0e9f6e", accent: "#0e9f6e" },
  "root-certified": { color: "#c58a1a", accent: "#c58a1a" },
  template: { color: "#94a3b8", accent: "#94a3b8" },
};

export interface TrustState {
  tier: TrustTier;
  /** Display label (DRAFT / SIGNED / SEALED / CERTIFIED / TEMPLATE). */
  label: string;
  sealed: boolean;
  signed: boolean;
  certified: boolean;
  rootCertified: boolean;
  /** True when this is a template (blueprint) — outside the trust workflow. */
  template: boolean;
}

/**
 * Determine the trust tier a document CLAIMS, from the trust lines present.
 * Presence-based (no crypto) — for a verified tier, verify with @dotit/sign and
 * pass the result into renderSeal directly.
 */
export function detectTrustState(source: string): TrustState {
  // A template is outside the trust workflow — never a trust tier.
  if (isTemplate(source)) {
    return {
      tier: "template",
      label: "TEMPLATE",
      sealed: false,
      signed: false,
      certified: false,
      rootCertified: false,
      template: true,
    };
  }
  const lines = source.split("\n").map((l) => l.trimStart());
  const certifyLines = lines.filter((l) => l.startsWith("certify:"));
  const certified = certifyLines.length > 0;
  const rootCertified = certifyLines.some((l) => /\bica:\s*\S/.test(l));
  const signed = lines.some(
    (l) =>
      l.startsWith("sign:") && /key:\s*ed25519:/.test(l) && /\bsig:\s*\S/.test(l),
  );
  const sealed = isSealed(source);

  let tier: TrustTier;
  let label: string;
  if (rootCertified) {
    tier = "root-certified";
    label = "CERTIFIED";
  } else if (certified) {
    tier = "certified";
    label = "CERTIFIED";
  } else if (signed) {
    tier = "signed";
    label = "SIGNED";
  } else if (sealed) {
    tier = "signed"; // integrity-only shares the blue tier
    label = "SEALED";
  } else {
    tier = "draft";
    label = "DRAFT";
  }
  return { tier, label, sealed, signed, certified, rootCertified, template: false };
}

// ─── Geometry helpers (deterministic, integer-friendly SVG) ──────────────────

function hashBytes(hash: string): number[] {
  const hex = (hash.replace(/^sha256:/i, "").match(/[0-9a-fA-F]/g) || []).join("");
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out.length ? out : [0];
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  sweep: 0 | 1,
): string {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  return `M ${r2(x1)} ${r2(y1)} A ${r} ${r} 0 0 ${sweep} ${r2(x2)} ${r2(y2)}`;
}

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}

// Gelasio ".it" outline (the new logo's serif mark), EM 1000. Bounding box
// x 66..932, y -714..14 → centre (499, -350), height 728. Embedded so core needs
// no font at runtime.
const IT_PATH =
  "M66.9-64.5Q66.9-93.7 88.1-114.5Q109.4-135.3 140.1-135.3Q170.9-135.3 192.4-114.5Q213.9-93.7 213.9-64.5Q213.9-35.2 192.4-12.7Q170.9 9.8 140.1 9.8Q109.4 9.8 88.1-12.7Q66.9-35.2 66.9-64.5M551.3 0L331.5 0Q323.2 0 319.1-7.3Q314.9-14.6 314.9-20Q314.9-36.1 331.1-38.1Q349.1-40.5 368.2-46.6Q387.2-52.7 387.2-68.4L387.7-379.9Q387.7-410.2 375-421.4Q362.3-432.6 345.2-434.8Q328.1-437 314.9-440.4Q310.1-442.9 306.6-446.8Q303.2-450.7 303.2-460Q303.2-465.8 306.2-473.4Q309.1-481 314.9-481.4Q367.7-484.9 410.4-485.8Q453.1-486.8 476.1-486.8Q480-486.8 484.9-482.9Q489.7-479 490.7-467.3L490.7-84.5Q490.7-64 500.7-54.7Q510.7-45.4 524.7-42.5Q538.6-39.6 550.3-38.1Q560.5-37.1 564.2-34.2Q567.9-31.2 567.9-20Q567.9-14.6 563.7-7.3Q559.6 0 551.3 0M437.5-570.8Q408.7-570.8 390.4-591.6Q372.1-612.3 372.1-642.6Q372.1-673.3 390.4-693.8Q408.7-714.4 437.5-714.4Q466.3-714.4 484.6-693.8Q502.9-673.3 502.9-642.6Q502.9-612.3 484.6-591.6Q466.3-570.8 437.5-570.8M798.3 14.6Q754.9 14.6 726.1 2.2Q697.3-10.3 682.9-37.6Q668.5-64.9 668.5-108.9L668.5-440.9L612.8-440.9Q606.9-441.4 604-447Q601.1-452.6 601.1-458.5Q601.1-479 614.3-479.5Q647.5-483.9 668.7-497.6Q689.9-511.2 703.9-540.3Q717.8-569.3 729-619.1Q730.5-626.5 736.3-629.2Q742.2-631.8 752.9-631.8Q764.6-631.8 768.1-628.9Q771.5-626 771.5-619.1L771.5-485.4L908.7-485.4Q914.6-484.9 917.5-479.7Q920.4-474.6 920.4-468.7Q920.4-457.5 916.3-449.2Q912.1-440.9 906.7-440.9L771.5-440.9L771.5-146Q771.5-104.5 779.1-82.8Q786.6-61 798.8-53Q811-44.9 823.7-44.9Q854.5-44.9 874.8-51.5Q895-58.1 913.1-69.8Q918.5-73.2 923.3-66.2Q928.2-59.1 930.9-50.3Q933.6-41.5 930.2-38.6Q919.4-28.8 898.2-16.4Q877-3.9 850.3 5.4Q823.7 14.6 798.3 14.6";

/** Place the Gelasio ".it" mark centred at (cx,cy) with cap-box height `h`. */
function itMark(cx: number, cy: number, h: number, fill: string): string {
  const k = h / 728;
  return `<g transform="translate(${r2(cx - 499 * k)},${r2(cy + 350 * k)}) scale(${k.toFixed(4)})"><path d="${IT_PATH}" fill="${fill}"/></g>`;
}

function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/**
 * The hash-derived GUILLOCHÉ ROSETTE — the engraved, interwoven lacework you see on
 * banknotes, passports and certificates. It is a hypotrochoid (spirograph) curve
 * whose big/rolling radii and pen offset are read from the hash, traced for as many
 * turns as it takes to close, and layered a few times for the woven moiré. The
 * petal count and weave are therefore deterministic in the hash: same document →
 * identical rosette; any change → a visibly different one. Reads as an official
 * security seal, not a random splatter.
 */
function guilloche(
  bytes: number[],
  color: string,
  cx: number,
  cy: number,
  maxR: number,
): string {
  const b = (i: number) => bytes[((i % bytes.length) + bytes.length) % bytes.length];
  const Rb = 24 + (b(0) % 18); // fixed (big) circle
  let Rr = 7 + (b(1) % 9); // rolling circle
  if (Rb % Rr === 0) Rr += 1; // avoid a trivially-early-closing (boring) curve
  const g = gcd(Rb, Rr);
  const turns = Rr / g; // 2π·turns closes the curve
  const Pd = Rr * (0.55 + (b(2) % 45) / 100); // pen offset (petal depth)
  const extent = Rb - Rr + Pd;
  const k = maxR / extent; // scale to fit maxR
  const N = Math.max(260, turns * 100);
  let s = "";
  for (let L = 0; L < 3; L++) {
    const phase = L * (0.5 + (b(3 + L) % 40) / 100);
    const scale = k * (1 - L * 0.12);
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2 * turns + phase;
      const x = (Rb - Rr) * Math.cos(t) + Pd * Math.cos(((Rb - Rr) / Rr) * t);
      const y = (Rb - Rr) * Math.sin(t) - Pd * Math.sin(((Rb - Rr) / Rr) * t);
      pts.push(`${r2(cx + x * scale)},${r2(cy + y * scale)}`);
    }
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="0.45" opacity="${(0.85 - L * 0.16).toFixed(2)}"/>`;
  }
  return s;
}

// ─── The seal ────────────────────────────────────────────────────────────────

export interface SealRenderOptions {
  /** The content hash (with or without `sha256:` prefix). Drives the crown. */
  hash: string;
  /** Trust tier → colour. Default "draft". */
  tier?: TrustTier;
  /** Arc label override (default derived from tier). */
  label?: string;
  /** Pixel width/height. Default 100. */
  size?: number;
  /** Render the arc text (label + short hash). Default true. */
  text?: boolean;
}

/**
 * Render the seal as a standalone SVG string. Deterministic in `hash`: identical
 * hash → byte-identical SVG; any change in hash → a visibly different crown.
 */
export function renderSeal(opts: SealRenderOptions): string {
  const tier = opts.tier ?? "draft";
  const { color } = TIER_STYLES[tier];
  const size = opts.size ?? 100;
  const showText = opts.text !== false;
  const label = opts.label ?? tier.replace(/-/g, " ").toUpperCase();
  const bytes = hashBytes(opts.hash);
  const cleanHex = opts.hash.replace(/^sha256:/i, "").replace(/[^0-9a-fA-F]/g, "");
  const shortHash = (cleanHex.slice(0, 8) || "00000000").toUpperCase();
  const uid = `s${cleanHex.slice(0, 8) || "0"}-${tier}`;
  const cx = 50;
  const cy = 50;
  const style =
    `<style>` +
    `.sl-arc{font:600 6px Georgia,"Times New Roman",serif;letter-spacing:2px;}` +
    `.sl-hash{font:500 5.4px ui-monospace,"SFMono-Regular",Menlo,monospace;letter-spacing:1.5px;}` +
    `.sl-star{font:6px serif;}` +
    `</style>`;

  // Template — OUTSIDE the trust workflow. No bloom (a blueprint has no meaningful
  // hash); a faint dashed ring + TEMPLATE label, clearly not a sealed record.
  if (tier === "template") {
    const tlabel = opts.label ?? "TEMPLATE";
    const tArc = showText
      ? `<defs><path id="${uid}t" d="${arcPath(cx, cy, 37, 212, 328, 1)}"/></defs>` +
        `<text class="sl-arc" fill="${color}"><textPath href="#${uid}t" startOffset="50%" text-anchor="middle">${esc(tlabel)}</textPath></text>`
      : "";
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(tlabel)} — not part of the trust workflow">` +
      style +
      `<circle cx="50" cy="50" r="46" fill="none" stroke="${color}" stroke-width="0.7" stroke-dasharray="1.5 3" opacity="0.7"/>` +
      itMark(cx, cy, 20, color) +
      tArc +
      `</svg>`
    );
  }

  const root = tier === "root-certified";
  // The notary border: a heavier outer ring (heaviest for root) + a hairline inner
  // ring, and a hairline ring just inside the arc text band.
  const rings =
    `<circle cx="50" cy="50" r="46" fill="none" stroke="${color}" stroke-width="${root ? 1.4 : 1.1}"/>` +
    `<circle cx="50" cy="50" r="43" fill="none" stroke="${color}" stroke-width="0.5"/>` +
    `<circle cx="50" cy="50" r="30.5" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.8"/>`;
  // A white disc carries the .it monogram clear of the rosette lacework.
  const disc =
    `<circle cx="50" cy="50" r="13" fill="#ffffff"/>` +
    `<circle cx="50" cy="50" r="13" fill="none" stroke="${color}" stroke-width="0.5"/>`;
  // Root-certified: small stars flank the seal at 3 & 9 o'clock (the gap between the
  // top label arc and the bottom hash arc), signalling the root-chain authority.
  const stars = root
    ? `<text x="8.5" y="52" text-anchor="middle" class="sl-star" fill="${color}">★</text>` +
      `<text x="91.5" y="52" text-anchor="middle" class="sl-star" fill="${color}">★</text>`
    : "";

  const arcText = showText
    ? `<defs>` +
      `<path id="${uid}t" d="${arcPath(cx, cy, 37, 212, 328, 1)}"/>` +
      `<path id="${uid}b" d="${arcPath(cx, cy, 37, 148, 32, 0)}"/>` +
      `</defs>` +
      `<text class="sl-arc" fill="${color}"><textPath href="#${uid}t" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>` +
      `<text class="sl-hash" fill="${color}" opacity="0.85"><textPath href="#${uid}b" startOffset="50%" text-anchor="middle">${shortHash}</textPath></text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)} trust seal ${shortHash}">` +
    style +
    rings +
    guilloche(bytes, color, cx, cy, 28) +
    disc +
    itMark(cx, cy, 15, color) +
    stars +
    arcText +
    `</svg>`
  );
}

/**
 * Read the canonical content hash from a document's trust lines (the `hash:` field
 * of a sign:/freeze:/certify: line, which all reference the same content hash); if
 * none is present (an unsigned draft), compute it. So the seal's crown matches the
 * hash the signatures actually committed to.
 */
export function contentHashOf(source: string): string {
  const m = source.match(
    /^(?:sign|freeze|certify):[^\n]*?\bhash:\s*(sha256:[0-9a-f]+|[0-9a-f]{16,})/im,
  );
  return m ? m[1] : computeDocumentHash(source);
}

export interface DocumentSeal {
  svg: string;
  tier: TrustTier;
  label: string;
  hash: string;
}

/**
 * One-call seal for a document source: detect the claimed tier, read its content
 * hash, render the SVG. For a VERIFIED seal, compute the tier with @dotit/sign and
 * call renderSeal directly with it.
 */
export function sealForDocument(
  source: string,
  opts?: { size?: number; text?: boolean; tier?: TrustTier },
): DocumentSeal {
  const state = detectTrustState(source);
  const tier = opts?.tier ?? state.tier;
  const hash = contentHashOf(source);
  const svg = renderSeal({
    hash,
    tier,
    label: opts?.tier ? undefined : state.label,
    size: opts?.size,
    text: opts?.text,
  });
  return { svg, tier, label: state.label, hash };
}
