/**
 * seal-hardening.test.ts — P0 seal-integrity fixes (assessment gaps G-01/G-02/G-03).
 *
 * These are ADVERSARIAL tests: each one is an attack the seal must survive, or a
 * silent break the seal must no longer suffer. They are red without the fix.
 *
 *  G-01  Styling is excluded from the content hash (so restyling never breaks a seal)
 *        — but that let an attacker HIDE sealed content (opacity:0 / white-on-white /
 *        size:0 / an injected `style:` line) while verifyDocument() still said intact.
 *        Defenses: (a) a recorded APPEARANCE hash trips `appearanceChanged`; (b) the
 *        BARE trust render shows the signed content with no styling; (c) a render-time
 *        visibility guard neutralizes fully-invisible styling on the styled path too.
 *  G-02  CRLF / lone-CR / trailing whitespace silently broke an UNTAMPERED seal
 *        (the hash split on "\n" only). v4 normalizes EOL + trailing ws before hashing.
 *  G-03  A pasted `certify:` line painted a gold CERTIFIED seal with no key check.
 *        Core now treats certification as an unverified CLAIM unless the caller passes
 *        a verified result.
 */
import { describe, it, expect } from "vitest";
import {
  sealDocument,
  signDocument,
  verifyDocument,
  computeDocumentHash,
  computeAppearanceHash,
  parseIntentText,
  documentToSource,
  renderPrint,
  renderTrustBand,
  detectTrustState,
  TIER_STYLES,
  SEAL_SPEC,
} from "../src/index";

// ── G-01: hidden-content smuggling ──────────────────────────────────────────
describe("G-01: sealed content cannot be hidden without leaving a trace", () => {
  const BASE =
    "title: Service Agreement\n\ntext: The penalty for late delivery is 50000 QAR.\n";

  // Each smuggle alters ONLY hash-excluded styling, so the CONTENT hash is unchanged
  // (intact stays true — that is the legitimate "restyle without breaking a seal"
  // pillar) — but the APPEARANCE hash must catch it.
  const SMUGGLES: Array<{ name: string; apply: (sealed: string) => string }> = [
    {
      name: "opacity:0 on the clause",
      apply: (s) =>
        s.replace(
          "text: The penalty for late delivery is 50000 QAR.",
          "text: The penalty for late delivery is 50000 QAR. | opacity: 0",
        ),
    },
    {
      name: "white-on-white (color == bg)",
      apply: (s) =>
        s.replace(
          "text: The penalty for late delivery is 50000 QAR.",
          "text: The penalty for late delivery is 50000 QAR. | color: #ffffff | bg: #ffffff",
        ),
    },
    {
      name: "zero font-size",
      apply: (s) =>
        s.replace(
          "text: The penalty for late delivery is 50000 QAR.",
          "text: The penalty for late delivery is 50000 QAR. | size: 0px",
        ),
    },
    {
      name: "injected style: line hiding the text block",
      apply: (s) =>
        s.replace(
          "text: The penalty for late delivery is 50000 QAR.",
          "style: text | color: #ffffff\ntext: The penalty for late delivery is 50000 QAR.",
        ),
    },
  ];

  it("a freshly sealed document reports no appearance change", () => {
    const sealed = sealDocument(BASE, { signer: "Ada", role: "CEO" }).source;
    const v = verifyDocument(sealed);
    expect(v.intact).toBe(true);
    expect(v.appearanceChanged).toBeFalsy();
  });

  for (const sm of SMUGGLES) {
    it(`detects the restyle: ${sm.name}`, () => {
      const sealed = sealDocument(BASE, { signer: "Ada", role: "CEO" }).source;
      const smuggled = sm.apply(sealed);
      expect(smuggled).not.toBe(sealed); // the attack actually applied

      const v = verifyDocument(smuggled);
      // Content hash is intentionally styling-blind → still "intact"…
      expect(v.intact).toBe(true);
      // …but the appearance (full-fidelity) hash catches the post-seal restyle.
      expect(v.appearanceChanged).toBe(true);
      expect(v.warning).toMatch(/appearance/i);
    });
  }

  it("the BARE trust render shows the signed clause with styling stripped", () => {
    const sealed = sealDocument(BASE, { signer: "Ada", role: "CEO" }).source;
    const smuggled = SMUGGLES[0].apply(sealed); // opacity:0
    const bare = renderPrint(parseIntentText(smuggled), { bare: true });
    expect(bare).toContain("50000 QAR"); // the clause is visible…
    expect(bare).not.toMatch(/opacity:\s*0(?![.\d])/); // …and the smuggled styling is gone
  });

  it("the visibility guard neutralizes fully-invisible styling on the STYLED path", () => {
    const sealed = sealDocument(BASE, { signer: "Ada", role: "CEO" }).source;
    for (const sm of SMUGGLES.slice(0, 3)) {
      const styled = renderPrint(parseIntentText(sm.apply(sealed))); // non-bare
      expect(styled).toContain("50000 QAR");
      // No literal zero-opacity inline style (0.8/0.85 from the trust band are fine).
      expect(styled).not.toMatch(/opacity:\s*0(?![.\d])/);
    }
  });
});

