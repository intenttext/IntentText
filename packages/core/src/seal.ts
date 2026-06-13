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
  draft: { color: "#6b7280", accent: "#cbd5e1" },
  signed: { color: "#2563eb", accent: "#93c5fd" },
  certified: { color: "#059669", accent: "#6ee7b7" },
  "root-certified": { color: "#a16207", accent: "#fcd34d" },
  template: { color: "#94a3b8", accent: "#cbd5e1" },
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
  const { color, accent } = TIER_STYLES[tier];
  const size = opts.size ?? 100;
  const showText = opts.text !== false;
  const label = opts.label ?? tier.replace(/-/g, " ").toUpperCase();
  const bytes = hashBytes(opts.hash);
  const cleanHex = opts.hash.replace(/^sha256:/i, "").replace(/[^0-9a-fA-F]/g, "");
  const shortHash = (cleanHex.slice(0, 8) || "00000000").toUpperCase();
  const uid = `s${(cleanHex.slice(0, 8) || "0")}-${tier}`;
  const cx = 50;
  const cy = 50;

  // Template — a blueprint, OUTSIDE the trust workflow. No hash crown (the hash of
  // placeholder content is meaningless), a DASHED ring to read as "unsealed", and
  // a TEMPLATE label. Visually unmistakable from a real trust seal.
  if (tier === "template") {
    const tlabel = opts.label ?? "TEMPLATE";
    const tArc = showText
      ? `<defs><path id="${uid}-top" d="${arcPath(cx, cy, 40, 212, 328, 1)}"/></defs>` +
        `<text class="sl-arc" fill="${color}"><textPath href="#${uid}-top" startOffset="50%" text-anchor="middle">${esc(tlabel)}</textPath></text>`
      : "";
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(tlabel)} — not part of the trust workflow">` +
      `<style>.sl-mono{font:700 17px ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.5px;}.sl-arc{font:600 6.2px ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;letter-spacing:1.4px;}</style>` +
      `<circle cx="50" cy="50" r="46.5" fill="none" stroke="${color}" stroke-width="1.4" stroke-dasharray="3 3"/>` +
      `<circle cx="50" cy="50" r="23.5" fill="none" stroke="${color}" stroke-width="0.8" stroke-dasharray="2 2.5"/>` +
      `<text x="50" y="56" text-anchor="middle" class="sl-mono" fill="${color}">.it</text>` +
      tArc +
      `</svg>`
    );
  }

  // Hash-derived radial crown — the visual fingerprint.
  const N = 84;
  const rInner = 27;
  let ticks = "";
  for (let i = 0; i < N; i++) {
    const x = bytes[i % bytes.length];
    const y = bytes[(i * 5 + 7) % bytes.length];
    const amp = (x ^ y) / 255; // 0..1
    const len = 2 + amp * 10; // 2..12
    const deg = (i / N) * 360 - 90; // start at top, sweep clockwise
    const [x1, y1] = polar(cx, cy, rInner, deg);
    const [x2, y2] = polar(cx, cy, rInner + len, deg);
    ticks += `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"/>`;
  }

  const star =
    tier === "root-certified"
      ? `<text x="50" y="30.5" text-anchor="middle" class="sl-star" fill="${color}">★</text>`
      : "";

  const arcText = showText
    ? `<defs>` +
      `<path id="${uid}-top" d="${arcPath(cx, cy, 40, 212, 328, 1)}"/>` +
      `<path id="${uid}-bot" d="${arcPath(cx, cy, 39, 148, 32, 0)}"/>` +
      `</defs>` +
      `<text class="sl-arc" fill="${color}"><textPath href="#${uid}-top" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>` +
      `<text class="sl-arc sl-hash" fill="${color}"><textPath href="#${uid}-bot" startOffset="50%" text-anchor="middle">${shortHash}</textPath></text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)} trust seal ${shortHash}">` +
    `<style>` +
    `.sl-mono{font:700 17px ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.5px;}` +
    `.sl-arc{font:600 6.2px ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;letter-spacing:1.4px;}` +
    `.sl-hash{font-weight:500;letter-spacing:1.1px;}` +
    `.sl-star{font:9px serif;}` +
    `</style>` +
    `<circle cx="50" cy="50" r="46.5" fill="none" stroke="${color}" stroke-width="1.6"/>` +
    `<circle cx="50" cy="50" r="43" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.45"/>` +
    `<g stroke="${accent}" stroke-width="1.1" stroke-linecap="round">${ticks}</g>` +
    `<circle cx="50" cy="50" r="23.5" fill="#fff"/>` +
    `<circle cx="50" cy="50" r="23.5" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<text x="50" y="56" text-anchor="middle" class="sl-mono" fill="${color}">.it</text>` +
    star +
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
