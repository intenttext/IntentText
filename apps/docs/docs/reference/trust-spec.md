---
sidebar_position: 16
title: Trust & Integrity Specification
---

# Trust & Integrity Specification

This is the normative reference for how an `.it` document's **integrity**, **signatures**,
and **certifications** are computed and verified. It is the contract that independent
implementations (and enterprise/legal reviewers) can rely on. It complements the
[keyword reference](./index.md); here we specify only the trust layer.

> **Status:** `SEAL_SPEC = 4` (matches `@dotit/core` ≥ 1.22.0 and `@dotit/sign` ≥ 1.4.1).
> Every seal/signature **stamps the `spec:` version** that produced its hash, and a
> verifier applies exactly that version forever, so a rule change can never silently break
> a historical seal — see [Versioning & backward compatibility](#9-versioning--backward-compatibility).
> The canonical, byte-level definition is
> [SPEC §4](https://github.com/intenttext/IntentText/blob/main/packages/core/SPEC.md); this
> page is the reference summary.

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

Hashing is **versioned**. The current ruleset is **`spec: 4`** (`SEAL_SPEC = 4`); each
shipped version is frozen forever (`CANONICALIZERS` in `trust.ts`):

| spec | rules |
| ---- | ----- |
| v0 | raw bytes (pre-NFC) |
| v1 | NFC normalization |
| v2 | NFC; excludes comments; the seal scope covers signatures |
| v3 | NFC; **also excludes styling**, covers the seal's own metadata, and **binds the signer identity** |
| **v4** (current) | v3 **plus** line-ending (`CRLF`/lone-`CR` → `LF`) + trailing-whitespace normalization before hashing (an `LF`↔`CRLF` re-save never breaks a seal); new seals also record an **`appearance:`** full-fidelity hash so a post-seal restyle that *hides* content is flagged (`appearanceChanged`) |

There are **two scopes**. A hash covers one of them:

- **content** — each `sign:` line's hash. Co-signers commit to the same content, so adding
  a signature never changes it.
- **seal** — the `freeze:` line's hash. Covers the content **+ the signatures + the
  `freeze:` line's own metadata**, so tampering the body, *a signature*, or *the seal
  metadata* all break it.

The **v4 hash** (`computeDocumentHash` / `computeSignatureHash`) is computed as follows:

1. Take the **body** (text before the history boundary; the whole document if there is no
   boundary).
2. Split into lines on `\n`. **Drop comments** — any line whose trimmed text begins with `//`.
3. **Drop styling** — whole presentation lines (`page:`, `font:`, `style:`) and presentation
   *properties* on content lines (`color`, `size`, `family`, `align`, `bg`, `indent`,
   `leading`, `space-before/after`, `opacity`, `border`, `valign`, `theme`, `margin(s)`,
   `orientation`, `width`, `height`). **Restyling MUST NOT break a seal** ("sign content,
   not presentation").
4. **Apply the scope to the trust lines:**
   - *content scope:* remove every line beginning `sign:`, `freeze:`, `certify:`, or
     `amendment:`.
   - *seal scope:* keep `sign:` lines whole; keep the `freeze:` line with its own `hash:`
     value **blanked** (its `at:`/`status:`/`spec:` stay, so editing them breaks the seal);
     remove `certify:`/`amendment:`.
5. **NFC-normalize**, join the remaining lines with `\n`, trim, and `SHA-256` over the UTF-8
   bytes, formatted `sha256:` + lowercase hex. NFC makes precomposed `é` U+00E9 and
   decomposed `e`+◌́ hash the same, so re-saving in another editor does not invalidate a seal.
6. **Signature identity** (content scope only): a signature hash appends
   `sig:<signer>|<role>|<at>` to the body before hashing, so editing the signer's
   name/role/date breaks *that* signature — even before the document is sealed.

```
hash = "sha256:" + hex( SHA-256( NFC( trim( scopedBodyLines.join("\n") ) ) ) )
```

What the hash covers and what it does **not**:

- **Covered:** every body content line (title, text, sections, tables, `approve:`, …),
  their order, and their exact text (post-NFC); the signatures and seal metadata (seal scope).
- **Not covered:** styling (presentation lines/properties), comments (`//`), the trust
  lines themselves (per scope), and anything in the history section. **Restyling and
  re-commenting a sealed document leave its hash intact.**

## 3. Trust tiers

A verifier derives one headline **tier** from the verified (not claimed) state:

| Tier | Condition |
| --- | --- |
| `template` | the document is a template (`{{…}}`, `input:`, or `meta: … type: template`) — **outside** the trust workflow; cannot be sealed/signed/certified |
| `draft` | no verifiable trust layer |
| `broken` (red) | a trust layer is present but **failed** to verify — a tampered seal, a signature that no longer matches, or a certification whose signature fails |
| `signed` | ≥1 cryptographic signature that verifies against the current content (no intact seal) |
| `sealed` (indigo) | an intact `freeze:` seal |
| `certified` | a valid UTS certification (Section 5) |
| `root-certified` | a valid certification that **chains to the UTS root** via an `ica:` token |

A failed layer MUST surface as `broken` — never show a clean/higher tier over a layer that
failed. This is honest tamper-evidence; the **integrity gate** (`renderTrustBand`)
enforces it on every rendered surface (Section 8.1).

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
sign: NAME | role: ROLE | at: DATE | hash: sha256:… | spec: 4
```

A `sign:` line **without** `key:`+`sig:` is an **integrity-only on-record claim**. Under
`spec: 4` its `hash:` is the **content** scope and **binds the signer identity** (the
`NAME | ROLE | DATE`), so editing either the content *or* the named signer breaks that
signature — even before the document is sealed. It is still **not** cryptographic proof of
*who* signed (anyone can type a name) and MUST NOT be presented as verified identity;
verifiers MAY surface it as "on record." Proving *who* is the layer above (Section 4.1 /
certification).

## 5. Seal and certification

### 5.1 Seal (`freeze:`)

```
freeze: | at: ISO8601 | hash: sha256:… | spec: 4 | status: locked
```

The document is **sealed**. It is **intact** iff the current **seal-scope** hash (Section 2,
computed under the line's recorded `spec:`) equals the `hash` field. Because the seal scope
covers the content **and** the signatures **and** the `freeze:` line's own metadata, any
change to the body, *a signature*, or the seal's `at:`/`status:` breaks it. A seal proves
**integrity** (content unchanged since sealing) and binds each signer's claimed identity; it
does not by itself prove *who* sealed it.

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
2. For each trust line, read its recorded **`spec:`** and apply **that version's**
   canonicalizer (Section 2). Compute the **seal-scope** hash for `freeze:` and the
   **content-scope** hash for each `sign:`.
3. **Seal:** if a `freeze:` exists, `intact = (sealHash == freeze.hash)`; surface `spec`
   and `specOutdated` (the recorded version predates `SEAL_SPEC`).
4. **Per-signer:** report each signer's `signedCurrentVersion` — whether their
   content-scope hash (identity-bound) still matches. **Multi-sign aware:** a signer who
   signed an earlier version is reported as such, never a blanket failure.
5. **Signatures:** for each cryptographic `sign:` line, verify per §4.1.
6. **Certifications:** for each `certify:` line, verify per §5.2; if revocation data is
   available, apply Section 7.
7. Derive the tier (Section 3): any failed layer ⇒ `broken`.

### 8.1 Integrity gate (rendering)

A conforming renderer of the on-document trust band (`renderTrustBand`) MUST **verify
before it draws**: if verification fails, it renders a red **"SEAL BROKEN"** stamp — on
screen, in print, and in PDF — and MUST NOT render a clean `sealed`/`signed` band over a
failed layer.

## 9. Versioning & backward compatibility

Every seal/signature **stamps the `spec:` version** that produced its hash, and a verifier
applies exactly that version forever (`CANONICALIZERS`), so a future rule change can never
silently break a historical seal. Older specs stay valid: a seal stamped `spec: 1` or `2`
is verified under v1/v2 rules and reported as `specOutdated` (re-seal to upgrade to v4).

For legacy documents written **before** versioning (no `spec:` field): `@dotit/core` < 1.9.0
hashed without NFC, so a verifier MUST also accept the **legacy** (pre-NFC) hash. The
reference implementation exposes `computeDocumentHashLegacy()` / `hashMatches()`, and
verification succeeds if **any** recognized version's hash matches. New documents always
carry `spec: 4`.

## 10. Implementation notes

- Trust-line detection is by the line's keyword prefix; a body line that merely *contains*
  the word "sign" is not a trust line.
- All base64url is unpadded; decoders MUST reject non-base64url input rather than produce
  partial bytes.
- The reference implementation lives in `@dotit/core` (`trust.ts`, `seal.ts`) and
  `@dotit/sign`. This document is normative where it and the code disagree the code SHOULD
  be corrected to match, or this document updated in lockstep.
