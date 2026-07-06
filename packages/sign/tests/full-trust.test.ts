import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  signDocumentCrypto,
  verifyFullTrust,
} from "../src/index";
import { sealDocument } from "@dotit/core";

// verifyFullTrust is the verdict a bank should trust: integrity (content unchanged) AND
// authenticity (every signer is a cryptographic signature that verifies). Integrity
// alone is defeated by re-sealing a forgery under a spoofed name — that document's bare
// seal is "intact", but it carries no cryptographic signature, so it is NOT authenticated.

const wire =
  "title: Payment Instruction\n\ntext: Transfer USD 100 to account 111 (vendor).";

describe("@dotit/sign — verifyFullTrust (integrity AND authenticity)", () => {
  it("a cryptographically signed, sealed document is ok + authenticated", () => {
    const k = generateSigningKey();
    const signed = signDocumentCrypto(wire, {
      signer: "Alice Chen",
      role: "CFO",
      privateKey: k.privateKey,
    }).source;
    // Seal without adding a second (name-only) signature line.
    const sealed = sealDocument(signed, {
      signer: "Alice Chen",
      role: "CFO",
      skipSign: true,
    }).source;

    const v = verifyFullTrust(sealed);
    expect(v.integrity.ok).toBe(true);
    expect(v.authenticated).toBe(true);
    expect(v.validSignatureCount).toBe(1);
    expect(v.ok).toBe(true);
  });

  it("the spoofed-name re-seal forgery is NOT authenticated → ok:false", () => {
    // No key, no secret — just a name. This is the exact finding #17 attack.
    const forged = sealDocument(
      "title: Payment Instruction\n\ntext: Transfer USD 900000 to account 999 (attacker).",
      { signer: "Alice Chen", role: "CFO" },
    ).source;

    const v = verifyFullTrust(forged);
    expect(v.integrity.ok).toBe(true); // its bare seal is internally intact…
    expect(v.authenticated).toBe(false); // …but there is no cryptographic signature…
    expect(v.ok).toBe(false); // …so the bank verdict is RED.
  });

  it("editing a cryptographically signed document breaks authenticity", () => {
    const k = generateSigningKey();
    const signed = signDocumentCrypto(wire, {
      signer: "Alice Chen",
      privateKey: k.privateKey,
    }).source;
    const tampered = signed.replace("USD 100", "USD 900000");
    const v = verifyFullTrust(tampered);
    expect(v.authenticated).toBe(false);
    expect(v.ok).toBe(false);
  });

  it("a name-only approval alongside a crypto signature is not fully authenticated", () => {
    const k = generateSigningKey();
    const signed = signDocumentCrypto(wire, {
      signer: "Alice Chen",
      privateKey: k.privateKey,
    }).source;
    // A second party approves by name only (no key) — identity not authenticated.
    const mixed = sealDocument(signed, { signer: "Bob (Ops)", role: "Ops" }).source;
    const v = verifyFullTrust(mixed);
    expect(v.authenticated).toBe(false); // not EVERY signature is cryptographic
    expect(v.ok).toBe(false);
  });
});
