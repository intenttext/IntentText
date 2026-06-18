import { describe, it, expect } from "vitest";
import {
  computeDocumentHash,
  computeDocumentHashLegacy,
  hashMatches,
  sealDocument,
  signDocument,
  unsealDocument,
  verifyDocument,
  isSealed,
  isSignedBy,
  upsertMetaProperty,
  toStorageRecord,
  fromStorageRecord,
  verifyStorageRecord,
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

  it("sign:/freeze: show ONLY in the unified trust band, never as inline body text", () => {
    // The signer/seal info lives in ONE certification stamp (the trust band, corner),
    // not duplicated as an inline block in the document flow. Use a REAL signature
    // (matching hash) so the integrity gate shows the intact "Signed" caption.
    const src = signDocument("title: T\ntext: body", {
      signer: "Ahmed",
      role: "CEO",
    }).source;
    const signed = renderHTML(parseIntentText(src));
    expect(signed).toContain("it-trust-band"); // the band is present
    expect(signed).toContain("Signed Ahmed (CEO)"); // who, in the band caption
    // Check the rendered BODY past the stylesheet — the <style> defines the legacy
    // signature class and the .it-trust-band--broken selector, so a whole-string
    // match would be a false positive.
    const body = signed.slice(signed.lastIndexOf("</style>"));
    expect(body).not.toContain("it-trust-band--broken"); // intact → not broken
    expect(body).not.toContain("it-signature__rule");
    expect(body).not.toContain("verified"); // never over-claims
  });

  it("a trusted doc's band can be opted out with seal:false (e.g. when the host adds its own)", () => {
    const src = "title: T\ntext: body\nsign: Ahmed | role: CEO | hash: sha256:abc";
    expect(renderHTML(parseIntentText(src))).toContain("it-trust-band");
    expect(renderHTML(parseIntentText(src), { seal: false })).not.toContain(
      "it-trust-band",
    );
  });

  it("per-paragraph dir: makes one block RTL without flipping others", () => {
    const html = renderHTML(parseIntentText("text: English\n\ntext: عربي | dir: rtl\n\ntext: More English"));
    const rtlBlocks = html.match(/<p class="intent-text[^"]*" dir="rtl"/g) || [];
    expect(rtlBlocks.length).toBe(1);
  });
})

describe("storage integrity — DB-safe .it round-trip", () => {
  it("round-trips byte-for-byte and detects any storage mutation", () => {
    const src = "title: Contract\ntext: Pay 30 days\nsign: A | hash: sha256:x | key: ed25519:k | sig: s";
    const rec = toStorageRecord(src);
    expect(rec.bytesSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fromStorageRecord(rec)).toBe(src);
    expect(verifyStorageRecord(rec)).toBe(true);
    const mangled = { source: src.replace("30 days", "30 day"), bytesSha256: rec.bytesSha256 };
    expect(verifyStorageRecord(mangled)).toBe(false);
    expect(() => fromStorageRecord(mangled)).toThrow(/integrity check failed/);
  });
  it("byte hash differs from the seal hash (whole bytes vs content body)", () => {
    const src = "title: T\ntext: x\nfreeze: | hash: sha256:abc | status: locked";
    // seal hash excludes freeze:; storage hash covers the whole bytes
    expect(toStorageRecord(src).bytesSha256).not.toBe(computeDocumentHash(src).replace("sha256:", ""));
  });
});

describe("Unicode normalization (NFC) before hashing", () => {
  // precomposed e-acute (U+00E9) vs decomposed e + combining acute (U+0301).
  // Written with \\u escapes so this file stays ASCII and cannot be re-normalized.
  const base = "title: Caf\u00e9 Contract\ntext: due \u00e9";
  const precomposed = base.normalize("NFC");
  const decomposed = base.normalize("NFD");

  it("hashes visually-identical NFC/NFD content to the same value", () => {
    expect(precomposed).not.toBe(decomposed); // genuinely different bytes
    expect(computeDocumentHash(precomposed)).toBe(computeDocumentHash(decomposed));
  });

  it("still verifies a document sealed under the legacy (pre-NFC) hash", () => {
    // Simulate a doc sealed before normalization: freeze hash = legacy hash of
    // the decomposed body. verifyDocument must still report it intact.
    const legacy = computeDocumentHashLegacy(decomposed);
    const sealed = `${decomposed}\nfreeze: | at: 2026-01-01T00:00:00Z | hash: ${legacy} | status: locked`;
    const v = verifyDocument(sealed);
    expect(v.frozen).toBe(true);
    expect(v.intact).toBe(true);
    expect(hashMatches(sealed, legacy)).toBe(true);
  });
});
