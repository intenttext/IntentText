import { describe, it, expect } from "vitest";
import {
  renderSeal,
  sealForDocument,
  renderTrustBand,
  detectTrustState,
  contentHashOf,
  TIER_STYLES,
} from "../src/seal";
import { signDocument, sealDocument } from "../src/trust";

const H1 =
  "sha256:9f3a7c2e1b4d8a60f5e2c9013a7b6d4e8f1029384756abcdef0123456789abcd";
const H2 =
  "sha256:11223344556677889900aabbccddeeff00112233445566778899aabbccddeeff";

describe("renderSeal", () => {
  it("is deterministic in the hash (same hash → byte-identical SVG)", () => {
    expect(renderSeal({ hash: H1, tier: "certified" })).toBe(
      renderSeal({ hash: H1, tier: "certified" }),
    );
  });

  it("produces a different crown for a different hash", () => {
    expect(renderSeal({ hash: H1, tier: "certified" })).not.toBe(
      renderSeal({ hash: H2, tier: "certified" }),
    );
  });

  it("uses the tier colour", () => {
    for (const tier of ["draft", "signed", "certified", "root-certified"] as const) {
      const svg = renderSeal({ hash: H1, tier });
      expect(svg).toContain(TIER_STYLES[tier].color);
    }
  });

  it("emits well-formed, self-contained SVG", () => {
    const svg = renderSeal({ hash: H1, tier: "certified", size: 120 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('width="120"');
    expect(svg).toContain("<path"); // the ".it" mark
    expect(svg).toContain("<rect"); // the rounded-square card
    expect(svg).toContain("<polyline"); // the hash-derived wave field
    // balanced tags (no stray < that breaks XML)
    const open = (svg.match(/</g) || []).length;
    const close = (svg.match(/>/g) || []).length;
    expect(open).toBe(close);
  });

  it("renders each tier distinctly (tier colour drives the pattern)", () => {
    // root-certified (gold) and certified (green) must not be byte-identical.
    expect(renderSeal({ hash: H1, tier: "root-certified" })).not.toBe(
      renderSeal({ hash: H1, tier: "certified" }),
    );
  });

  it("the seal is collision-free on one page (no shared defs ids)", () => {
    // The flat wave design uses no <defs>/id refs, so any number of seals can
    // coexist on a page without id collisions.
    const svg = renderSeal({ hash: H1, tier: "certified" });
    expect(svg).not.toContain("<defs");
    expect(svg).not.toMatch(/\sid="/);
  });

  it("omits the hash caption when text is off", () => {
    const on = renderSeal({ hash: H1, tier: "signed" });
    const off = renderSeal({ hash: H1, tier: "signed", text: false });
    expect(on).toContain("<text");
    expect(off).not.toContain("<text");
  });
});

describe("renderTrustBand", () => {
  it("is empty for an unsigned draft", () => {
    expect(renderTrustBand("title: Draft\n\ntext: hi\n")).toBe("");
  });

  it("combines seal + signer + freeze for a signed+sealed doc", () => {
    const signed = signDocument("title: Invoice\ntext: Pay 100", {
      signer: "Emad",
      role: "CEO",
    }).source;
    const sealed = sealDocument(signed, { signer: "Emad", skipSign: true }).source;
    const band = renderTrustBand(sealed);
    expect(band).toContain("it-trust-band");
    expect(band).toContain("it-trust-band__seal");
    expect(band).toContain("Signed Emad (CEO)");
    expect(band).toContain("Sealed");
    expect(band).toContain("<svg"); // the hash seal
    expect(band).not.toContain("--broken"); // intact → not broken
  });

  it("INTEGRITY GATE: a tampered sealed doc renders a loud BROKEN band, never a clean seal", () => {
    const signed = signDocument("title: Invoice\ntext: Pay 100", {
      signer: "Emad",
      role: "CEO",
    }).source;
    const sealed = sealDocument(signed, { signer: "Emad", skipSign: true }).source;
    const tampered = sealed.replace("Pay 100", "Pay 999");
    const band = renderTrustBand(tampered);
    expect(band).toContain("it-trust-band--broken");
    expect(band).toContain("SEAL BROKEN");
    expect(band).toContain(TIER_STYLES.broken.color); // red ink
    // It must NOT present the document as certified.
    expect(band).not.toContain("Sealed 1"); // no "Sealed <date>" caption
  });

  it("INTEGRITY GATE: tampering a SIGNATURE line breaks the band too", () => {
    const signed = signDocument("title: Invoice\ntext: Pay 100", {
      signer: "Emad",
      role: "CEO",
    }).source;
    const sealed = sealDocument(signed, { signer: "Emad", skipSign: true }).source;
    const tampered = sealed.replace("sign: Emad", "sign: Mallory");
    expect(renderTrustBand(tampered)).toContain("it-trust-band--broken");
  });

  it("INTEGRITY GATE: a signed-but-not-sealed doc breaks when content changes", () => {
    const signed = signDocument("title: Memo\ntext: original", {
      signer: "Sara",
    }).source;
    expect(renderTrustBand(signed)).not.toContain("--broken");
    const tampered = signed.replace("original", "changed");
    const band = renderTrustBand(tampered);
    expect(band).toContain("it-trust-band--broken");
    expect(band).toContain("SIGNATURE BROKEN");
  });
});

describe("detectTrustState", () => {
  it("draft when no trust lines", () => {
    const s = detectTrustState("title: Memo\n\ntext: hello\n");
    expect(s.tier).toBe("draft");
    expect(s.label).toBe("DRAFT");
  });

  it("signed when a cryptographic sign line is present", () => {
    const src =
      "title: X\n\nsign: Ahmed | role: CEO | at: 2026-01-01 | hash: sha256:abc | key: ed25519:PUB | sig: SIG\n";
    const s = detectTrustState(src);
    expect(s.tier).toBe("signed");
    expect(s.signed).toBe(true);
  });

  it("certified (green) when a certify line is present", () => {
    const src =
      "title: X\n\ncertify: UTS | account: acme | at: 2026-01-01 | hash: sha256:abc | key: ed25519:PUB | sig: SIG\n";
    const s = detectTrustState(src);
    expect(s.tier).toBe("certified");
    expect(s.certified).toBe(true);
    expect(s.rootCertified).toBe(false);
  });

  it("root-certified (gold) when the certify line carries an ica: chain", () => {
    const src =
      "title: X\n\ncertify: UTS | account: acme | at: 2026-01-01 | hash: sha256:abc | key: ed25519:PUB | sig: SIG | ica: TOKEN123\n";
    const s = detectTrustState(src);
    expect(s.tier).toBe("root-certified");
    expect(s.rootCertified).toBe(true);
  });
});

describe("sealForDocument", () => {
  it("reads the content hash from a trust line's hash field", () => {
    const src =
      "title: X\n\ncertify: UTS | account: acme | at: 2026-01-01 | hash: sha256:deadbeef0123456789 | key: ed25519:PUB | sig: SIG\n";
    expect(contentHashOf(src)).toBe("sha256:deadbeef0123456789");
    const seal = sealForDocument(src);
    expect(seal.tier).toBe("certified");
    expect(seal.hash).toBe("sha256:deadbeef0123456789");
    expect(seal.svg).toContain("<svg");
  });

  it("falls back to computing the hash for an unsigned draft", () => {
    const seal = sealForDocument("title: Draft\n\ntext: in progress\n");
    expect(seal.tier).toBe("draft");
    expect(seal.hash).toMatch(/[0-9a-f]{16,}/i);
  });

  it("honours an explicit (verified) tier override", () => {
    const seal = sealForDocument("title: X\n\ntext: y\n", { tier: "root-certified" });
    expect(seal.tier).toBe("root-certified");
    expect(seal.svg).toContain(TIER_STYLES["root-certified"].color);
  });
});
