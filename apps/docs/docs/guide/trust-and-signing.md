---
sidebar_position: 9
title: Trust & Signing
---

# Trust & Signing

How to approve, sign, seal, verify, and amend `.it` documents — and how to layer
cryptographic identity and authority on top when you need them.

Trust comes in three opt-in layers, each verifiable offline:

1. **Integrity** (`@dotit/core`) — a SHA-256 seal proving the bytes have not changed.
2. **Identity** (`@dotit/sign`) — an Ed25519 signature proving a specific key-holder signed this hash.
3. **Authority** (`@dotit/sign` + UTS) — a certification binding that key to a verified organization.

This page starts with Layer 1 (the everyday default) and builds up to Layers 2 and 3.

## The trust lifecycle

```
draft → tracked → approved → signed → frozen → amended (optional)
```

Each step is a keyword. Each keyword is a line in the document. No external system required.

When rendered, trust blocks print **ink-first** — approvals, signatures, and the seal appear as hairline legal-document entries, not colored boxes, and date-only timestamps render as plain dates (`12 June 2026`, no `00:00 UTC`). A sealed document reads like a contract, not an app.

## Step 1: Track changes

```intenttext
track: | version: 1.0 | by: Ahmed Al-Rashid
```

This activates history. From this point, the CLI can record revisions below the `history:` boundary.

## Step 2: Approve

Named approvals with role and timestamp:

```intenttext
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-05
approve: Finance approved | by: James Miller | role: CFO | at: 2026-03-06
```

Multiple approvals are common — legal, finance, management, compliance.

## Step 3: Sign

Integrity hash seal (tamper-evident record):

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4...
```

`sign:` is tamper-evident — it records the signer's name, role, timestamp, and a SHA-256 hash of the document body at the time of signing. If the document is modified after signing, the stored hash will no longer match and verification will report the discrepancy. This is integrity sealing, not cryptographic non-repudiation (there are no private keys or PKI).

## Step 4: Freeze

Seal the document:

```intenttext
freeze: | status: locked | at: 2026-03-06T14:33:00Z | hash: sha256:e5f6a7b8...
```

After `freeze:`, the document is immutable. Any edit changes the content, which invalidates the hash.

## Seal with the CLI

One command does sign + freeze:

```bash
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"
```

This:

1. Computes the content hash
2. Adds a `sign:` block
3. Adds a `freeze:` block with the hash
4. Writes the sealed file

## Verify anytime

```bash
dotit verify contract.it
```

```
✅  Document intact
    Sealed:   2026-03-06T14:33:00Z
    Signers:  Ahmed Al-Rashid (CEO) ✅
    Hash:     sha256:a1b2c3... ✅ matches
```

If someone edits the file:

```
❌  Document has been modified since sealing
    Sealed:   2026-03-06T14:33:00Z
    Expected: sha256:a1b2c3...
    Current:  sha256:x9y8z7...
```

## Step 5: Amend (when needed)

A frozen contract needs to change. You have two options:

**Without `amendment:` (the old way):**

1. Break the seal
2. Edit the document
3. Re-approve
4. Re-sign
5. Re-freeze

All original signatures are voided. The audit trail has a gap.

**With `amendment:` (the IntentText way):**

```intenttext
amendment: Payment terms updated | section: Payment | was: Net 30 | now: Net 15 | ref: Amendment #1 | by: Ahmed Al-Rashid | approved-by: Sarah Chen
```

The original seal is preserved. The amendment is additive — it records what changed, where, and who authorized it.

## Amend with the CLI

```bash
dotit amend contract.it \
  --section "Payment" \
  --was "Net 30" \
  --now "Net 15" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

## Verify after amendment

```bash
dotit verify contract.it
```

```
✅  Document intact
    Sealed:     2026-03-06T14:33:00Z
    Signers:    Ahmed Al-Rashid (CEO) ✅
    Hash:       sha256:a1b2c3... ✅ matches
    Amendments: 1
```

## View history

```bash
dotit history contract.it
```

```
v1.0  2026-03-01  Ahmed Al-Rashid   Initial draft
v1.1  2026-03-03  Sarah Chen         Legal review — clause 4.2 updated
v1.2  2026-03-05  Ahmed Al-Rashid   Final edits
      2026-03-06  Ahmed Al-Rashid   SEALED
      2026-03-15  Ahmed Al-Rashid   Amendment #1: Payment terms
```

Filter by author or section:

```bash
dotit history contract.it --by "Sarah Chen"
dotit history contract.it --section "Payment"
dotit history contract.it --json
```

## The history boundary

The `history:` keyword separates the document from machine-managed history:

```intenttext
title: Consulting Agreement
text: Terms and conditions...
freeze: | status: locked

history:
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: Initial draft
revision: | version: 1.1 | at: 2026-03-03 | by: Sarah | change: Legal review
```

