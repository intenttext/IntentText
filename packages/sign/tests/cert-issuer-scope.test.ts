import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  issueIntermediate,
  certifyDocument,
  verifyCertifications,
} from "../src/index.js";

// #6: a root scopes an intermediate to ONE issuer name. The chained verify path
// checked the root signature, the validity window, and that the signing key is the
// intermediate — but NOT that the certify: line's issuer equals the intermediate's
// scoped issuer. So a UTS-scoped intermediate could certify AS "GovCA" and verify as
// trusted — a cross-authority forgery. verifyCertifications now enforces the scope.

const WINDOW = {
  notBefore: "2026-01-01T00:00:00.000Z",
  notAfter: "2027-01-01T00:00:00.000Z",
};
const AT = "2026-06-01T00:00:00.000Z";
const doc = "title: Tender Award\n\ntext: Acme wins lot 3.\n";

describe("certification issuer scope (#6)", () => {
  it("REJECTS a UTS-scoped intermediate that certifies under a different issuer", () => {
    const rootUTS = generateSigningKey();
    const rootGov = generateSigningKey();
    const interUTS = generateSigningKey();

    // Root UTS legitimately vouches for the intermediate, scoped to issuer "UTS".
    const icaUTS = issueIntermediate({
      rootPrivateKey: rootUTS.privateKey,
      intermediatePublicKey: interUTS.publicKey,
      issuer: "UTS",
      ...WINDOW,
    });

    // The holder of the UTS intermediate tries to certify AS "GovCA".
    const forged = certifyDocument(doc, {
      issuer: "GovCA",
      account: "acme-corp",
      issuerPrivateKey: interUTS.privateKey,
      intermediateCert: icaUTS,
      at: AT,
    }).source;

    const trust = { UTS: rootUTS.publicKey, GovCA: rootGov.publicKey };
    const [check] = verifyCertifications(forged, trust);
    expect(check.issuer).toBe("GovCA");
    expect(check.signatureValid).toBe(true); // the intermediate really did sign it…
    expect(check.trusted).toBe(false); // …but it is scoped to UTS, not GovCA
    expect(check.reason).toMatch(/scoped to issuer 'UTS'/);
  });

  it("still trusts the intermediate certifying under its OWN issuer (no regression)", () => {
    const root = generateSigningKey();
    const inter = generateSigningKey();
    const ica = issueIntermediate({
      rootPrivateKey: root.privateKey,
      intermediatePublicKey: inter.publicKey,
      issuer: "UTS",
      ...WINDOW,
    });
    const certified = certifyDocument(doc, {
      issuer: "UTS",
      account: "acme-corp",
      issuerPrivateKey: inter.privateKey,
      intermediateCert: ica,
      at: AT,
    }).source;

    const [check] = verifyCertifications(certified, { UTS: root.publicKey });
    expect(check.trusted).toBe(true);
    expect(check.reason).toBeUndefined();
  });
});
