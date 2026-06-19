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
import {
  computeDocumentHash,
  isSealed,
  verifyDocument,
  signatureMatchesContent,
} from "./trust";
import { isTemplate } from "./template";
import { parseIntentText } from "./parser";

export type TrustTier =
  | "draft"
  | "signed"
  | "sealed"
  | "certified"
  | "root-certified"
  | "template"
  | "broken";

export interface TierStyle {
  /** Primary ink — rings, monogram, arc text. */
  color: string;
  /** Lighter accent — the hash-derived radial crown. */
  accent: string;
}

/**
 * gray → blue → green → gold for the four trust tiers; slate for `template`,
 * which is OUTSIDE the trust workflow (a blueprint, not a record); RED for `broken`
 * — a sealed/signed document whose content no longer matches its hash (tampered).
 */
export const TIER_STYLES: Record<TrustTier, TierStyle> = {
  draft: { color: "#6b7280", accent: "#9ca3af" },
  signed: { color: "#2f6fed", accent: "#2f6fed" },
  sealed: { color: "#4f46e5", accent: "#4f46e5" },
  certified: { color: "#0e9f6e", accent: "#0e9f6e" },
  "root-certified": { color: "#c58a1a", accent: "#c58a1a" },
  template: { color: "#94a3b8", accent: "#94a3b8" },
  broken: { color: "#d93025", accent: "#d93025" },
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
  /**
   * Whether the certification CLAIM (a `certify:` line) was cryptographically
   * VERIFIED by the caller (via @dotit/sign) — only then does the tier become
   * certified/root-certified. False when a certify: line is merely PRESENT: presence
   * alone is a claim, never a verdict (anyone can paste a `certify:` line). G-03.
   */
  certificationVerified: boolean;
}

/**
 * Determine the trust tier a document CLAIMS, from the trust lines present.
 *
 * Integrity tiers are locally honest: `sealed`/`signed` reflect the presence of a
 * seal/signature, and renderTrustBand re-checks the seal/signature hash before it
 * paints (a tampered doc shows BROKEN). But AUTHORITY — a `certify:` line — cannot be
 * verified from the bytes alone (it needs the issuer's public key), so presence of a
 * certify: line does NOT, by itself, grant the certified/root-certified tier. The
 * caller must verify the certification with @dotit/sign and pass
 * `opts.certificationVerified` (`true`, or `"root"` for a root-chained certification);
 * otherwise the document falls through to its locally-verifiable tier (sealed/signed/
 * draft). This closes the forgery where a pasted `certify:` line painted a gold
 * "CERTIFIED" seal with no key check (G-03). The `certified`/`rootCertified` booleans
 * still report the CLAIM so a verifying caller can decide what to check.
 */
export function detectTrustState(
  source: string,
  opts?: { certificationVerified?: boolean | "root" },
): TrustState {
  // A template is outside the trust workflow — never a trust tier.
  if (isTemplate(source)) {
    return {
      tier: "template",
      label: "TEMPLATE",
      sealed: false,
      signed: false,
      certified: false,
      rootCertified: false,
      certificationVerified: false,
      template: true,
    };
  }
  const lines = source.split("\n").map((l) => l.trimStart());
  const certifyLines = lines.filter((l) => l.startsWith("certify:"));
  const certified = certifyLines.length > 0; // the CLAIM (presence)
  const rootCertified = certifyLines.some((l) => /\bica:\s*\S/.test(l));
  const signed = lines.some(
    (l) =>
      l.startsWith("sign:") && /key:\s*ed25519:/.test(l) && /\bsig:\s*\S/.test(l),
  );
  const sealed = isSealed(source);

  // Authority is granted ONLY when the caller verified it (crypto), never by presence.
  const certVerified = opts?.certificationVerified;
  const showRoot = rootCertified && certVerified === "root";
  const showCertified =
    certified && (certVerified === true || certVerified === "root");

  let tier: TrustTier;
  let label: string;
  if (showRoot) {
    tier = "root-certified";
    label = "CERTIFIED";
  } else if (showCertified) {
    tier = "certified";
    label = "CERTIFIED";
  } else if (sealed) {
    // A seal (the integrity LOCK) is its own indigo tier — visually distinct from a
    // bare signature. Ranked above `signed` because a sealed doc is usually also
    // signed, and the lock is the stronger statement.
    tier = "sealed";
    label = "SEALED";
  } else if (signed) {
    tier = "signed";
    label = "SIGNED";
  } else {
    tier = "draft";
    label = "DRAFT";
  }
  return {
    tier,
    label,
    sealed,
    signed,
    certified,
    rootCertified,
    certificationVerified: !!showCertified,
    template: false,
  };
}

// ─── Geometry helpers (deterministic, integer-friendly SVG) ──────────────────

