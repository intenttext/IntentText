import { describe, it, expect } from "vitest";
import { sealDocument, verifyDocument, verifyTrust } from "../src/index";

// A hash proves the CONTENT is unchanged since sealing; it proves NOTHING about who
// sealed it, because @dotit/core's seal needs no secret — anyone can seal any content
// under any name. The old verify path reported signers[].valid from the hash alone, so
// a re-sealed forgery showed a "valid" signer. Core now reports identity honestly:
// each signer is flagged `cryptographic` (has an Ed25519 key+sig) or not, and a
// name-only seal sets `identityAsserted`. (Actual Ed25519 verification is @dotit/sign's
// job — see verifyFullTrust there.)

const wire = `title: Payment Instruction

text: Transfer USD 100 to account 111 (vendor).`;

const stripTrust = (s: string) =>
  s
    .split("\n")
    .filter((l) => !/^(sign|freeze):/.test(l.trimStart()))
    .join("\n");

describe("signer authenticity — core reports identity honestly", () => {
  it("a name-only seal is integrity-verified but identity is ASSERTED, not authenticated", () => {
    const sealed = sealDocument(wire, { signer: "Alice Chen", role: "CFO" }).source;
    const v = verifyDocument(sealed);
    expect(v.intact).toBe(true); // content integrity holds…
    expect(v.signers?.[0].signer).toBe("Alice Chen");
    expect(v.signers?.[0].cryptographic).toBe(false); // …no cryptographic signature…
    expect(v.identityAsserted).toBe(true); // …so identity is asserted, not proven.
  });

  it("the re-seal-under-a-spoofed-name forgery is intact but flags identityAsserted", () => {
    const genuine = sealDocument(wire, { signer: "Alice Chen", role: "CFO" }).source;
    // Attacker strips the trust lines, changes the amount, re-seals under Alice's name.
    const forged = sealDocument(
      stripTrust(genuine).replace(
        "USD 100 to account 111 (vendor)",
        "USD 900000 to account 999 (attacker)",
      ),
      { signer: "Alice Chen", role: "CFO" },
    ).source;
    const v = verifyDocument(forged);
    // The forgery's OWN seal is internally consistent — exactly why a hash is not proof
    // of identity…
    expect(v.intact).toBe(true);
    // …but core no longer implies authenticity.
    expect(v.signers?.[0].cryptographic).toBe(false);
    expect(v.identityAsserted).toBe(true);
  });

  it("verifyTrust still reports integrity ok, leaving authenticity to @dotit/sign", () => {
    const sealed = sealDocument(wire, { signer: "Alice Chen", role: "CFO" }).source;
    // Integrity aggregate holds; the signer-authentication verdict is verifyFullTrust.
    expect(verifyTrust(sealed).ok).toBe(true);
    expect(verifyTrust(sealed).seal.identityAsserted).toBe(true);
  });
});
