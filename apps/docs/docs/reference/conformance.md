---
title: Conformance
description: Conformance levels and the validation model — what "a conformant .it document" and "a conformant implementation" mean, so procurement can verify by test, not opinion.
---

# Conformance

This page defines what it means for a `.it` **document** to be conformant and for an
**implementation** to conform — so an enterprise or government reviewer can answer
"is this conformant?" with a test, not an opinion.

## Conformance levels

An implementation declares the highest level it supports. Each level includes all
lower levels.

| Level | Name | An implementation MUST… |
|---|---|---|
| **L1** | **Core** | Parse the [core block types](./keywords/structure), preserve unknown keywords as `custom` blocks, and **round-trip losslessly** — `parseIntentText(documentToSource(doc))` reproduces the document, and after a single canonicalizing pass `documentToSource(parseIntentText(src))` is an idempotent fixpoint (canonical-form + information losslessness, SPEC §5.1). |
| **L2** | **Validated** | L1 + run [semantic validation](#validation-model) and report structured diagnostics (code + severity + location). |
| **L3** | **Trust** | L2 + the [Trust & Integrity Specification](./trust-spec): content hash, signatures, seal, certification, approval routing, and the hash-chained audit trail — verifiable **offline**, with no external service. |

A vendor statement then reads, e.g.: *"Conforms to IntentText Specification v4.1,
Conformance Level 3."*

## Document conformance

A document is **well-formed** at L1 if it parses (it always does — unknown keywords
degrade to preserved `custom` blocks, never errors) and round-trips losslessly: canonical
text round-trips byte-for-byte, and any text reaches a stable fixpoint after one
canonicalizing serialize pass (SPEC §5.1). Note that **byte preservation is storage hygiene,
not what a seal enforces** — see [Document seals keep their hash across formatting](#document-seals-keep-their-hash-across-formatting).

A document is **valid** at L2 if `validateDocumentSemantic()` reports no `error`-severity
diagnostics. `warning`/`info` diagnostics do not make a document invalid — they flag
quality issues (e.g. a non-ISO date) a conformant tool SHOULD surface but MAY accept.

A document is **trusted** at L3 per the trust tiers in the
[Trust Specification](./trust-spec#3-trust-tiers): a broken hash, signature, or
audit-chain link drops the document to tier `draft`.

## Validation model

The reference validator (`@dotit/core`, `validate.ts` / `schema.ts`) is **normative**
for diagnostics — it is the single source of truth for the code set, so this page
does not duplicate (and risk drifting from) the list. Each diagnostic carries:

- a stable **`code`** (e.g. `DATE_NOT_ISO`, `DUPLICATE_STEP_ID`, `SIGN_HASH_INVALID`,
  `AMENDMENT_WITHOUT_FREEZE`),
- a **severity** — `error` (fails L2 validity), `warning`, or `info`,
- the **block** it applies to (id + type) and a human message.

Categories the validator covers: document structure, ISO dates, agentic workflow
references (step/decision/parallel/call/gate…), trust lines (sign/freeze/amendment/
track), content blocks (cite/ref/def/metric/figure/contact/deadline), and print
layout (header/footer/watermark require a `page:`). Enumerate the live set with:

```ts
import { validateDocumentSemantic, parseIntentText } from "@dotit/core";
const { issues } = validateDocumentSemantic(parseIntentText(src));
// each issue: { code, type: "error"|"warning"|"info", blockId, blockType, message }
```

```bash
dotit <file.it> --validate <schema>   # CLI: exit 0 = valid, 1 = invalid
```

## The conformance checker — `checkConformance`

`@dotit/core` ships the reference conformance checker. It is **read-only** (it never
rewrites the document) and layers the parser's structural diagnostics over
`validateDocumentSemantic`, so a single call answers "is this conformant?" at a chosen level:

```ts
import { checkConformance } from "@dotit/core";

const report = checkConformance(source, { level: "strict" });
// → {
//     conformant,        // boolean — gate producers on this
//     level,             // "lax" | "strict" — the level checked
//     errors,            // number — count of error-severity issues
//     warnings,          // number — count of warning-severity issues
//     issues,            // Issue[] — { code, type, blockId, blockType, message }
//   }
```

Producers gate on `conformant`; tooling surfaces `issues`. Two levels (SPEC §8):

| Level | `{ level }` | Conformant when… | Use for |
|---|---|---|---|
| **lax** | `"lax"` (default) | no **error**-level issues (e.g. no unterminated code fence, no table row without a header) | the everyday "does it parse and hold together" bar |
| **strict** | `"strict"` | no errors **and** no warnings (e.g. every date is ISO 8601, no missing recommended properties) | the level a publisher certifies for a spotless document |

Unknown keywords are **not** errors at either level — they pass through as `custom` blocks
(the open-keyword guarantee), so using domain vocabulary never makes a document
non-conformant. `checkConformance` is the canonical implementation of the L2 "valid" gate
above; `level: "strict"` additionally treats warnings as failures.

## Document seals keep their hash across formatting

Conformance asks "does it parse and validate"; it is **independent of sealing**. A common
misconception is that a seal records the document's exact bytes — it does not. A seal is a
**SHA-256 hash over the document's content** under a recorded `spec:` (currently 4). Under
`spec: 4` the hash **excludes styling and comments** and **normalizes line endings**
(`CRLF`/lone-`CR` → `LF`) and per-line trailing whitespace **before** hashing — so
restyling, reformatting, an `LF`↔`CRLF` re-save (Windows `git autocrlf`, a mail gateway), or
a trailing-space change **never breaks a seal**; only a real content change does. A separate
`appearance:` hash flags a post-seal restyle that *hides* content. **Preserving exact bytes
is storage hygiene, not what the seal enforces** — so a conformant tool may re-serialize a
sealed document to canonical form and it still verifies. The full byte-level definition is in
the [Trust & Integrity Specification](./trust-spec).

## How to verify conformance

1. **Round-trip (L1):** parse → serialize → parse; assert the model is equal, and that a
   second serialize pass is byte-identical to the first (the canonical fixpoint — see the
   round-trip tests in `@dotit/core`).
2. **Validation (L2):** run `validateDocumentSemantic`; assert zero `error` issues for
   documents you expect to be valid, and the expected `code` for documents you expect
   to fail.
3. **Trust (L3):** run `verifyDocument` / `verifyAuditChain` and assert the tier and
   intactness per the [Trust Specification](./trust-spec).

A **conformance-vector corpus** lives in `packages/core/fixtures/` — canonical `.it`
inputs paired with golden normalized-JSON outputs, covering structure, tasks, trust
(sign/approve/freeze), metric, form, lists, bare prose, workflow routing, and RTL
Arabic. The package test suite (`tests/fixtures.test.ts`) asserts every parse matches
its golden, so the corpus is the executable definition of L1 conformance.