function hashBytes(hash: string): number[] {
  const hex = (hash.replace(/^sha256:/i, "").match(/[0-9a-fA-F]/g) || []).join("");
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out.length ? out : [0];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

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
  const b = (i: number) =>
    bytes[((i % bytes.length) + bytes.length) % bytes.length];
  const cleanHex = opts.hash
    .replace(/^sha256:/i, "")
    .replace(/[^0-9a-fA-F]/g, "");
  const shortHash = (cleanHex.slice(0, 8) || "00000000").toUpperCase();

  // A flat, rounded-square card (the reference aesthetic) — subtle, not a stamp.
  const dashed = tier === "template";
  const card =
    `<rect x="2.5" y="2.5" width="95" height="95" rx="14" fill="#ffffff" ` +
    `stroke="${color}" stroke-width="1"${dashed ? ' stroke-dasharray="2 3"' : ""} opacity="0.85"/>`;
  // Faint ".it" mark, bottom-right corner.
  const mark = `<g opacity="0.5">${itMark(84, 87, 9, color)}</g>`;
  // Tiny hash caption (the fingerprint, in words), bottom-left.
  const cap = showText
    ? `<text x="9.5" y="90.5" font-family="ui-monospace,Menlo,monospace" font-size="5" letter-spacing="0.6" fill="${color}" opacity="0.55">${shortHash}</text>`
    : "";

  // Template — a blueprint has no meaningful content hash, so no generative
  // pattern: just the empty dashed card + the faint mark.
  if (tier === "template") {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)} — not part of the trust workflow">` +
      card +
      mark +
      `</svg>`
    );
  }

  // Hash-based LINEAR WAVE field: flowing horizontal lines whose amplitude,
  // frequency and phase are read straight from the SHA-256 — same document →
  // byte-identical seal, any change → a visibly different wave. Flat + subtle +
  // unique (no crown, no kitsch).
  const LINES = 9;
  const x0 = 13;
  const x1 = 87;
  const yTop = 23;
  const yBot = 73;
  let waves = "";
  for (let li = 0; li < LINES; li++) {
    const baseY = yTop + (li / (LINES - 1)) * (yBot - yTop);
    const amp = 2 + (b(li * 3) % 55) / 11; // ~2..7
    const freq = 1.4 + (b(li * 3 + 1) % 100) / 40; // wave count across the width
    const phase = (b(li * 3 + 2) / 255) * Math.PI * 2;
    const op = (0.3 + (b(li * 3 + 1) % 45) / 100).toFixed(2); // 0.30..0.74
    const pts: string[] = [];
    for (let x = x0; x <= x1; x += 2) {
      const t = ((x - x0) / (x1 - x0)) * Math.PI * 2 * freq + phase;
      pts.push(`${r2(x)},${r2(baseY + amp * Math.sin(t))}`);
    }
    waves += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="0.9" stroke-linecap="round" opacity="${op}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)} trust seal ${shortHash}">` +
    card +
    waves +
    mark +
    cap +
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
  opts?: {
    size?: number;
    text?: boolean;
    tier?: TrustTier;
    /** Pass the result of a crypto certification check (@dotit/sign) so a verified
     *  certify: line can show the certified/root-certified tier; omitted ⇒ a present
     *  certify: line is treated as an unverified CLAIM (never gold by presence). */
    certificationVerified?: boolean | "root";
  },
): DocumentSeal {
  const state = detectTrustState(source, {
    certificationVerified: opts?.certificationVerified,
  });
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

const BAND_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function bandDate(s?: string): string {
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${BAND_MONTHS[Number(m[2]) - 1]} ${m[1]}` : s;
}

/**
 * The unified TRUST BAND — one quiet certification area combining the hash seal,
 * who signed, and the freeze: "◈  Signed Emad (CEO) · Sealed 17 Jun 2026 · e6b7c5…".
 * Returns "" for an unsigned draft. The caller positions/styles `.it-trust-band`
 * (the print path pins it `fixed` in the bottom margin so it repeats on every page
 * and never takes content space; the screen page-view places one per sheet).
 */
