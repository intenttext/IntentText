// Document status chrome for the visual editor:
//
//  - TrustBanner: a professional document-status bar derived from the trust
//    blocks (seal/sign/approve/freeze) — "🔒 Sealed — signed by Ahmed (CEO) on
//    2026-06-12 · hash verified ✓" instead of raw chips. Sealed documents are
//    read-only (VisualEditor flips editable off); the banner says so.
//  - DocPropsBar: a tidy, collapsible header strip for document-level metadata
//    (meta: id/version/owner…, page:, font:, header:, footer:, watermark:),
//    which is otherwise invisible in the page.

import { useMemo, useRef, useState } from "react";
import {
  parseIntentText,
  sealForDocument,
  isTemplate,
  signatureMatchesContent,
  SEAL_SPEC,
} from "@dotit/core";

/** The ruleset version a seal was made under (from its freeze: line), or null. */
function sealSpecOf(source: string): number | null {
  const m = source.match(/^\s*freeze:[^\n]*\bspec:\s*(\d+)/m);
  return m ? Number(m[1]) : null;
}
import type { TrustTier } from "@dotit/core";
import type { TrustState } from "./trust-state";
import { announcePopover, usePopover } from "./popover-bus";
import { TrustActions } from "./TrustActions";

/* ── Trust status banner ─────────────────────────────────────── */

interface TrustBannerProps {
  trust: TrustState;
  /** verifyDocument().intact — null when the document is not sealed. */
  intact: boolean | null;
  /** Live `.it` source — drives the hash-based ambient seal. */
  source: string;
  /**
   * Apply a new source from a trust action. When provided (with `source`), the
   * chip becomes the SINGLE, complete trust control: expanding it offers
   * sign/seal/verify/unseal. Omit for a read-only status chip.
   */
  onChange?: (source: string) => void;
}

function who(by: string, role?: string): string {
  return role ? `${by} (${role})` : by;
}

/**
 * Map the editor's lifecycle + integrity verdict to a seal TRUST TIER so the
 * ambient seal reflects the same verdict the banner shows. Honest by design:
 * a sealed doc whose hash no longer matches is NOT painted blue/"sealed" — it
 * drops to the gray draft tier (the crown still changes with the content, so a
 * tampered doc reads as a different, untrusted seal).
 */
function tierFor(trust: TrustState, intact: boolean | null): TrustTier | undefined {
  if (trust.isSealed) return intact === false ? "draft" : "signed";
  // A signed doc whose content no longer matches its signatures is broken → gray.
  if (trust.signatures.length > 0) return intact === false ? "draft" : "signed";
  // tracked / approved / draft carry no crypto layer → leave undefined so
  // sealForDocument detects the claimed tier from the source (e.g. certify:).
  return undefined;
}

/**
 * Per-signer validity for the CURRENT content. Each `sign:` line is checked with
 * core's `signatureMatchesContent` (spec-aware: v3 binds the signer identity).
 * A signer whose hash no longer matches signed an EARLIER version — that's normal
 * for multi-sign (someone signs, the doc is edited, someone else signs the new
 * version): the earlier signature is "earlier version", the later one stays valid.
 */
function signerStatuses(
  source: string,
): Array<{ signer: string; role?: string; at?: string; valid: boolean }> {
  let sigs: Array<{
    signer: string;
    role?: string;
    at?: string;
    hash?: string;
    spec?: number;
  }> = [];
  try {
    sigs = parseIntentText(source).metadata?.signatures ?? [];
  } catch {
    return [];
  }
  return sigs.map((s) => ({
    signer: s.signer,
    role: s.role,
    at: s.at,
    valid: (() => {
      try {
        return signatureMatchesContent(source, s);
      } catch {
        return false;
      }
    })(),
  }));
}


/**
 * The live Hash-Based Ambient Seal for the document being edited. Rendered from
 * the current source on every change, so the crown updates as you type and its
 * colour tracks the banner's verdict. Sized small to sit inside the banner.
 */
function BannerSeal({
  source,
  trust,
  intact,
}: {
  source: string;
  trust: TrustState;
  intact: boolean | null;
}) {
  const seal = useMemo(() => {
    try {
      return sealForDocument(source, { size: 64, tier: tierFor(trust, intact) });
    } catch {
      return null;
    }
  }, [source, trust, intact]);
  if (!seal) return null;
  return (
    <span
      className="docs-trust-chip__seal"
      title={`Ambient seal · ${seal.hash.replace(/^sha256:/, "").slice(0, 12)}`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: seal.svg }}
    />
  );
}

/** Derive the one compact status the chip shows: variant + icon + title + the
 *  longer detail (shown on hover and when expanded) + an optional verify verdict. */
