import { describe, it, expect } from "vitest";
import { appendApproval, sealDocument, verifyDocument } from "../src/index";

// #8: verifyAuditChain alone can't detect TAIL truncation — deleting the most recent
// approval leaves the surviving links internally consistent, so it still reads "valid".
// The seal now commits the chain's head+length, so a removed approval is caught PRECISELY
// as a truncation (not just a generic "document modified") — the forensic signal a bank
// needs ("the director's final approval was removed").

function wire(): string {
  let src = "title: Wire Authorization\n\ntext: Release USD 5,000,000.\n";
  src = appendApproval(src, { by: "Alice", role: "analyst", note: "reviewed" });
  src = appendApproval(src, { by: "Bob", role: "manager", note: "checked" });
  src = appendApproval(src, { by: "Carol", role: "director", note: "Final approval" });
  return src;
}
const seal = (src: string) =>
  sealDocument(src, { signer: "Carol Al-Thani", role: "director" }).source;

describe("#8: audit-chain tail truncation is a precise verdict", () => {
  it("seals a chain anchor (head + length) into the freeze line", () => {
    expect(seal(wire())).toMatch(
      /chain-head: sha256:[0-9a-f]{64} \| chain-len: \d+/,
    );
  });

  it("a clean sealed doc verifies intact with no truncation flag", () => {
    const v = verifyDocument(seal(wire()));
    expect(v.intact).toBe(true);
    expect(v.chainTruncated).toBeUndefined();
  });

  it("deleting the last (director) approval is reported as a TRUNCATION", () => {
    const truncated = seal(wire())
      .split("\n")
      .filter((l) => !l.includes("by: Carol")) // removes the approve: line, not the sign:
      .join("\n");
    const v = verifyDocument(truncated);
    expect(v.intact).toBe(false);
    expect(v.chainTruncated).toBe(true);
    expect(v.error).toMatch(/truncated/i);
  });

  it("editing the body (chain intact) is a generic modification, NOT a truncation", () => {
    const edited = seal(wire()).replace("USD 5,000,000", "USD 9,000,000");
    const v = verifyDocument(edited);
    expect(v.intact).toBe(false);
    expect(v.chainTruncated).toBeFalsy();
    expect(v.error).toMatch(/modified/i);
  });
});
