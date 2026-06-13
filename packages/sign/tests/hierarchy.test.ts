/**
 * Root → Intermediate hierarchy: the root signs an intermediate certificate
 * (ICA token); the intermediate signs document certifications; a verifier holding
 * only the ROOT key validates the whole chain offline.
 */
import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  issueIntermediate,
  parseIntermediateCert,
  verifyIntermediateCert,
  certifyDocument,
  verifyCertifications,
} from "../src/index.js";

const ISSUER = "UTS";

/** Plain source — certifyDocument hashes the content directly. */
function sealedDoc(): string {
  return "title: Tender Award\n\ntext: Acme wins lot 3.\n";
}

/** Set up a root, an intermediate, and an ICA token vouching for it. */
function setupChain(opts?: { days?: number; notBefore?: string; notAfter?: string }) {
  const root = generateSigningKey();
  const intermediate = generateSigningKey();
  const ica = issueIntermediate({
    rootPrivateKey: root.privateKey,
    intermediatePublicKey: intermediate.publicKey,
    issuer: ISSUER,
    days: opts?.days,
    // Default to a wide fixed window so the tests' fixed `at` falls inside;
    // the validity-window test overrides these explicitly.
    notBefore: opts?.notBefore ?? "2026-01-01T00:00:00.000Z",
    notAfter: opts?.notAfter ?? "2027-01-01T00:00:00.000Z",
  });
  return { root, intermediate, ica };
}

describe("intermediate certificate (ICA)", () => {
  it("round-trips and verifies against the trusted root", () => {
    const { root, intermediate, ica } = setupChain();
    const parsed = parseIntermediateCert(ica)!;
    expect(parsed.intermediatePublicKey).toBe(intermediate.publicKey);
    expect(parsed.rootPublicKey).toBe(root.publicKey);
    expect(parsed.issuer).toBe(ISSUER);

    const vr = verifyIntermediateCert(ica, { [ISSUER]: root.publicKey });
    expect(vr.valid).toBe(true);
    expect(vr.intermediatePublicKey).toBe(intermediate.publicKey);
  });

  it("rejects an ICA whose root is not the trusted root (forgery)", () => {
    const { ica } = setupChain();
    const attacker = generateSigningKey();
    const vr = verifyIntermediateCert(ica, { [ISSUER]: attacker.publicKey });
    expect(vr.valid).toBe(false);
    expect(vr.reason).toMatch(/does not match the trusted root/);
  });

  it("rejects an ICA when the issuer's root is unknown", () => {
    const { ica } = setupChain();
    expect(verifyIntermediateCert(ica, {}).valid).toBe(false);
    expect(verifyIntermediateCert(ica, {}).reason).toMatch(/not in trusted set/);
  });

  it("rejects a tampered ICA token", () => {
    const { root, ica } = setupChain();
    // Flip a character in the token body → signature/parse must fail.
    const tampered = ica.slice(0, -4) + (ica.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    const vr = verifyIntermediateCert(tampered, { [ISSUER]: root.publicKey });
    expect(vr.valid).toBe(false);
  });

  it("enforces the validity window against the certification time", () => {
    const { root, ica } = setupChain({
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2026-12-31T23:59:59.000Z",
    });
    const trusted = { [ISSUER]: root.publicKey };
    expect(verifyIntermediateCert(ica, trusted, "2026-06-01T00:00:00.000Z").valid).toBe(true);
    expect(verifyIntermediateCert(ica, trusted, "2025-06-01T00:00:00.000Z").valid).toBe(false); // before
    expect(verifyIntermediateCert(ica, trusted, "2027-06-01T00:00:00.000Z").valid).toBe(false); // after
  });
});

describe("chained certification (certify with ica → verify against root)", () => {
  it("a doc certified by the intermediate verifies for a holder of only the ROOT key", () => {
    const { root, intermediate, ica } = setupChain();
    const doc = sealedDoc();
    const { source } = certifyDocument(doc, {
      issuer: ISSUER,
      account: "acme-corp",
      entity: "Acme Corp WLL",
      issuerPrivateKey: intermediate.privateKey, // the INTERMEDIATE signs
      intermediateCert: ica,
      at: "2026-06-13T10:00:00.000Z",
    });
    expect(source).toContain("ica:");

    // The verifier trusts only the ROOT.
    const checks = verifyCertifications(source, { [ISSUER]: root.publicKey });
    expect(checks).toHaveLength(1);
    const c = checks[0];
    expect(c.valid).toBe(true);
    expect(c.signatureValid).toBe(true);
    expect(c.trusted).toBe(true);
    expect(c.entity).toBe("Acme Corp WLL");
    expect(c.chain?.rootPublicKey).toBe(root.publicKey);
  });

  it("rejects a chained cert when the trusted root is wrong", () => {
    const { intermediate, ica } = setupChain();
    const otherRoot = generateSigningKey();
    const { source } = certifyDocument(sealedDoc(), {
      issuer: ISSUER,
      account: "acme-corp",
      issuerPrivateKey: intermediate.privateKey,
      intermediateCert: ica,
      at: "2026-06-13T10:00:00.000Z",
    });
    const c = verifyCertifications(source, { [ISSUER]: otherRoot.publicKey })[0];
    expect(c.valid).toBe(false);
    expect(c.trusted).toBe(false);
    expect(c.reason).toMatch(/intermediate certificate not trusted/);
  });

  it("rejects a cert whose signing key was NOT the one the root vouched for", () => {
    // Attacker has a valid ICA for intermediate A, but signs with rogue key B.
    const { root, ica } = setupChain();
    const rogue = generateSigningKey();
    const { source } = certifyDocument(sealedDoc(), {
      issuer: ISSUER,
      account: "acme-corp",
      issuerPrivateKey: rogue.privateKey, // mismatch vs ica.pub
      intermediateCert: ica,
      at: "2026-06-13T10:00:00.000Z",
    });
    const c = verifyCertifications(source, { [ISSUER]: root.publicKey })[0];
    expect(c.valid).toBe(false);
    expect(c.reason).toMatch(/not the key vouched for/);
  });

  it("flips to invalid when the document is edited after certification", () => {
    const { root, intermediate, ica } = setupChain();
    const { source } = certifyDocument(sealedDoc(), {
      issuer: ISSUER,
      account: "acme-corp",
      issuerPrivateKey: intermediate.privateKey,
      intermediateCert: ica,
      at: "2026-06-13T10:00:00.000Z",
    });
    const tampered = source.replace("Acme wins lot 3", "Acme wins lot 9");
    const c = verifyCertifications(tampered, { [ISSUER]: root.publicKey })[0];
    expect(c.signatureValid).toBe(false);
    expect(c.valid).toBe(false);
  });
});

describe("backward compatibility (legacy single-key certs still work)", () => {
  it("a cert with no ica verifies directly against the trusted signing key", () => {
    const issuer = generateSigningKey();
    const { source } = certifyDocument(sealedDoc(), {
      issuer: ISSUER,
      account: "acme-corp",
      issuerPrivateKey: issuer.privateKey,
      at: "2026-06-13T10:00:00.000Z",
    });
    expect(source).not.toContain("ica:");
    const c = verifyCertifications(source, { [ISSUER]: issuer.publicKey })[0];
    expect(c.valid).toBe(true);
    expect(c.chain).toBeUndefined();
  });
});
