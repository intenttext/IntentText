# IntentText for AI Agents — the one file

You are an AI agent or coding agent that needs to **author, read, seal, verify, query, and
transform `.it` (IntentText) documents**, and drive the `@dotit/*` packages. This single
file is everything you need to be **100% compliant** with the format and to interact with
the whole toolchain. If you read and follow only this file, you will produce valid `.it`
and never break a seal.

Canonical, deeper sources (this file is the agent-facing summary of them):
the byte-level spec is [`packages/core/SPEC.md`](packages/core/SPEC.md); the full docs are at
**https://dotit.uts.qa**; the per-package API is [`apps/docs/docs/ecosystem/core-api.md`](apps/docs/docs/ecosystem/core-api.md).

---

## 1. The format in 60 seconds

A `.it` file is UTF-8 plain text. **One line = one intent.** Every line follows:

```
keyword: value | property: value | property: value
```

- The **keyword** before the first `:` gives the line its meaning (`task:`, `metric:`, `sign:`).
- The first chunk after `:` is the **content**. Everything after a `|` is a **property** (`key: value`).
- **Bare prose**: a line with *no* keyword is a `text:` block. Write natural prose; reach for
  keywords only when a line needs a specific meaning.
- **Sections**: `section:` is an H2, `sub:` is an H3. Blocks belong to the section above them.
- **Comments**: `//` anywhere. **Divider**: a line that is just `---`.
- **No significant whitespace, no nesting, no closing tags.** Indentation is cosmetic.

```intenttext
title: Vendor Agreement

The parties agree to the terms below. This line is bare prose — a text block.

section: Payment
metric: amount | value: 24000 | unit: USD
task: Send invoice | owner: Finance | due: 2026-07-01
```

---

## 2. Authoring rules you MUST follow

1. **One intent per line.** Never put two blocks on one line.
2. **Dates are ISO 8601** in date-bearing properties (`date:`, `due:`, `at:`, `expires:`,
   `issued:`) → `2026-07-01`. This makes date queries and sorting work.
3. **Escape a literal pipe** in content or a value as `\|`. Colons never need escaping.
   Backslash escapes as `\\`.
4. **Code uses triple backticks** to wrap the value; properties go after the closing fence:
   ````
   code: ```const x = 1;``` | lang: js
   ````
   Multi-line code opens with ` ``` ` and closes on its own line.
5. **Bare prose is preferred for prose**, but a line stays explicit (keep the keyword) if it
   would otherwise parse as something else — it is NOT bare when it: looks like `word:`,
   starts a list (`- ` / `1. `), opens a code fence, is a divider (`---`), a comment (`//`),
   begins with `|`, or is empty.
6. **Never invent syntax.** Any `word: …` you don't find below still parses as a typed
   `custom` block (the *unknown-keyword guarantee*) — so domain keywords are safe, but use
   the canonical keyword when one fits.
7. **NEVER reformat an existing `.it` file.** See §6 — the bytes are sacred.

---

## 3. The complete keyword set

**38 canonical keywords**, by category. Use these first.

| Category | Keywords |
| --- | --- |
| **Identity** | `title:` `summary:` `meta:` `context:` |
| **Structure** | `section:` `sub:` `toc:` |
| **Content** | `text:` `info:` `quote:` `cite:` `code:` `image:` `link:` |
| **Tasks** | `task:` `done:` `ask:` |
| **Data** | `columns:` `row:` `metric:` |
| **Agent/workflow** | `step:` `decision:` `gate:` `trigger:` `result:` `policy:` `audit:` |
| **Trust** | `track:` `approve:` `sign:` `freeze:` `amendment:` |
| **Layout (print/PDF)** | `page:` `header:` `footer:` `watermark:` `style:` `break:` |

**Structural / machine-managed:** `history:` (boundary — everything below is managed
history), `revision:` (a history entry), `---` (divider).

**Extension keywords** (specialized; also valid): `byline:` `epigraph:` `figure:` `caption:`
`footnote:` `dedication:` `def:` `contact:` `deadline:` `ref:` `signline:`, the agent-flow
set `loop:` `parallel:` `retry:` `wait:` `handoff:` `call:` `checkpoint:` `error:`, and the
`x-writer:` / `x-doc:` / `x-agent:` namespaces.

**Aliases** resolve to canonical and **round-trip as written** — including 33 Arabic aliases
(`عنوان:`→`title`, `مهمة:`→`task`, `صف:`→`row`, `توقيع:`→`sign`, …) and shorthands (`todo:`→`task`,
`note:`→`text`). Callout shorthands: `warning:` `danger:` `tip:` `success:` = `info: | type: …`.

