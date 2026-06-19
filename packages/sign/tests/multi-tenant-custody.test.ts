/**
 * multi-tenant-custody.test.ts — reference pattern + PoC for assessment gap G-05.
 *
 * IntentText signing is single-key by design: `signDocumentCrypto(source, { signer,
 * role, privateKey })`. An ERP that serves many client companies (e.g. Jadwal) must
 * therefore enforce, IN THE HOST, that:
 *   (1) each tenant has its OWN signing identity — never a shared key;
 *   (2) the private key is looked up server-side and never leaves custody;
 *   (3) `signer`/`role` are derived from the AUTHENTICATED SESSION, never from a
 *       request body / text box (or one user could sign as another);
 *   (4) a session for tenant A can never sign with tenant B's key.
 *
 * This file is the executable reference for that contract. `TenantKeyVault` below is
 * the shape an integrator implements — in production the `#keys` map is a KMS/HSM
 * (the vault holds a key HANDLE, signs via the HSM, and never materializes raw key
 * bytes). The tests are the PoC: they prove the isolation properties hold and that a
 * cross-tenant forgery is rejected.
 */
import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  signDocumentCrypto,
  verifyDocumentSignatures,
} from "../src/index";

/** A session minted by the host's auth layer — the source of signer identity. */
interface Session {
  tenantId: string;
  userName: string;
  role?: string;
}

/**
 * Reference per-tenant key custody. The ONLY way to sign is `signFor(session, src)`:
 * the private key is selected by the session's tenant and never exposed; the signer
 * identity comes from the session. There is deliberately NO `getPrivateKey()`.
 */
class TenantKeyVault {
  // In production: tenantId -> KMS/HSM key handle (NOT raw bytes). The vault calls the
  // HSM to sign; raw private keys never enter app memory.
  #keys = new Map<string, { privateKey: string; publicKey: string }>();

  /** Provision a tenant's signing identity once, at onboarding (KYC). */
  enroll(tenantId: string): string {
    if (this.#keys.has(tenantId)) return this.#keys.get(tenantId)!.publicKey;
    const key = generateSigningKey();
    this.#keys.set(tenantId, key);
    return key.publicKey; // publish this; the private half never leaves the vault
  }

  /** The tenant's PUBLIC key (for verifiers). Never returns the private key. */
  publicKeyFor(tenantId: string): string | undefined {
    return this.#keys.get(tenantId)?.publicKey;
  }

  /**
   * Sign `source` AS the session's tenant. signer/role come from the session, the
   * key is selected by the session's tenant. A caller cannot choose the key or
   * impersonate another signer.
   */
  signFor(session: Session, source: string): string {
    const key = this.#keys.get(session.tenantId);
    if (!key) throw new Error(`no signing identity for tenant ${session.tenantId}`);
    const res = signDocumentCrypto(source, {
      signer: session.userName, // from the authenticated session — never a request body
      role: session.role,
      privateKey: key.privateKey, // never exposed to the caller
    });
    return res.source;
  }
}

const DOC = "title: Invoice INV-1\n\ntext: Amount due 1000 QAR.\n";

describe("G-05: per-tenant signing identity & key custody", () => {
  it("each tenant gets a DISTINCT identity (never a shared key)", () => {
    const vault = new TenantKeyVault();
    const a = vault.enroll("acme");
    const b = vault.enroll("globex");
    expect(a).not.toBe(b);
    // enroll is idempotent — re-enrolling returns the same identity, not a new one.
    expect(vault.enroll("acme")).toBe(a);
  });

  it("a tenant's signature verifies under ITS OWN published key", () => {
    const vault = new TenantKeyVault();
    const acmeKey = vault.enroll("acme");
    const signed = vault.signFor(
      { tenantId: "acme", userName: "Ada", role: "CFO" },
      DOC,
    );
    const v = verifyDocumentSignatures(signed);
    expect(v.allSignaturesValid).toBe(true);
    expect(v.signatures[0].signer).toBe("Ada");
    // the signature's embedded key is acme's, not anyone else's
    expect(signed).toContain(`ed25519:${acmeKey}`);
  });

  it("the signer identity is SESSION-derived, not caller-supplied", () => {
    const vault = new TenantKeyVault();
    vault.enroll("acme");
    // The host passes the session; there is no way to inject a different signer name
    // because signFor takes the session, not a free-text signer. The signed line
    // carries exactly the session's user.
    const signed = vault.signFor({ tenantId: "acme", userName: "Mallory" }, DOC);
    expect(verifyDocumentSignatures(signed).signatures[0].signer).toBe("Mallory");
    // and the vault never exposes a way to sign with a chosen name + acme's key:
    expect((vault as unknown as { getPrivateKey?: unknown }).getPrivateKey).toBeUndefined();
  });

  it("a session for tenant A can NEVER sign with tenant B's key", () => {
    const vault = new TenantKeyVault();
    const acmeKey = vault.enroll("acme");
    const globexKey = vault.enroll("globex");

    const signedByAcme = vault.signFor({ tenantId: "acme", userName: "Ada" }, DOC);
    // The signature embeds ACME's key — globex's key never touched it.
    expect(signedByAcme).toContain(`ed25519:${acmeKey}`);
    expect(signedByAcme).not.toContain(`ed25519:${globexKey}`);

    // An unknown tenant cannot sign at all (no key in custody).
    expect(() =>
      vault.signFor({ tenantId: "intruder", userName: "X" }, DOC),
    ).toThrow(/no signing identity/);
  });

  it("PoC: a cross-tenant forgery is detectable — A's sig is not B's", () => {
    const vault = new TenantKeyVault();
    vault.enroll("acme");
    const globexKey = vault.enroll("globex");

    const signedByAcme = vault.signFor({ tenantId: "acme", userName: "Ada" }, DOC);
    // The signature is valid (it really is acme's), but it is NOT globex's key —
    // a verifier pinning globex's published key would not accept it as globex.
    const v = verifyDocumentSignatures(signedByAcme);
    expect(v.allSignaturesValid).toBe(true);
    expect(signedByAcme).not.toContain(`ed25519:${globexKey}`);
    // Tampering the embedded key to claim globex's identity breaks the signature
    // (the sig was made over acme's key/payload), so impersonation is caught.
    const forged = signedByAcme.replace(
      /key: ed25519:[A-Za-z0-9_-]+/,
      `key: ed25519:${globexKey}`,
    );
    expect(verifyDocumentSignatures(forged).allSignaturesValid).toBe(false);
  });
});
