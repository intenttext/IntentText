import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  signDocumentCrypto,
  addTrustedTimestamp,
  verifySignatureTimestamps,
} from "../src/index";
import { PUBLIC_TSA } from "@dotit/pades";

// #34: a signature's `at:` is the signer's own clock — backdatable. A trusted RFC-3161
// timestamp (`tst:`) anchors the signing time to a TSA. verifySignatureTimestamps only
// reports timestampValid when the token's CMS signature verifies AND its imprint binds
// to the signature's content hash — so a forged/backdated token is rejected.

const DOC = "title: Guarantee\n\ntext: The Bank guarantees USD 1,000,000.";
const sign = () => {
  const k = generateSigningKey();
  return signDocumentCrypto(DOC, {
    signer: "Alice Chen",
    role: "CFO",
    privateKey: k.privateKey,
  }).source;
};

describe("#34: RFC-3161 trusted timestamps", () => {
  it("an untimestamped signature reports timestamped:false (deterministic)", async () => {
    const [t] = await verifySignatureTimestamps(sign());
    expect(t.timestamped).toBe(false);
    expect(t.timestampValid).toBe(false);
  });

  it("a garbage tst: is rejected without crashing (deterministic)", async () => {
    const withGarbage = sign()
      .split("\n")
      .map((l) =>
        l.startsWith("sign:") ? `${l} | tst: bm90LWEtcmVhbC10b2tlbg` : l,
      )
      .join("\n");
    const [t] = await verifySignatureTimestamps(withGarbage);
    expect(t.timestamped).toBe(true);
    expect(t.timestampValid).toBe(false);
  });

  it(
    "adds + verifies a REAL trusted timestamp, rejects a tampered one (network; skips offline)",
    async () => {
      const signed = sign();
      let timestamped: string;
      try {
        timestamped = await addTrustedTimestamp(signed, {
          tsaUrl: PUBLIC_TSA.digicert,
        });
      } catch {
        return; // TSA unreachable / offline — skip without failing
      }

      expect(timestamped).toMatch(/\| tst: /);
      const [ok] = await verifySignatureTimestamps(timestamped);
      expect(ok.timestamped).toBe(true);
      expect(ok.timestampValid).toBe(true);
      expect(ok.timestampTime).toBeTruthy();

      // Tamper the embedded token → it no longer verifies (trusted time can't be forged).
      const tstVal = timestamped.match(/tst: ([\w-]+)/)![1];
      const flipped = (tstVal[0] === "A" ? "B" : "A") + tstVal.slice(1);
      const [bad] = await verifySignatureTimestamps(
        timestamped.replace(tstVal, flipped),
      );
      expect(bad.timestampValid).toBe(false);
    },
    25000,
  );
});