**In-file approval policy** (parse as preserved custom blocks, not core keywords):
`route: sequential|parallel` and `require: <role> | when: <cond> | optional: yes`.

---

## 4. The trust model — what makes `.it` special

Trust is three opt-in layers, each verifiable **offline, forever**, with nothing but the file.

1. **Integrity** (`@dotit/core`) — a SHA-256 **seal** over the exact bytes. `sign:`/`freeze:`
   carry the hash. Tamper-evident: change one byte of the hashed body and verify fails.
2. **Identity** (`@dotit/sign`) — an **Ed25519** signature binding a key to that hash.
3. **Authority** (`@dotit/sign` + UTS) — a `certify:` line binding the key to a verified org,
   chaining root→intermediate.

**What gets hashed** (you must respect this when generating sealed docs): the **content**
above the `history:` boundary, NFC-normalized, joined with `\n`, trimmed, UTF-8, LF line
endings → `sha256:` + hex. The hash is **versioned** — every `sign:`/`freeze:` stamps a
`spec:` (current = **`SEAL_SPEC = 3`**), and verification uses the *recorded* spec forever,
so old seals never silently break. Under v3 the hash **excludes**:
- **Comments** (`//` lines) and **styling** — whole presentation lines (`page:`/`font:`/`style:`)
  and presentation props (`color`, `size`, `align`, `bg`, `leading`, `margin`, `theme`, …).
  **Restyling never breaks a seal** ("sign content, not presentation").
- The trust lines per scope: a `sign:` line's hash drops `sign:`/`freeze:`/`certify:`/`amendment:`
  and **binds the signer identity** (signer/role/at are folded in, so editing them breaks that
  signature); the `freeze:` (seal) hash keeps the `sign:` lines and the `freeze:` line's own
  `at:`/`status:`/`spec:` metadata, so tampering them breaks the seal.

`approve:` lines are ALWAYS hashed (an approval is part of what gets approved).
`verifyDocument()` reports per-signer `valid` / `signedCurrentVersion` (multi-sign aware) plus
`spec` / `specOutdated`; `renderTrustBand()` **verifies before drawing** — a tampered doc shows a
red **SEAL BROKEN** stamp, never a clean seal.

**The lifecycle:** `draft → track → approve → sign → freeze → amend`.

**In-file workflow (derived, never stored):**
- `route:`/`require:` declare who must approve, in what order, conditionally.
- `workflowState(source)` derives `{ pending, next, complete, … }` from the policy + `approve:` lines.
- `appendApproval()` adds a **hash-chained** `approve:` (`prev:` = hash of prior event) so the
  approval *order* is tamper-evident; `verifyAuditChain(source)` reports the first broken link.

**Honest scope** — state this accurately, never overclaim:
- ✅ Integrity is self-proving (offline, no anchor). SEAL_SPEC 3 is the integrity **floor**:
  the content and the *claimed* signer are tamper-evident.
- ⚠️ Authenticity (proving *who*) is a ladder **above** the hash — a typed name is only a claim.
  Inside an ERP: authenticate the user and fill the signer from the session, then sign with a
  bound key/attestation (Level 0). Cross-org: ed25519 + a shared CA `certify:` chain. Court:
  qualified PAdES. (See `INTEGRATION.md` §2.9b / `docs-internal/identity.md`.)
- ⚠️ Time inside the file (`at:`) is **self-asserted**. Provable time = an RFC-3161 timestamp,
  available on the **PAdES** PDF export (`@dotit/pades`), not the native `.it`.

---

## 5. The packages — install + the calls that matter

All TypeScript/JS. `@dotit/core` is zero-dependency; the rest are opt-in layers.

### `@dotit/core` — parse, render, query, merge, trust (the everything package)
```ts
import {
  parseIntentText, documentToSource, reconcileEdit,        // model + byte-safe edits
  renderHTML, renderPrint,                                  // output
  queryBlocks, queryDocument,                               // query
  mergeData, parseAndMerge,                                 // templates {{var}}
  sealDocument, verifyDocument, computeDocumentHash,        // integrity seal
  workflowState, appendApproval, verifyAuditChain, auditTrail, // in-file workflow
  toStorageRecord, fromStorageRecord, verifyStorageRecord,  // byte-exact DB storage
  applyAnswers, isFormComplete, sealFormStructure, verifyFormStructure, // forms
  compareVersions, mergeThreeWay,                           // redline / co-author
  applyRedactions, verifyRedaction, addAttachment,          // redaction / attachments
} from "@dotit/core";

const doc = parseIntentText(src);                 // → structured model (lossless)
const { source, hash } = sealDocument(src, { signer: "Ahmed", role: "CEO" });
verifyDocument(source).intact;                    // boolean
```

