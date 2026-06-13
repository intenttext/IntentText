// Document status chrome for the visual editor:
//
//  - TrustBanner: a professional document-status bar derived from the trust
//    blocks (seal/sign/approve/freeze) — "🔒 Sealed — signed by Ahmed (CEO) on
//    2026-06-12 · hash verified ✓" instead of raw chips. Sealed documents are
//    read-only (VisualEditor flips editable off); the banner says so.
//  - DocPropsBar: a tidy, collapsible header strip for document-level metadata
//    (meta: id/version/owner…, page:, font:, header:, footer:, watermark:),
//    which is otherwise invisible in the page.

import { useMemo, useState } from "react";
import { parseIntentText, sealForDocument, isTemplate } from "@dotit/core";
import type { TrustTier } from "@dotit/core";
import type { TrustState } from "./trust-state";

/* ── Trust status banner ─────────────────────────────────────── */

interface TrustBannerProps {
  trust: TrustState;
  /** verifyDocument().intact — null when the document is not sealed. */
  intact: boolean | null;
  /** Live `.it` source — drives the hash-based ambient seal. */
  source: string;
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
  if (trust.signatures.length > 0) return "signed";
  // tracked / approved / draft carry no crypto layer → leave undefined so
  // sealForDocument detects the claimed tier from the source (e.g. certify:).
  return undefined;
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
      className="docs-trust-banner__seal"
      title={`Ambient seal · ${seal.hash.replace(/^sha256:/, "").slice(0, 12)}`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: seal.svg }}
    />
  );
}

export function TrustBanner({ trust, intact, source }: TrustBannerProps) {
  // A TEMPLATE (.it blueprint) is OUTSIDE the trust workflow — it can't be
  // sealed/signed/certified, so it has no Draft/Signed/Sealed state at all. This
  // MUST be the first branch: the slate dashed seal (rendered for free by
  // sealForDocument, which detects the template tier) plus template wording, and
  // never a trust verdict. Merge it with data first to get a signable document.
  if (isTemplate(source)) {
    return (
      <div
        className="docs-trust-banner docs-trust-banner--template"
        role="status"
      >
        <BannerSeal source={source} trust={trust} intact={intact} />
        <span className="docs-trust-banner__icon">📐</span>
        <span className="docs-trust-banner__title">Template</span>
        <span className="docs-trust-banner__text">
          outside the trust workflow · merge with data to produce a signable
          document
        </span>
      </div>
    );
  }

  if (trust.isSealed) {
    const signer = trust.sealedBy || "unknown";
    const role = trust.signatures[trust.signatures.length - 1]?.role;
    return (
      <div className="docs-trust-banner docs-trust-banner--sealed" role="status">
        <BannerSeal source={source} trust={trust} intact={intact} />
        <span className="docs-trust-banner__icon">🔒</span>
        <span className="docs-trust-banner__title">Sealed</span>
        <span className="docs-trust-banner__text">
          signed by {who(signer, role)}
          {trust.sealedAt ? ` on ${trust.sealedAt}` : ""} · read-only
        </span>
        {intact === true && (
          <span className="docs-trust-banner__verify docs-trust-banner__verify--ok">
            hash verified ✓
          </span>
        )}
        {intact === false && (
          <span className="docs-trust-banner__verify docs-trust-banner__verify--bad">
            ⚠ hash mismatch — content changed after sealing
          </span>
        )}
      </div>
    );
  }

  if (trust.signatures.length > 0) {
    const n = trust.signatures.length;
    // A signed-but-unsealed document stays EDITABLE — but editing changes the
    // bytes the signatures cover, so we warn (Word-style) that doing so breaks
    // them. Sealing locks it read-only; that's a separate action.
    return (
      <div className="docs-trust-banner docs-trust-banner--signed" role="status">
        <BannerSeal source={source} trust={trust} intact={intact} />
        <span className="docs-trust-banner__icon">✍</span>
        <span className="docs-trust-banner__title">Signed</span>
        <span className="docs-trust-banner__text">
          by{" "}
          {trust.signatures
            .map((s) => `${who(s.by, s.role)}${s.at ? ` on ${s.at}` : ""}`)
            .join(" · ")}
        </span>
        <span className="docs-trust-banner__warn">
          ⚠ Editing will break {n} signature{n === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  if (trust.approvals.length > 0) {
    return (
      <div
        className="docs-trust-banner docs-trust-banner--approved"
        role="status"
      >
        <BannerSeal source={source} trust={trust} intact={intact} />
        <span className="docs-trust-banner__icon">✓</span>
        <span className="docs-trust-banner__title">Approved</span>
        <span className="docs-trust-banner__text">
          by{" "}
          {trust.approvals
            .map((a) => `${who(a.by, a.role)}${a.at ? ` on ${a.at}` : ""}`)
            .join(" · ")}
        </span>
      </div>
    );
  }

  // Draft — no trust block yet. Still show the live ambient seal (gray crown)
  // so the seal is present from the first keystroke and visibly changes as the
  // document evolves; it turns blue/green/gold the moment a trust line lands.
  return (
    <div className="docs-trust-banner docs-trust-banner--draft" role="status">
      <BannerSeal source={source} trust={trust} intact={intact} />
      <span className="docs-trust-banner__icon">📝</span>
      <span className="docs-trust-banner__title">Draft</span>
      <span className="docs-trust-banner__text">
        not signed or sealed yet · the seal updates as you edit
      </span>
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

export function DocPropsBar({ source }: { source: string }) {
  const [open, setOpen] = useState(false);
  const props = useMemo(() => collectDocProps(source), [source]);

  if (props.length === 0) return null;

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