export function renderTrustBand(source: string): string {
  const doc = parseIntentText(source);
  const sigs = doc.metadata?.signatures ?? [];
  const freeze = doc.metadata?.freeze;
  if (sigs.length === 0 && !freeze) return "";

  // INTEGRITY GATE — the band MUST reflect reality on every surface (print, PDF,
  // screen). A sealed/signed document whose content no longer matches its hash is
  // TAMPERED: we render a loud RED "BROKEN" stamp, never the clean certification
  // (printing a valid-looking seal on a modified document would be a forgery).
  const broken = isTrustBroken(source, sigs, freeze);

  if (broken) {
    const { svg } = sealForDocument(source, {
      size: 96,
      text: false,
      tier: "broken",
    });
    const what = freeze ? "SEAL BROKEN" : "SIGNATURE BROKEN";
    const cap = [what, "Modified after sealing", "Not the certified document"]
      .map(
        (p, i) =>
          `<span class="it-trust-band__line${i === 0 ? " it-trust-band__line--alert" : ""}">${esc(p)}</span>`,
      )
      .join("");
    return (
      `<div class="it-trust-band it-trust-band--broken">` +
      `<span class="it-trust-band__seal">${svg}</span>` +
      `<span class="it-trust-band__cap">${cap}</span>` +
      `</div>`
    );
  }

  const state = detectTrustState(source);
  const { svg } = sealForDocument(source, {
    size: 96,
    text: false,
    tier: state.tier,
  });
  const who = sigs
    .map((s) => (s.role ? `${s.signer} (${s.role})` : s.signer))
    .join(", ");
  const parts: string[] = [];
  if (who) parts.push(`Signed ${who}`);
  if (freeze) parts.push(`Sealed${freeze.at ? ` ${bandDate(freeze.at)}` : ""}`);
  const hash = String(freeze?.hash || sigs[0]?.hash || "")
    .replace(/^sha256:/, "")
    .slice(0, 10);
  if (hash) parts.push(hash);
  // Each caption part on its own centered line — the band stacks the stamp above
  // the small gray caption, vertically centered with spacing (TRUST_BAND_CSS).
  const cap = parts
    .map((p) => `<span class="it-trust-band__line">${esc(p)}</span>`)
    .join("");
  return (
    `<div class="it-trust-band">` +
    `<span class="it-trust-band__seal">${svg}</span>` +
    `<span class="it-trust-band__cap">${cap}</span>` +
    `</div>`
  );
}

/**
 * Is the document's trust evidence broken (content changed since sealing/signing)?
 * Sealed docs verify against the freeze (seal scope); signed-but-not-sealed docs
 * verify each signature against the content. Any parse/verify failure is treated as
 * broken — the band errs toward NOT certifying a document it can't vouch for.
 */
function isTrustBroken(
  source: string,
  sigs: Array<{
    hash?: string;
    spec?: number;
    signer?: string;
    role?: string;
    at?: string;
  }>,
  freeze: { hash?: string } | undefined,
): boolean {
  try {
    if (freeze) return verifyDocument(source).intact === false;
    if (sigs.length > 0) {
      return !sigs.every((s) => signatureMatchesContent(source, s));
    }
  } catch {
    return true;
  }
  return false;
}

/**
 * The VISUAL style for the trust band — a quiet, presentation-grade certification
 * stamp (the hash seal + who signed + sealed date). Single source of truth shared
 * by every surface that shows the band (renderHTML, renderPrint, the editor's page
 * view, the WYSIWYG print path) so they never drift. POSITIONING is added per
 * surface via trustBandPositionCss(): fixed for paginated print (repeats per page),
 * absolute for a single scrolling render / one per on-screen sheet.
 */
export const TRUST_BAND_CSS =
  // Vertical stamp: the hash seal on top, the caption stacked below — everything
  // centered, with space between the parts. The seal stays prominent; the caption
  // is small, gray, and faded so it certifies without competing with content.
  `.it-trust-band{display:inline-flex;flex-direction:column;align-items:center;gap:6px;` +
  `padding:8px 12px;pointer-events:none;text-align:center;}` +
  `.it-trust-band__seal{display:inline-flex;width:54px;height:54px;flex:0 0 auto;}` +
  `.it-trust-band__seal svg{width:100%;height:100%;display:block;}` +
  `.it-trust-band__cap{display:flex;flex-direction:column;align-items:center;gap:2px;` +
  `font:7.5pt/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;` +
  `color:#8a8f98;opacity:0.8;letter-spacing:0.02em;}` +
  `.it-trust-band__line{white-space:nowrap;}` +
  // BROKEN: loud red caption so a tampered document can never present as certified.
  `.it-trust-band--broken .it-trust-band__cap{color:#d93025;opacity:1;}` +
  `.it-trust-band__line--alert{font-weight:700;letter-spacing:0.05em;}`;

/**
 * Positioning for the trust band. `mode` is "fixed" (paginated print — pinned in the
 * page's bottom-right so it repeats on every page) or "absolute" (a single scrolling
 * render / one per on-screen sheet). `inset` is the corner offset (CSS length).
 * The band sits in the BOTTOM-RIGHT corner and never takes content flow space.
 */
export function trustBandPositionCss(
  mode: "fixed" | "absolute",
  inset = "8mm",
): string {
  return `.it-trust-band{position:${mode};right:${inset};bottom:${inset};left:auto;top:auto;z-index:5;}`;
}
