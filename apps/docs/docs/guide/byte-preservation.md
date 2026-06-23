---
title: Byte Preservation (authoring & storage discipline)
description: Why a .it file preserves the author's exact bytes — and the tools that keep a sealed document verifiable through editing, storage, and round-tripping. reconcileEdit, the storage contract (bytesSha256), and how this differs from what the seal actually hashes.
---

# Byte preservation — authoring & storage discipline

There are **two different guarantees** at play in a `.it` file, and keeping them straight
is the whole point of this page:

1. **Byte preservation** (this page) — the author's exact bytes are kept. No tool
   reformats, reorders, or re-encodes the file behind your back. This is good *authoring
   and storage hygiene*: minimal diffs, faithful round-trips, drift you can detect.
2. **The seal** (see [Trust & Signing](./trust-and-signing#what-exactly-gets-hashed)) — a
   SHA-256 hash over the document's **canonical content** under a recorded `spec:`
   (currently 4). The seal deliberately **excludes** styling (`page:`/`font:`/`style:` +
   presentation properties) and comments, and **normalizes** line endings (CRLF/CR→LF)
   and trailing whitespace before hashing. So restyling, reformatting, and CRLF/whitespace
   changes **never** break a seal — only a real content change does.

The crucial corrective: **preserving the author's exact bytes is NOT what the seal
enforces.** You can reflow line endings, trim trailing spaces, or restyle a sealed
document and it still verifies. Byte preservation is about the *file you store and diff*;
the seal is about the *content you agreed to*. They are complementary, not the same hash.

Still, the discipline matters. IntentText holds this rule:

> **No tool may auto-format, reformat, reorder, or canonicalize a `.it` file.**
> What the author wrote is preserved — minimal diffs, faithful round-trips.

This page explains how that rule is kept across the three places bytes are most at risk —
**editing**, **storage**, and **round-tripping** — and the APIs that enforce it.

## The lossless foundation

The parser and serializer are a **lossless round-trip**. Parsing keeps each block's
formatting trivia — leading blank lines, the exact keyword spelling (English or its
Arabic localized name), merged inline lines, bare-prose flags — and the serializer re-emits
them verbatim:

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
form. Re-emitting only changes *bytes* — and because the seal hashes canonical content
(not bytes), pure reformatting still verifies. But hand-rebuilding a document is also where
real content can get dropped or reordered, which **would** break the seal. Edit sealed
documents through `reconcileEdit` (below), which only ever re-serializes blocks that
genuinely changed, so you get minimal diffs *and* never risk content drift.
:::

## Editing without breaking the seal: `reconcileEdit`

A visual editor is the biggest threat to byte preservation. Editors like the
[IntentText editor](../ecosystem/editor) work on a document *model* (TipTap), and turning
that model back into text re-serializes the **whole document** — reformatting blocks the
user never touched. The seal would survive that (it hashes canonical content, not bytes),
but the *diff* would be enormous and unreviewable, and re-serializing the whole document
is the one place subtle content changes can slip in.

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
string out. A storage or transport layer can *silently* re-encode — trim trailing
newlines, rewrite `\n` to `\r\n`, or normalize Unicode. Most of those (CRLF, trailing
whitespace, NFC) the **seal tolerates** under spec 4, so verification still passes. But
they still mutate the bytes you stored, which means noisier diffs and a file that no longer
matches what you wrote. `@dotit/core` ships a DB-safe contract that makes such drift
**detectable** — so byte changes are caught, not silently absorbed:

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
JSON round-trips with **minimal, reviewable diffs** and its **content hash intact**. Two
guarantees, working together: byte preservation keeps the file you store faithful to what
the author wrote, and the seal — which hashes canonical content, not raw bytes — keeps the
*agreement* tamper-evident even when styling or line endings change.

---

**Related:**

- [Trust & Signing →](./trust-and-signing) — what gets hashed, and the seal lifecycle
- [Approval Workflows →](./approval-workflows) — policy + audit that live in preserved lines
- [The Editor →](../ecosystem/editor) — change-aware editing that preserves the source
- [Conformance →](../reference/conformance) — the lossless round-trip as a conformance level