function trustStatus(trust: TrustState, intact: boolean | null, source: string) {
  if (isTemplate(source)) {
    return {
      variant: "template",
      icon: "📐",
      title: "Template",
      detail:
        "Outside the trust workflow — merge with data to produce a signable document.",
      verify: null as null | { ok: boolean; text: string },
    };
  }
  if (trust.isSealed) {
    const signer = trust.sealedBy || "unknown";
    const role = trust.signatures[trust.signatures.length - 1]?.role;
    // A sealed doc whose content no longer hashes to the sealed hash is BROKEN —
    // say so loudly (red), not a quiet "Sealed ✓".
    if (intact === false) {
      return {
        variant: "broken",
        icon: "⚠",
        title: "Seal broken",
        detail:
          "Content changed after sealing — the hash no longer matches. This is NOT the sealed document.",
        verify: { ok: false, text: "Hash mismatch — tampered since sealing." },
      };
    }
    // A valid seal made under an OLDER ruleset is weaker — spec ≤ 1 doesn't cover
    // signatures, so a signer could be altered without breaking the seal. Show it as
    // a caution (amber) and advise re-sealing, so it never reads as fully trusted.
    const spec = sealSpecOf(source);
    if (intact === true && spec != null && spec < SEAL_SPEC) {
      return {
        variant: "weak",
        icon: "⚠",
        title: "Sealed · older ruleset",
        detail: `Signed by ${who(signer, role)}${trust.sealedAt ? ` on ${trust.sealedAt}` : ""}. Sealed under ruleset v${spec}, which does NOT protect signatures — re-seal to upgrade to v${SEAL_SPEC}.`,
        verify: {
          ok: false,
          text: `⚠ Older ruleset (v${spec}) — signatures aren't protected. Re-seal to upgrade.`,
        },
      };
    }
    return {
      variant: "sealed",
      icon: "🔒",
      title: "Sealed",
      detail: `Signed by ${who(signer, role)}${trust.sealedAt ? ` on ${trust.sealedAt}` : ""} · read-only.`,
      verify:
        intact === true
          ? { ok: true, text: "Verified — unaltered since sealing." }
          : null,
    };
  }
  if (trust.signatures.length > 0) {
    // PER-SIGNER status (multi-sign aware): a signature is valid for the CURRENT
    // content or it signed an EARLIER version (normal when the doc changed between
    // signatures). We never collapse to a blanket "broken" while a later signer's
    // signature is still valid for what's on screen.
    const st = signerStatuses(source);
    const n = st.length;
    const valid = st.filter((s) => s.valid);
    const stale = st.filter((s) => !s.valid);
    const list = (arr: typeof st) =>
      arr.map((s) => `${who(s.signer, s.role)}`).join(" · ");

    if (valid.length === 0) {
      // No one has signed the version on screen → broken (red).
      return {
        variant: "broken",
        icon: "⚠",
        title: n === 1 ? "Signature broken" : "Signatures broken",
        detail: `Content changed since signing — ${n === 1 ? "the signature no longer matches" : "no signature matches the current version"}. Re-sign to restore.`,
        verify: {
          ok: false,
          text: "Signature hash mismatch — edited after signing.",
        },
      };
    }
    if (stale.length > 0) {
      // Mixed: some signed THIS version, some signed an earlier one.
      return {
        variant: "signed",
        icon: "✍",
        title: `Signed · ${valid.length}/${n}`,
        detail: `Signed (this version): ${list(valid)}. Signed an earlier version: ${list(stale)} — re-sign to cover the current text.`,
        verify: {
          ok: true,
          text: `${valid.length} of ${n} signatures cover the current version.`,
        },
      };
    }
    return {
      variant: "signed",
      icon: "✍",
      title: "Signed",
      detail:
        `Signed by ${st
          .map((s) => `${who(s.signer, s.role)}${s.at ? ` on ${s.at}` : ""}`)
          .join(" · ")}. ⚠ Editing breaks signatures over the changed content.`,
      verify: { ok: true, text: "All signatures match the current content." },
    };
  }
  if (trust.approvals.length > 0) {
    return {
      variant: "approved",
      icon: "✓",
      title: "Approved",
      detail: `Approved by ${trust.approvals
        .map((a) => `${who(a.by, a.role)}${a.at ? ` on ${a.at}` : ""}`)
        .join(" · ")}.`,
      verify: null,
    };
  }
  return {
    variant: "draft",
    icon: "📝",
    title: "Draft",
    detail: "Not signed or sealed yet — the seal updates as you edit.",
    verify: null,
  };
}

/**
 * Compact, professional status CHIP (not a full-width banner): a small right-aligned
 * box showing the live ambient seal + the document's trust state, with details on
 * hover and an expand toggle. Keeps the canvas clean while the trust verdict stays
 * one glance away.
 */
