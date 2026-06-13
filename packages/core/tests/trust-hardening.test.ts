import { describe, it, expect } from "vitest";
import {
  computeDocumentHash,
  sealDocument,
  signDocument,
  unsealDocument,
  verifyDocument,
  isSealed,
  isSignedBy,
  upsertMetaProperty,
  getMetaProperty,
  parseIntentText,
  renderHTML,
} from "../src/index";
import { createHash } from "crypto";

describe("trust hardening — pure-JS SHA-256", () => {
  it("matches Node's crypto SHA-256 exactly (old seals still verify)", () => {
    for (const s of ["", "hello", "عقد — 2026", "x".repeat(2000)]) {
      const node = "sha256:" + createHash("sha256").update(s.trim()).digest("hex");
      expect(computeDocumentHash(s)).toBe(node);
    }
  });
});

describe("trust hardening — idempotency (no repeat-click corruption)", () => {
  const base = "title: Contract\ntext: Pay in 30 days\nsection: Approval";

  it("re-sealing is a no-op (one freeze: line)", () => {
    const a = sealDocument(base, { signer: "Ahmed", role: "CEO" });
    const b = sealDocument(a.source, { signer: "Ahmed", role: "CEO" });
    expect(b.error).toBe("already-sealed");
    expect(b.source.split("\n").filter((l) => l.startsWith("freeze:")).length).toBe(1);
    expect(verifyDocument(b.source).intact).toBe(true);
  });

  it("re-signing as same signer is a no-op; different signers stack", () => {
    let s = signDocument(base, { signer: "Ahmed", role: "CEO" });
    const repeat = signDocument(s.source, { signer: "Ahmed", role: "CEO" });
    expect(repeat.note).toBe("already-signed");
    const other = signDocument(repeat.source, { signer: "Sara", role: "CFO" });
    expect(other.source.split("\n").filter((l) => l.startsWith("sign:")).length).toBe(2);
    expect(isSignedBy(other.source, "Ahmed")).toBe(true);
  });

  it("unseal removes only the freeze lock, keeps signatures and body", () => {
    const signed = signDocument(base, { signer: "Ahmed" });
    const sealed = sealDocument(signed.source, { signer: "Ahmed", skipSign: true });
    const un = unsealDocument(sealed.source);
    expect(isSealed(un)).toBe(false);
    expect(un).toContain("Pay in 30 days");
    expect(isSignedBy(un, "Ahmed")).toBe(true);
  });
});

describe("trust hardening — meta property dedup (dir: rtl spam)", () => {
  it("toggling a meta prop N times yields exactly one copy", () => {
    let s = "title: Quote\ntext: hello";
    for (let i = 0; i < 7; i++) s = upsertMetaProperty(s, "dir", "rtl");
    const meta = s.split("\n").find((l) => l.startsWith("meta:"))!;
    expect((meta.match(/dir:/g) || []).length).toBe(1);
    s = upsertMetaProperty(s, "dir", null);
    expect(s.split("\n").some((l) => l.startsWith("meta:"))).toBe(false);
  });

  it("preserves other meta props when toggling one", () => {
    let s = "meta: | theme: corporate\ntitle: T";
    s = upsertMetaProperty(s, "dir", "rtl");
    expect(getMetaProperty(s, "theme")).toBe("corporate");
    expect(getMetaProperty(s, "dir")).toBe("rtl");
    s = upsertMetaProperty(s, "dir", null);
    expect(getMetaProperty(s, "theme")).toBe("corporate");
    expect(getMetaProperty(s, "dir")).toBeUndefined();
  });
});

describe("parser hardening — stray pipe-property continuation", () => {
  it("merges a wrapped `| key: value` into the line above", () => {
    const doc = parseIntentText("title: T\nsign: Ahmed | role: CEO\n| label: Date\n| by: legal@acme.co");
    expect(doc.blocks.some((b) => b.type === "text" && b.content.startsWith("|"))).toBe(false);
    const sign = doc.blocks.find((b) => b.type === "sign")!;
    expect(sign.properties).toMatchObject({ role: "CEO", label: "Date", by: "legal@acme.co" });
  });

  it("never merges markdown table rows (multi-cell `| a | b |`)", () => {
    const doc = parseIntentText("title: Invoice\n| Description | Qty | Total |\n| Widget | 2 | 20 |");
    const table = doc.blocks.find((b) => b.type === "table");
    expect(table).toBeDefined();
    expect(table!.table!.headers).toEqual(["Description", "Qty", "Total"]);
  });

  it("preserves content that legitimately starts with an escaped pipe", () => {
    const doc = parseIntentText("text: \\| escaped pipe start");
    expect(doc.blocks[0].content).toBe("| escaped pipe start");
  });
});

describe("info callout — quiet variant", () => {
  it("renders with the quiet info class and an italic marker, label hidden", () => {
    const html = renderHTML(parseIntentText("info: heads up"));
    expect(html).toContain("intent-info");
    expect(html).toContain("intent-callout-content");
  });
});

describe("trust visuals + per-paragraph direction (1.2.1)", () => {
  it("approve: renders one grid row with date anchored (no wrap to 2nd line)", () => {
    const html = renderHTML(parseIntentText("approve: Commercial terms | by: Fahad Al-Thani | role: Managing Director | at: 2026-06-11"));
    expect(html).toContain('class="it-approval"');
    expect(html).toContain('it-approval__main');
    expect(html).toContain('it-approval__date');
  });

  it("sign: renders the signature-line look and never claims 'verified' on a plain hash", () => {
    const plain = renderHTML(parseIntentText("sign: Ahmed | role: CEO | at: 2026-06-12 | hash: sha256:abc"));
    expect(plain).toContain('it-signature__rule');
    expect(plain).toContain('Signed');
    expect(plain).not.toContain('verified');
    const crypto = renderHTML(parseIntentText("sign: Ahmed | role: CEO | at: 2026-06-12 | hash: sha256:abc | key: ed25519:k | sig: s"));
    expect(crypto).toContain('✓ Signed');
  });

  it("per-paragraph dir: makes one block RTL without flipping others", () => {
    const html = renderHTML(parseIntentText("text: English\n\ntext: عربي | dir: rtl\n\ntext: More English"));
    const rtlBlocks = html.match(/<p class="intent-text[^"]*" dir="rtl"/g) || [];
    expect(rtlBlocks.length).toBe(1);
  });
})
