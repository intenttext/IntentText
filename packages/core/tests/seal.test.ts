import { describe, it, expect } from "vitest";
import {
  renderSeal,
  sealForDocument,
  detectTrustState,
  contentHashOf,
  TIER_STYLES,
} from "../src/seal";

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
    expect(svg).toContain(".it"); // monogram
    // balanced tags (no stray < that breaks XML)
    const open = (svg.match(/</g) || []).length;
    const close = (svg.match(/>/g) || []).length;
    expect(open).toBe(close);
  });

  it("adds the star only for the root-certified tier", () => {
    expect(renderSeal({ hash: H1, tier: "root-certified" })).toContain("★");
    expect(renderSeal({ hash: H1, tier: "certified" })).not.toContain("★");
  });

  it("can omit arc text", () => {
    const svg = renderSeal({ hash: H1, tier: "signed", text: false });
    expect(svg).not.toContain("textPath");
  });

  it("uses unique element ids per (hash, tier) to avoid collisions on one page", () => {
    const a = renderSeal({ hash: H1, tier: "certified" });
    const b = renderSeal({ hash: H2, tier: "certified" });
    const idA = a.match(/id="(s[0-9a-f]+-certified)/)?.[1];
    const idB = b.match(/id="(s[0-9a-f]+-certified)/)?.[1];
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
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
    expect(seal.svg).toContain("★");
  });
});