History is below the `history:` keyword. You read it, but the CLI manages it.

## Physical signatures for print

`sign:` is tamper-evident — records signer name, role, timestamp, and SHA-256 hash. Verifiable by code.
`signline:` is physical — a printed signature line for paper:

```intenttext
signline: Ahmed Al-Rashid | role: CEO | org: Acme Corp | date-line: Date | width: 60%
signline: James Miller | role: CFO | org: GlobalTech Inc. | date-line: Date | width: 60%
```

Use both in contracts that need digital verification _and_ paper signatures:

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
signline: Ahmed Al-Rashid | role: CEO | org: Acme Corp | date-line: Date
```

|                  | `sign:`                 | `signline:`        |
| ---------------- | ----------------------- | ------------------ |
| **Type**         | Digital                 | Physical           |
| **Verification** | SHA-256 hash comparison | Visual on paper    |
| **Lives in**     | The `.it` file          | The printed output |
| **Queryable**    | Yes                     | Yes                |

## What exactly gets hashed

The hash is **reproducible by anyone** — there is no secret. Given the source file and
any SHA-256 implementation, you can recompute it and confirm a seal yourself. The
algorithm runs on the **raw source text**, in order:

1. **Cut at the `history:` boundary.** Only the content _above_ `history:` is hashed, so
   appending audit-log entries never changes the document hash. (No boundary → the whole
   file.)
2. **Drop the seal lines.** Lines starting with `sign:`, `freeze:`, or `amendment:` are
   removed before hashing — their own `hash:` field refers to the body _without_ them, so
   including them would be circular. (`approve:` lines **are** hashed — an approval is
   part of what it approves.)
3. **Join with `\n` and trim.** Surviving lines are joined with LF and the whole string
   is trimmed once.
4. **Hash.** `sha256:` + the hex SHA-256 of those UTF-8 bytes.

:::note Reproducibility & determinism
Encoding is **UTF-8**, line ending is **LF (`\n`)** — a file saved with CRLF hashes
differently, so normalize line endings before hashing. The hash covers the _canonical
source text_, so property order and spacing inside a line matter. Editing in the visual
editor preserves trust lines verbatim, so a normal save never perturbs the hash. The
exact, byte-level spec — with a reference reimplementation that reproduces the core
hash — is **[SPEC §4.1](https://github.com/intenttext/IntentText/blob/main/packages/core/SPEC.md)**.
:::

## Storing sealed documents in a database

A `.it` file is just a UTF-8 string — store it in any `TEXT`/blob column, string in, string
out. Because the seal hash covers the **exact bytes**, the only risk is a storage layer that
silently re-encodes, trims, or converts line endings (CRLF). To guarantee byte-exact
storage, `@dotit/core` ships DB-safe wrappers:

```typescript
import { toStorageRecord, fromStorageRecord, verifyStorageRecord } from "@dotit/core";

const record = toStorageRecord(sealedSource);   // { source, bytesSha256 } — persist this
const restored = fromStorageRecord(record);     // byte-exact restore
const intact = verifyStorageRecord(record);     // true if the bytes survived the round-trip
```

For indexing or diffing without touching the stored bytes, `documentToSource(parseIntentText(src))`
is a lossless text ↔ JSON round-trip — a sealed document still verifies after it.

## What sealing does — and doesn't — prove

Be precise about the guarantee, because "signed" means different things in different
systems:

- ✅ **Tamper-evidence.** If a single byte of the hashed body changes after sealing,
  `verify` fails. This is real and useful: it proves the document you're holding is
  bit-for-bit the one that was sealed.
- ✅ **Self-verifiable, offline, forever.** No vendor, key server, or network is needed
  to check a seal — just the file and SHA-256. The trust property travels with the file.
- ❌ **Not cryptographic non-repudiation.** There are no private keys or PKI. A `sign:`
  line asserts _who_ sealed _which content_; it does not cryptographically bind that
  assertion to a verified identity. Anyone who can edit the file can also recompute a new
  hash and re-seal it under any name — what they _cannot_ do is silently alter the
  sealed body and have the old seal still verify.
- ❌ **Not a trusted timestamp.** The `at:` time is self-asserted, not attested by a
  third party.

This is the right default for the overwhelming majority of business documents — invoices,
agreements, approvals — where the question is "has this been altered since we agreed to
it?" When you need more, the model **layers** without changing the file format. Each higher
layer attests the _same canonical hash_ defined above, so a plain tamper-evident `.it` file
can gain cryptographic identity or authority later without rewriting its content:

| Layer | What it adds | Package |
| --- | --- | --- |
| **1 · Integrity** | SHA-256 seal, self-verifiable, offline | `@dotit/core` (built in) |
| **2 · Identity** | Ed25519 signature binding a key to _this_ hash | `@dotit/sign` |
| **3 · Authority** | UTS certification binding the key to a verified org identity | `@dotit/sign` + UTS |

## Layer 2 — Identity (Ed25519 signatures)

A core `sign:` line proves the content is intact, but anyone who can edit the file can
re-seal it under any name. To prove a **specific key-holder** signed this exact hash,
upgrade the signature with `@dotit/sign`. It adds `key:` and `sig:` fields — an Ed25519
signature over the document hash — that nobody without the private key can forge.

```bash
# Generate a keypair (keep the private key secret)
npx -p @dotit/sign dotit-sign keygen --out ceo-key.json

