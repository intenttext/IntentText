---
title: Byte Preservation (the trust moat)
description: Why every byte of a .it file is sacred — and the tools that guarantee a sealed document keeps its seal through editing, storage, and round-tripping. reconcileEdit, the storage contract, and the rules that never break a hash.
---

# Byte preservation — the bytes are sacred

The seal on a `.it` document is a SHA-256 hash of its **exact bytes**. That is the whole
basis of trust: anyone, anywhere, offline, can recompute the hash and know the document
hasn't changed. It also means the guarantee is *fragile by design* — change a single
byte and the seal is gone. A tool that "helpfully" reformats your file, normalizes its
whitespace, reorders properties, or converts line endings has **broken the seal**, even
though it changed nothing a human would notice.

So IntentText holds one rule above all others:

> **No tool may auto-format, reformat, reorder, or canonicalize a `.it` file.**
> What the author wrote is preserved byte-for-byte. The bytes are sacred.

This page explains how that rule is kept across the three places bytes are most at risk —
**editing**, **storage**, and **round-tripping** — and the APIs that enforce it.

## The lossless foundation

The parser and serializer are a **lossless round-trip**. Parsing keeps each block's
formatting trivia — leading blank lines, the exact keyword or alias spelling, merged
inline lines, bare-prose flags — and the serializer re-emits them verbatim:

```typescript
import { parseIntentText, documentToSource } from "@dotit/core";

documentToSource(parseIntentText(source)) === source;   // true, byte-for-byte
```

This is **property-tested**: a permanent gate generates thousands of documents with
properties in arbitrary order and asserts the round-trip (and `reconcileEdit`, and a
sealed doc surviving a no-op save) holds for every one — see
[`packages/core/tests/byte-preservation.test.ts`](https://github.com/intenttext/IntentText/blob/main/packages/core/tests/byte-preservation.test.ts).
It's what lets a sealed document survive a parse → JSON → serialize cycle (for indexing,
diffing, or storage) and still verify.

### Why this stays true: the parser is a faithful recorder