export function TrustBanner({
  trust,
  intact,
  source,
  onChange,
}: TrustBannerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePopover("trust-chip", ref, open, () => setOpen(false));
  const s = trustStatus(trust, intact, source);
  // Grey the ambient seal only when the verdict is actually BROKEN (no signature
  // covers the current version) — not for a multi-sign doc where a later signer is
  // still valid (that shows "Signed · N/M", which stays trusted).
  const sigBroken = s.variant === "broken";
  const sealIntactForTier = sigBroken ? false : intact;
  // Actionable when the host can apply edits → the chip IS the trust control.
  const actionable = typeof onChange === "function";

  return (
    <div
      ref={ref}
      className={`docs-trust-chip docs-trust-chip--${s.variant}`}
      role="status"
    >
      <button
        type="button"
        className="docs-trust-chip__main"
        title={s.detail}
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) announcePopover("trust-chip");
        }}
      >
        <BannerSeal source={source} trust={trust} intact={sealIntactForTier} />
        <span className="docs-trust-chip__icon" aria-hidden>
          {s.icon}
        </span>
        <span className="docs-trust-chip__title">{s.title}</span>
        {s.verify && (
          <span
            className={`docs-trust-chip__verify docs-trust-chip__verify--${s.verify.ok ? "ok" : "bad"}`}
          >
            {s.verify.ok ? "✓" : "⚠"}
          </span>
        )}
        <span className="docs-trust-chip__caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open &&
        (actionable ? (
          <div className="docs-trust-chip__pop">
            <TrustActions
              content={source}
              onChange={onChange!}
              trust={trust}
              intact={intact}
              onDone={() => setOpen(false)}
            />
          </div>
        ) : (
          <div className="docs-trust-chip__detail">
            {s.detail}
            {s.verify && (
              <div
                className={`docs-trust-chip__verify-line docs-trust-chip__verify-line--${s.verify.ok ? "ok" : "bad"}`}
              >
                {s.verify.ok ? "✓ " : "⚠ "}
                {s.verify.text}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

/* ── Document properties strip ───────────────────────────────── */

interface DocProp {
  key: string;
  value: string;
}

function collectDocProps(source: string): DocProp[] {
  let doc;
  try {
    doc = parseIntentText(source);
  } catch {
    return [];
  }
  const props: DocProp[] = [];
  const push = (key: string, value: unknown) => {
    const v = value == null ? "" : String(value).trim();
    if (v) props.push({ key, value: v });
  };

  for (const block of doc.blocks) {
    switch (block.type) {
      case "meta":
        // meta: | id: INV-001 | version: 2 | owner: Ahmed | …
        for (const [k, v] of Object.entries(block.properties || {})) push(k, v);
        break;
      case "track":
        push("tracked", block.properties?.id ?? block.content);
        break;
      case "page": {
        const orientation = block.properties?.orientation;
        push(
          "page",
          [block.content, orientation].filter(Boolean).join(" · "),
        );
        break;
      }
      case "font":
        push(
          "font",
          [
            block.content || block.properties?.family,
            block.properties?.size,
          ]
            .filter(Boolean)
            .join(" · "),
        );
        break;
      case "header":
        push("header", block.content);
        break;
      case "footer":
        push("footer", block.content);
        break;
      case "watermark":
        push("watermark", block.content);
        break;
    }
  }
  return props;
}

export function DocPropsBar({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  usePopover("doc-props", popRef, open, () => setOpen(false));
  const props = useMemo(() => collectDocProps(source), [source]);

  if (props.length === 0) return null;

  // Compact (title-bar) mode: a small "Properties ▾" button that opens a dropdown
  // of the property boxes — keeps the top header tidy.
  if (compact) {
    return (
      <div ref={popRef} className={`docs-props-pop${open ? " open" : ""}`}>
        <button
          type="button"
          className="docs-props-pop-btn"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) announcePopover("doc-props");
          }}
          aria-expanded={open}
          title="Document properties"
        >
          Properties ▾
        </button>
        {open && (
          <div
            className="docs-props-pop-menu"
            role="dialog"
            aria-label="Document properties"
          >
            <p className="docs-props-pop-title">Document properties</p>
            {props.map((p, i) => (
              <span className="docs-props-chip" key={`${p.key}-${i}`}>
                <b>{p.key}</b> {p.value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Collapsed: a one-line summary of the leading properties.
  const summary = props
    .slice(0, 4)
    .map((p) => `${p.key}: ${p.value}`)
    .join(" · ");

  return (
    <div className={`docs-props-bar${open ? " open" : ""}`}>
      <button
        className="docs-props-toggle"
        onClick={() => setOpen((o) => !o)}
        title={open ? "Hide document properties" : "Show document properties"}
      >
        <span className="docs-props-caret">{open ? "▾" : "▸"}</span>
        Document properties
        {!open && <span className="docs-props-summary">{summary}</span>}
      </button>
      {open && (
        <div className="docs-props-chips">
          {props.map((p, i) => (
            <span className="docs-props-chip" key={`${p.key}-${i}`}>
              <b>{p.key}</b> {p.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