### `@dotit/sign` — Ed25519 identity + UTS certification
```ts
import { generateSigningKey, signDocumentCrypto, verifyCryptoSignatures,
         certifyDocument, verifyCertifications, issueIntermediate } from "@dotit/sign";
const key = generateSigningKey();                 // { privateKey, publicKey }
const { source } = signDocumentCrypto(src, { signer: "Ahmed", role: "CEO", privateKey: key.privateKey });
verifyCryptoSignatures(source);                   // [{ signer, valid, … }]
```

### `@dotit/pdf` — server-side PDF (needs puppeteer)
```ts
import { renderPDF, issuePDF, renderSignedPDF, toPdfA, createPdfRenderer } from "@dotit/pdf";
const pdf = await renderPDF(src, { theme: "corporate" });   // tagged (accessible) by default
const { source, pdf: bytes } = await issuePDF(template, data, { signer: "Billing", theme: "corporate" });
```

### `@dotit/pades` — legally-recognized PDF signatures (ECDSA/X.509/CMS) + trusted time
```ts
import { signPdf, verifyPdfSignature, requestTimestampToken, PUBLIC_TSA } from "@dotit/pades";
```

### `@dotit/math` — MathML / KaTeX rendering for `math:` blocks and inline `[…]{math: tex}`
```ts
import { renderMathInHtml } from "@dotit/math";
const html = await renderMathInHtml(coreHtml);
```

### `@dotit/mcp` — drive everything over MCP (best for tool-using agents)
Exposes snake_case tools: `parse_intent_text`, `seal_document`, `verify_document`,
`compute_hash`, `get_document_history`, plus query / render / diff / merge / validate /
workflow / sign / source tools. Point your MCP client at the server and call them directly —
no code. See [`apps/docs/docs/ecosystem/mcp-server.md`](apps/docs/docs/ecosystem/mcp-server.md).

### `@dotit/editor` — embeddable React WYSIWYG editor over plain `.it` source
### `dotit` CLI — `dotit seal|verify|amend|history|query|convert <file>` and `--pdf/--html/--data`

---

## 6. The hard rules — byte preservation (do not violate)

The seal is a hash of the **exact bytes**. Reformatting breaks it even when nothing visible
changed. Therefore:

1. **Never auto-format / reorder / re-indent / canonicalize an existing `.it` file.** Preserve
   the author's bytes exactly.
2. **When editing, use `reconcileEdit(original, edited)`** — it keeps unchanged blocks' original
   bytes and re-serializes only what truly changed. A no-op edit is byte-identical (seal holds).
3. **A sealed document (`freeze:` present) is read-only.** Don't edit it; amend it with `amendment:`.
4. **Storing in a DB?** Use `toStorageRecord` / `verifyStorageRecord` so any re-encoding is caught.
5. **Read the model freely** (`parseIntentText`); only ever write back through `reconcileEdit`.
6. **The parser is a faithful recorder** — it stores ONLY what was authored; block-type
   defaults (a `step:`'s `status: pending`, a `done:`'s `status: done`, a bare `toc:`'s
   `depth`/`title`) are NOT in `block.properties`. Need a block's interpreted values? Use
   `effectiveProperties(block)` / `effectiveField(block, field)` — never mutate `properties`.

---

## 7. Compliance self-check

Before emitting `.it`, verify your output:

- [ ] Every line is `keyword: value | props`, bare prose, a comment, `---`, or inside a code fence.
- [ ] No line packs two blocks; no markdown headings (`#`) — use `section:`/`sub:`.
- [ ] Dates in date properties are ISO 8601; literal `|` in values is escaped `\|`.
- [ ] Round-trips losslessly: `documentToSource(parseIntentText(src)) === src`.
- [ ] If you sealed it: `verifyDocument(src).intact === true`.
- [ ] If you edited a sealed/existing file: you went through `reconcileEdit` and a no-op stayed byte-identical.
- [ ] You did not reformat lines you weren't asked to change.

If all boxes hold, the document is compliant and trustworthy.

---

*This file is the canonical agent reference. To make it fetchable by external agents, publish
it at `https://dotit.uts.qa/llms.txt`. Keep it in sync with `packages/core/SPEC.md`.*
