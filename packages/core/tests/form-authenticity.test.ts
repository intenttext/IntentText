import { describe, it, expect } from "vitest";
import { sealFormStructure, verifyFormStructure } from "../src/index";

// A form-seal: line carries the structure hash + a sealer NAME. The name is an
// unauthenticated claim: anyone can recompute the hash and write a new form-seal: line
// under any name. verifyFormStructure now reports this honestly — a name-only seal is
// `sealerAsserted`, not authenticated (the Ed25519 key-binding lives in @dotit/sign).

const form = `title: Wire Authorization Form
meta: | type: form

input: Approve over-limit transfer | key: approve | type: checkbox | required: yes
input: Amount | key: amount | type: number | required: yes`;

describe("form-structure seal — core reports authorship honestly (#21)", () => {
  it("a name-only form-seal is intact but the sealer is ASSERTED, not authenticated", () => {
    const sealed = sealFormStructure(form, { sealer: "TrustBank Compliance" }).source;
    const v = verifyFormStructure(sealed);
    expect(v.intact).toBe(true);
    expect(v.cryptographic).toBe(false);
    expect(v.sealerAsserted).toBe(true);
    expect(v.sealer).toBe("TrustBank Compliance");
  });

  it("the reword-and-reseal-under-the-bank-name attack is intact but sealerAsserted", () => {
    const legit = sealFormStructure(form, { sealer: "TrustBank Compliance" }).source;
    // Filler rewords a field AND flips required, then re-seals under the bank's name.
    const tampered = legit
      .replace("Approve over-limit transfer", "Approve transfer (pre-approved by bank)")
      .replace("required: yes", "required: no");
    const reSealed = sealFormStructure(tampered, {
      sealer: "TrustBank Compliance",
    }).source;
    const v = verifyFormStructure(reSealed);
    // Its own name-only seal is internally consistent…
    expect(v.intact).toBe(true);
    // …but core no longer presents the bank's authorship as proven.
    expect(v.cryptographic).toBe(false);
    expect(v.sealerAsserted).toBe(true);
  });
});