The deeper reason the round-trip holds is architectural. The parser **records only what
the author wrote** — it does not bake defaults, coercions, or normalizations into the
stored model. A bare `step:` is stored as a bare `step:`; its default `status: pending` is
not written into the document. Block-type defaults are applied at **read time** (by the
renderer, query, and index, via `effectiveProperties`), never at parse time. So serializing
is just replaying what was recorded — there is nothing to "un-inject," and no transformation
the serializer has to remember to invert. Every transformation a parser bakes in is a
round-trip liability; this core keeps that set empty. (`effectiveProperties` /
`effectiveField` are exported if your own code needs a block's interpreted values.)

:::note One realistic boundary — metadata position
Property order, prose, sections, and content blocks round-trip in the **exact order
authored**. The one thing the serializer *does* place canonically is document-level
**metadata** — `title:`, `summary:`, `meta:`, `page:`, `header:`, `footer:` — which is
hoisted to the document header. This is invisible in practice because metadata is always
authored at the top (and the editor keeps it there); scattering `title:` into the middle
of the body is the only case it normalizes. Keep metadata at the top — as every real
document does — and the round-trip is byte-exact.
:::

:::warning One sharp edge
`documentToSource` reproduces *parsed* blocks exactly, but if you **construct** blocks in
code (not from `parseIntentText`) they have no trivia, so they serialize in canonical
form. Never rebuild a sealed document from hand-made blocks and re-serialize — you'll get
clean output with a *broken seal*. Edit sealed documents through `reconcileEdit` (below),
which only ever re-serializes blocks that genuinely changed.
:::

## Editing without breaking the seal: `reconcileEdit`

A visual editor is the biggest threat to byte preservation. Editors like the
[IntentText editor](../ecosystem/editor) work on a document *model* (TipTap), and turning
that model back into text re-serializes the **whole document** — reformatting blocks the
user never touched. For a sealed contract that's fatal.

`reconcileEdit(originalSource, editedSource)` solves this at the source level, independent
of any editor. For each block in the edited document, if a **semantically identical** block
(same type, content, properties, and children) existed in the original, the *original*
block — with its exact original bytes — is kept. Only blocks that genuinely changed take
the new serialization:

```typescript
import { reconcileEdit } from "@dotit/core";

const saved = reconcileEdit(originalSource, editorOutput);
```

The consequences are exactly what trust needs:

- **A no-op edit round-trips byte-for-byte.** Open a sealed document, change nothing, save
  — the bytes are identical and **the hash still verifies**.
- **A real edit touches only what changed.** Fix a typo in one paragraph and every other
  block keeps its original formatting down to the byte. Diffs stay minimal and reviewable.

```typescript
// Opening and saving a sealed document with no changes does not break it:
reconcileEdit(sealedSource, sealedSource) === sealedSource;   // true
```

The [editor](../ecosystem/editor) wires this in automatically and, as a second line of
defense, makes **sealed documents read-only** — but `reconcileEdit` is a pure function you
can use anywhere you accept edited `.it` text from any source.

## Storing without re-encoding: the storage contract

A `.it` file is just a UTF-8 string, so it goes in any `TEXT`/blob column, string in,
string out. The only real risk is a storage or transport layer that *silently* re-encodes
— trims trailing newlines, rewrites `\n` to `\r\n`, or normalizes Unicode. Any of those
changes the bytes and breaks the seal. `@dotit/core` ships a DB-safe contract that makes
such corruption **detectable**:

```typescript
import { toStorageRecord, fromStorageRecord, verifyStorageRecord } from "@dotit/core";

const record = toStorageRecord(sealedSource);   // { source, bytesSha256 } — persist both
// … write `record` to your database, queue, blob store …

const restored = fromStorageRecord(record);     // byte-exact restore (throws if bytes drifted)
const intact = verifyStorageRecord(record);     // boolean: did the bytes survive the round-trip?
```

`bytesSha256` is a hash of the **raw stored bytes** — distinct from, and complementary to,
the document content hash:

| Hash | Covers | Answers |
| --- | --- | --- |
| **Document seal** (`sign:`/`freeze:` `hash:`) | the canonical hashed body (see [the spec](./trust-and-signing#what-exactly-gets-hashed)) | "Has the *content* changed since sealing?" |
| **Storage `bytesSha256`** | every byte of the stored string | "Did the *storage layer* alter the file in transit?" |

Use the storage contract whenever a `.it` leaves your process — into a database, a message
queue, an object store — and you want a guarantee, not a hope, that it came back unchanged.

## Round-tripping for indexing and diffing

You often need the JSON model — to index fields, run a query, or diff two versions — without
disturbing the stored bytes. Because the round-trip is lossless, that's safe:

```typescript
import { parseIntentText, documentToSource } from "@dotit/core";

const model = parseIntentText(sealedSource);    // inspect / index / query the model
// … the stored source is untouched; documentToSource(model) reproduces it exactly …
```

Read freely from the model. Just never **store back** a re-serialized sealed document
unless it went through `reconcileEdit` — reconstruction from a mutated or hand-built model
is the one path that reformats untouched blocks.

## The rules, in one place

1. **Tools never auto-format.** No reformat, no reorder, no canonicalize on read or save.
2. **Edit through `reconcileEdit`.** It re-serializes only changed blocks; unchanged blocks
   keep their original bytes (and the seal).
3. **Sealed documents are read-only in the editor** by default — a belt-and-suspenders
   guard on top of rule 2.
4. **Store through the storage contract** when bytes leave the process, so any re-encoding
   is caught, not silently absorbed.
5. **Read from the model freely; store back only via `reconcileEdit`.** The lossless
   round-trip is for inspection, not for rewriting sealed bytes from scratch.

Follow these and a sealed `.it` survives editing, databases, queues, object stores, and
JSON round-trips with its hash intact — which is the entire point. The trust *is* the moat,
and the moat is the bytes.

---

**Related:**

- [Trust & Signing →](./trust-and-signing) — what gets hashed, and the seal lifecycle
- [Approval Workflows →](./approval-workflows) — policy + audit that live in preserved lines
- [The Editor →](../ecosystem/editor) — change-aware editing that preserves the source
- [Conformance →](../reference/conformance) — the lossless round-trip as a conformance level
