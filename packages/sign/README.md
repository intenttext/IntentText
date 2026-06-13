# @dotit/sign

**Ed25519 cryptographic signatures for IntentText (`.it`) documents.** The opt-in
*identity* layer on top of [`@dotit/core`](https://www.npmjs.com/package/@dotit/core)'s
*integrity* seal.

```
@dotit/core  →  "has the content changed?"   SHA-256, zero-dependency
@dotit/sign  →  "who signed it?"             Ed25519, audited crypto (@noble/curves)
```

A signature is **self-verifying and offline**: each `sign:` line embeds both the
Ed25519 signature *and* the signer's public key, so a `.it` file carries
everything needed to verify it — no server, no key lookup, no network.

- **Proves:** the holder of public key `K` signed this exact content.
- **Does not prove (alone):** that `K` belongs to a particular real-world person.
  Binding a key to a verified identity is UTS certification (a later layer).

## Install

```bash
npm install @dotit/sign      # library
# or use the CLI:
npx @dotit/sign keygen
```

## Library

```ts
import {
  generateSigningKey,
  signDocumentCrypto,
  verifyDocumentSignatures,
} from "@dotit/sign";

const key = generateSigningKey();
// → { privateKey: "…", publicKey: "…" }  (base64url, keep the private key secret)

const signed = signDocumentCrypto(source, {
  signer: "Ahmed Al-Rashid",
  role: "CEO",
  privateKey: key.privateKey,
});
// signed.source now has:
//   sign: Ahmed Al-Rashid | role: CEO | at: … | hash: sha256:… | key: ed25519:… | sig: …

const v = verifyDocumentSignatures(signed.source);
// → { hash, signatures: [{ signer, role, valid, cryptographic, publicKey, reason }],
//     validCount, allSignaturesValid }
```

Editing the document after signing flips its signatures to `valid: false` — exactly
as it should. Signing is **idempotent** per public key (no duplicate `sign:` lines),
and signatures **survive sealing** (the `freeze:` line is excluded from the hash).

## CLI (`dotit-sign`)

```bash
dotit-sign keygen --out key.json                 # generate a keypair (0600 file)
dotit-sign sign contract.it --key key.json \
           --signer "Ahmed Al-Rashid" --role CEO  # add a cryptographic signature
dotit-sign verify contract.it                     # exit 0 = all valid, 1 = invalid
```

`verify` is a clean CI gate: it needs nothing but the file (the public key is
embedded) and returns a non-zero exit code if any signature fails.

## How it fits the trust model

`.it` proves **integrity** today (`@dotit/core`). `@dotit/sign` adds **identity**.
A UTS timestamp authority will add provable **time**, and an optional public anchor
adds **permanence** — each an independent layer, each claim one you can prove. See
the project's `SECURITY-MODEL.md`.

Crypto is [`@noble/curves`](https://github.com/paulmillr/noble-curves) — audited,
constant-time, runs in Node and the browser. We never hand-roll signature math.

MIT · part of the [dotit](https://dotit.uts.qa) ecosystem.

## UTS certification (the authority layer)

A signature proves *who signed*. A **certification** is issued by a trust
authority (UTS) and proves *"authority A attests this exact content existed at
time T, from account N"* — provable **time**, and (with KYC at onboarding) a
vouched **identity** for the account.

```ts
import { certifyDocument, verifyCertifications } from "@dotit/sign";

// Run by the AUTHORITY (UTS) with its private key — never the document author:
const certified = certifyDocument(source, { issuer: "UTS", account: "acme-corp", issuerPrivateKey: UTS_KEY });
//  certify: UTS | account: acme-corp | at: … | hash: sha256:… | key: ed25519:<utsPub> | sig: …

// Anyone verifies against UTS's PUBLISHED public key (offline):
const checks = verifyCertifications(certified.source, { UTS: UTS_PUBLIC_KEY });
// → [{ issuer, account, at, valid, signatureValid, trusted, reason }]
```

A forged `certify: UTS …` line signed with someone else's key is **rejected**
(`trusted: false`) — the embedded key must match the published UTS key. Editing
the document invalidates the certification. CLI: `dotit-sign certify <file>
--key uts-key.json --account "acme-corp"` (authority) and `dotit-sign verify
<file> --trust UTS=<pubkey>`.
