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
import { parseIntentText } from "@dotit/core";
import type { TrustState } from "../hooks/useTrustState";

/* ── Trust status banner ─────────────────────────────────────── */

interface TrustBannerProps {
  trust: TrustState;
  /** verifyDocument().intact — null when the document is not sealed. */
  intact: boolean | null;
}

function who(by: string, role?: string): string {
  return role ? `${by} (${role})` : by;
}

export function TrustBanner({ trust, intact }: TrustBannerProps) {
  if (trust.isSealed) {
    const signer = trust.sealedBy || "unknown";
    const role = trust.signatures[trust.signatures.length - 1]?.role;
    return (
      <div className="docs-trust-banner docs-trust-banner--sealed" role="status">
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
    return (
      <div className="docs-trust-banner docs-trust-banner--signed" role="status">
        <span className="docs-trust-banner__icon">✍</span>
        <span className="docs-trust-banner__title">Signed</span>
        <span className="docs-trust-banner__text">
          by{" "}
          {trust.signatures
            .map((s) => `${who(s.by, s.role)}${s.at ? ` on ${s.at}` : ""}`)
            .join(" · ")}
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

  return null;
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