// ── G-02: line-ending / whitespace robustness ───────────────────────────────
describe("G-02: CRLF / lone-CR / trailing whitespace never break an untampered v4 seal", () => {
  const BASE = "title: Contract\n\ntext: Pay 1000 USD by 2026-07-01.\n";

  it("new seals stamp the current spec (4)", () => {
    expect(SEAL_SPEC).toBe(4);
    const sealed = sealDocument(BASE, { signer: "Ada" }).source;
    expect(sealed).toMatch(/freeze:[^\n]*\|\s*spec:\s*4/);
    expect(sealed).toMatch(/freeze:[^\n]*\|\s*appearance:\s*sha256:/);
  });

  it("survives an LF -> CRLF conversion", () => {
    const sealed = sealDocument(BASE, { signer: "Ada" }).source;
    expect(verifyDocument(sealed).intact).toBe(true);
    const crlf = sealed.replace(/\n/g, "\r\n");
    const v = verifyDocument(crlf);
    expect(v.intact).toBe(true); // not broken by the EOL transform
    expect(v.appearanceChanged).toBeFalsy(); // and not misreported as a restyle
  });

  it("survives a trailing-whitespace re-save", () => {
    const sealed = sealDocument(BASE, { signer: "Ada" }).source;
    const ws = sealed
      .split("\n")
      .map((l) => (l ? l + "   " : l))
      .join("\n");
    expect(verifyDocument(ws).intact).toBe(true);
  });

  it("frozen-dispatch proof: v3 is CRLF-fragile, v4 is not", () => {
    const lf = "title: X\ntext: hello world";
    const crlf = lf.replace(/\n/g, "\r\n");
    // v3 (FROZEN, the historical bug): CRLF changes the hash. Must stay broken so old
    // seals keep verifying under exactly their recorded rules.
    expect(computeDocumentHash(crlf, 3)).not.toBe(computeDocumentHash(lf, 3));
    // v4 (the fix): EOL-normalized → identical hash.
    expect(computeDocumentHash(crlf, 4)).toBe(computeDocumentHash(lf, 4));
  });

  it("CR-only input round-trips idempotently (no unbounded text: prefixing)", () => {
    const crOnly = "title: X\rtext: a\rtext: b";
    const once = documentToSource(parseIntentText(crOnly));
    const twice = documentToSource(parseIntentText(once));
    expect(twice).toBe(once);
    expect(once).not.toMatch(/text: text:/); // the old corruption signature
  });

  it("appearance hash is itself EOL/whitespace-stable", () => {
    const lf = "title: X\ntext: a | color: #f00";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(computeAppearanceHash(crlf, 4)).toBe(computeAppearanceHash(lf, 4));
  });
});

// ── G-03: certification is a claim, not a verdict ───────────────────────────
describe("G-03: a forged certify line is never painted CERTIFIED by core surfaces", () => {
  it("renderTrustBand does not use the certified/root colours for a presence-only certify", () => {
    const sealed = sealDocument("title: X\n\ntext: hi\n", { signer: "Ada" }).source;
    // Paste an unverified certification (any attacker can do this). certify: lines are
    // excluded from the hash, so the seal stays intact — the danger is purely visual.
    const forged = sealed.replace(
      "freeze:",
      "certify: Mallory | account: x | at: 2026-01-01 | hash: sha256:abc | key: ed25519:PUB | sig: SIG | ica: TOK\nfreeze:",
    );
    expect(verifyDocument(forged).intact).toBe(true); // seal not broken by the paste
    const band = renderTrustBand(forged);
    expect(band).not.toContain(TIER_STYLES["root-certified"].color);
    expect(band).not.toContain(TIER_STYLES["certified"].color);
    // It honestly shows the locally-verifiable SEALED tier instead.
    expect(band).toContain(TIER_STYLES["sealed"].color);
  });

  it("detectTrustState reports the claim but withholds the verdict", () => {
    const src =
      "title: X\n\ncertify: UTS | account: acme | at: 2026-01-01 | hash: sha256:abc | key: ed25519:PUB | sig: SIG\n";
    const claimed = detectTrustState(src);
    expect(claimed.certified).toBe(true);
    expect(claimed.certificationVerified).toBe(false);
    expect(claimed.tier).not.toBe("certified");

    const verified = detectTrustState(src, { certificationVerified: true });
    expect(verified.tier).toBe("certified");
  });

  it("a tampered (content-changed) sealed doc still reads BROKEN regardless", () => {
    const sealed = sealDocument("title: X\n\ntext: pay 100\n", { signer: "Ada" }).source;
    const tampered = sealed.replace("pay 100", "pay 900");
    expect(verifyDocument(tampered).intact).toBe(false);
    expect(renderTrustBand(tampered)).toContain("it-trust-band--broken");
  });
});