# Sign the document — embeds the public key + signature
npx -p @dotit/sign dotit-sign sign contract.it --key ceo-key.json --signer "Ahmed Al-Rashid" --role "CEO"

# Verify — needs nothing but the file (the public key travels in the line)
npx -p @dotit/sign dotit-sign verify contract.it
```

The signed line carries the proof inline:

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3... | key: ed25519:<pubkey> | sig: <signature>
```

A plain `sign: Name | role: …` with **no** `key:`/`sig:` is only a named approval, like
`approve:`. From code:

```typescript
import { generateSigningKey, signDocumentCrypto, verifyCryptoSignatures } from "@dotit/sign";

const key = generateSigningKey(); // { privateKey, publicKey } — base64url
const { source } = signDocumentCrypto(contractSource, {
  signer: "Ahmed Al-Rashid",
  role: "CEO",
  privateKey: key.privateKey,
});
const checks = verifyCryptoSignatures(source);
// [{ signer, role, at, publicKey, cryptographic: true, valid: true }]
```

**Honest scope:** a valid signature proves "the holder of public key `<pub>` signed this
exact hash." It does **not** by itself prove the signer's real-world identity — that is
Layer 3.

## Layer 3 — Authority (UTS certification)

Layer 3 binds a signing key to a **verified organization identity**. A certification
authority (UTS) verifies the account/entity once, then issues `certify:` lines that anyone
can re-check offline. `verifyCertifications()` reports a certification as `valid` only when
its signature verifies **and** its key chains to a trusted authority.

```intenttext
certify: UTS | account: al-diwan | entity: Al-Diwan Contracting W.L.L. | at: 2026-06-13T19:56:11Z | hash: sha256:a1b2c3... | key: ed25519:<pubkey> | sig: <signature> | ica: <intermediate-cert>
```

```typescript
import { certifyDocument, verifyCertifications } from "@dotit/sign";

// Run by the AUTHORITY with its key (never the document author)
const { source } = certifyDocument(contractSource, {
  issuer: "UTS",
  account: "al-diwan",
  entity: "Al-Diwan Contracting W.L.L.",
  issuerPrivateKey: utsKey.privateKey,
  intermediateCert: icaToken, // optional — chains to an offline root (below)
});

// trustedIssuers maps issuer name → its published public key
const certs = verifyCertifications(source, { UTS: rootPublicKey });
// [{ issuer, account, entity, publicKey, signatureValid, trusted, valid, chain }]
```

### Root → intermediate certificate hierarchy

`@dotit/sign` 1.3 adds the same key hierarchy a real CA uses: an **offline root** key
vouches for a short-lived **online intermediate** key that signs the daily certifications.
The root signs an intermediate's public key offline, producing a compact `ica:` token that
embeds in each `certify:` line. Verifiers trust **only the root key** — if the online
intermediate leaks, you rotate it without re-trusting anything.

```typescript
import { issueIntermediate, verifyIntermediateCert } from "@dotit/sign";

// ROOT operation — run OFFLINE on the air-gapped root machine
const ica = issueIntermediate({
  rootPrivateKey,            // never leaves the offline machine
  intermediatePublicKey,     // the online daily signer's public key
  issuer: "UTS",
  days: 365,
});
// `ica` is an opaque base64url token — pass it to certifyDocument({ intermediateCert: ica })

// A verifier checks the token against the trusted ROOT key alone:
verifyIntermediateCert(ica, { UTS: rootPublicKey }, new Date().toISOString());
```

When a `certify:` line carries `ica:`, `verifyCertifications` validates the chain root →
intermediate → certification and returns a `chain: { rootPublicKey, notBefore, notAfter }`,
anchoring trust in the offline root.

**Lifecycle:** `track → approve → sign → freeze` (Layer 1) `→ Ed25519 sign` (Layer 2) `→
certify` (Layer 3) `→ verify`. Each layer is opt-in and verifiable offline.

---

**Related:**

- [Sealing Contracts →](../cookbook/trust/sealing-contracts)
- [Amending Frozen Documents →](../cookbook/trust/amending-frozen-docs)
- [Audit Trail →](../cookbook/trust/audit-trail)
- [Trust Keywords Reference →](../reference/keywords/trust)
