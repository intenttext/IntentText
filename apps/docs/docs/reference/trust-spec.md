---
sidebar_position: 16
title: Trust & Integrity Specification
---

# Trust & Integrity Specification

This is the normative reference for how an `.it` document's **integrity**, **signatures**,
and **certifications** are computed and verified. It is the contract that independent
implementations (and enterprise/legal reviewers) can rely on. It complements the
[keyword reference](./index.md); here we specify only the trust layer.

> **Status:** v1 (matches `@dotit/core` ≥ 1.9.0 and `@dotit/sign` ≥ 1.4.1). The hash rule
> changed in 1.9.0 (Unicode normalization); verifiers MUST accept the legacy hash for
> documents sealed before that — see [Backward compatibility](#9-backward-compatibility).

The key words MUST, SHOULD, and MAY are used as in RFC 2119.

## 1. Document model (trust-relevant parts)

An `.it` document is UTF-8 text, one record per line, of the form
`keyword: content | prop: value | …` (see [Pipe Properties](./pipe-properties.md)).

A document has an optional **history boundary**: the first line whose trimmed text is
exactly `history:` (canonical), or the legacy pair of a line `---` immediately followed by
a line beginning `// history`. Everything before the boundary is the **body**; everything
at/after it is **history** and is not covered by the content hash.

The following keywords are **trust lines** and receive special treatment by the hash
(Section 2):

| Keyword | Meaning |
| --- | --- |
| `sign:` | a signature (cryptographic, or a plaintext on-record intent) |
| `freeze:` | a seal — binds a content hash and locks the document |
| `certify:` | a third-party (UTS) certification of a content hash |
| `amendment:` | a post-seal amendment record |

`approve:` is **not** a trust line for hashing purposes — it is part of the hashed body
(an approval is content that the seal must cover).

## 2. Content hash (canonicalization)

The **content hash** is computed as follows (`computeDocumentHash`):

1. Take the **body** (text before the history boundary; the whole document if there is no
   boundary).
2. Split into lines on `\n`. **Remove** every line that, with no leading trimming, begins
   with `sign:`, `freeze:`, `certify:`, or `amendment:`. (These are metadata *about* the
   content; adding a signature, seal, or certification MUST NOT change the content hash.)
3. Join the remaining lines with `\n` and trim leading/trailing whitespace.
4. **Unicode-normalize to NFC.** This makes two byte-different but visually identical
   documents (e.g. precomposed `é` U+00E9 vs decomposed `e`+◌́ U+0065 U+0301) hash the same,
   so re-saving in another editor does not invalidate a seal.
5. Compute `SHA-256` over the UTF-8 bytes and format as
   `sha256:` + lowercase hex.

```
hash = "sha256:" + hex( SHA-256( NFC( trim( bodyLinesExcludingTrustLines.join("\n") ) ) ) )
```

What the hash covers and what it does **not**:

- **Covered:** every body content line (title, text, sections, tables, `approve:`, …),
  their order, and their exact text (post-NFC).
- **Not covered:** the trust lines themselves, anything in the history section, and
  presentation that is not part of the source text.

## 3. Trust tiers

A verifier derives one headline **tier** from the verified (not claimed) state:

| Tier | Condition |
| --- | --- |
| `template` | the document is a template (`{{…}}`, `input:`, or `meta: … type: template`) — **outside** the trust workflow; cannot be sealed/signed/certified |
| `draft` | no verifiable trust layer (or any layer failed to verify) |
| `signed` | an intact seal, **or** ≥1 cryptographic signature that verifies against the current content |
| `certified` | a valid UTS certification (Section 5) |
| `root-certified` | a valid certification that **chains to the UTS root** via an `ica:` token |

A broken layer (tampered seal, signature that no longer matches, certification whose
signature fails) MUST pin the tier to `draft` — never show a higher tier over a layer that
failed. This is honest tamper-evidence.

## 4. Signatures

### 4.1 Cryptographic signature (`@dotit/sign`)

```
sign: NAME | role: ROLE | at: ISO8601 | hash: sha256:… | key: ed25519:PUBKEY | sig: SIG
```

- `PUBKEY`, `SIG` are base64url (unpadded). `PUBKEY` MUST decode to exactly 32 bytes.
- The signature is Ed25519 over the **signing payload**:
  ```
  payload = utf8( `${contentHash}\n${signer}\n${role}\n${at}` )
  ```
  where `contentHash` is the current content hash (Section 2). `role` is the empty string
  if absent.
- A signature is **valid** iff `Ed25519.verify(SIG, payload, PUBKEY)` succeeds against the
  current content hash. Editing the body changes the hash and therefore invalidates the
  signature — by design.

### 4.2 On-record signature (no key)

```
sign: NAME | role: ROLE | at: DATE
```

A `sign:` line **without** `key:`+`sig:` is an **integrity-only on-record claim** — it
records that a named party signed, but is **not** cryptographic proof and MUST NOT be
presented as verified. Verifiers MAY surface it as "on record."

## 5. Seal and certification

### 5.1 Seal (`freeze:`)

```
freeze: | at: ISO8601 | hash: sha256:… | status: locked
```

The document is **sealed**. It is **intact** iff the current content hash equals the
`hash` field. A seal proves **integrity** (content unchanged since sealing); it does not by
itself prove *who* sealed it.

### 5.2 Certification (`certify:`)

```
certify: UTS | account: ACC | entity: ENTITY | at: ISO8601 | hash: sha256:… | key: ed25519:PUB | sig: SIG | ica: TOKEN
```

Issued by a UTS authority over the certification payload
`certPayload(contentHash, issuer, account, entity, at)`. `entity` and `ica:` are optional.

- **Legacy (no `ica:`):** the signing `key` MUST itself be a trusted issuer key.
- **Chained (`ica:` present):** the `key` is an *intermediate* vouched for by the **root**.
  The verifier, holding only the **root** public key, MUST:
  1. verify the root's signature over the intermediate (the ICA token),
  2. confirm the ICA's intermediate key equals the certification's `key`, and
  3. confirm `at` falls within the ICA's `notBefore`/`notAfter` window.

  This makes the whole chain verifiable **offline** from the document plus the pinned root.

## 6. Approval routing & hash-chained audit

A document MAY declare an **approval route** and carry a **tamper-evident approval
trail**, so the workflow travels inside the file and its state is *derived*, never
stored externally (`@dotit/core` ≥ 1.14.0).

### 6.1 Route policy (`route:` / `require:`)

- `route: sequential` (default) or `route: parallel` declares the ordering.
- Each `require:` line declares one required approver: the content is the matched
  **role** (or name), with optional `when:` (a single comparison evaluated against
  the document's own `metric:`/`meta:` values, per the form-field evaluator) and
  optional `optional: yes`.
- `route:`/`require:` are **not reserved keywords**; they parse as preserved
  `custom` blocks (the unknown-keyword guarantee), so a routed document round-trips
  byte-for-byte and keeps its content hash.

### 6.2 Derived state (`workflowState`)

A conforming implementation derives `{ active, fulfilled, pending, next, complete }`
purely from the policy and the document's `approve:` lines:

1. A requirement is **active** when it has no `when:`, or its `when:` holds (an
   unresolvable `when:` is treated as active — never silently dropped).
2. A required role/name is **fulfilled** when an `approve:` line carries a matching
   `role:` or `by:`.
3. **pending** = active, non-`optional`, unfulfilled requirements, in declared order.
4. **next** = (sequential) the first pending requirement; (parallel) none.
5. **complete** = no pending requirements.

Because state is derived, re-deriving from the file always matches — there is no
separate record to drift.

### 6.3 Hash-chained approval trail

To make the approval **sequence** tamper-evident, each chained approval carries
`prev: sha256:<hash>`:

- The first link's `prev` is the **audit-genesis** hash: SHA-256 of the body with
  ALL audit lines (`approve:`/`sign:`/`freeze:`/`certify:`/`amendment:`) removed,
  trimmed, NFC-normalized — stable as approvals accumulate.
- Each subsequent link's `prev` is the SHA-256 of the previous audit event's
  canonical line (the line minus its own `prev:` segment, trimmed, NFC).

A verifier recomputes the chain; any inserted, deleted, reordered, or edited
approval breaks a `prev` link. A plain `approve:` line without `prev:` is an
**un-chained** link — reported as such, never as tampered. The reference
implementation is `verifyAuditChain()` / `appendApproval()`.

## 7. Revocation

A certification verifies forever against the trust anchor, so revocation is an
out-of-band signal. A UTS operator publishes a **revocation list** (e.g.
`GET /revocations`) of entries that revoke either a **content hash** or an entire
**signing key**. A verifier that consults the list MUST treat a certification whose content
hash or signing key is revoked as **not trusted** (tier `draft`), regardless of the
signature being otherwise valid.

## 8. Verification algorithm (summary)

Given a document `source` and a set of trusted issuer (root/key) public keys:

1. If `source` is a template → tier `template`; stop.
2. Compute `contentHash` (Section 2).
3. **Seal:** if a `freeze:` exists, `intact = (contentHash == freeze.hash)`.
4. **Signatures:** for each cryptographic `sign:` line, verify per §4.1.
5. **Certifications:** for each `certify:` line, verify per §5.2; if revocation data is
   available, apply Section 7.
6. Derive the tier (Section 3): any broken layer ⇒ `draft`.

## 9. Backward compatibility

`@dotit/core` < 1.9.0 hashed **without** NFC normalization. For documents sealed/signed
before 1.9.0, a verifier MUST also accept the **legacy** hash (the same computation as
Section 2 but skipping step 4). The reference implementation exposes this as
`computeDocumentHashLegacy()` / `hashMatches()`, and verification succeeds if **either**
the NFC or the legacy hash matches. New documents always carry the NFC hash.

## 10. Implementation notes

- Trust-line detection is by the line's keyword prefix; a body line that merely *contains*
  the word "sign" is not a trust line.
- All base64url is unpadded; decoders MUST reject non-base64url input rather than produce
  partial bytes.
- The reference implementation lives in `@dotit/core` (`trust.ts`, `seal.ts`) and
  `@dotit/sign`. This document is normative where it and the code disagree the code SHOULD
  be corrected to match, or this document updated in lockstep.
