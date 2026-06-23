---
sidebar_position: 7
title: Conformance
---

# Conformance

## The problem

"It parses" isn't the same as "it's correct." A document can be syntactically fine yet still
have a `deadline:` whose date won't sort, an `approve:` with no `by:`, or a `metric:` that a
dashboard can't read. You want a single gate that catches these — and you want to choose
**how strict** that gate is for the context (a draft vs. a document about to be sealed).

## The solution: `checkConformance`

`checkConformance(source, { level })` runs semantic checks beyond syntax and returns a
report. There are two levels:

- **`lax`** (default) — the document is conformant as long as there are **no errors**.
  Warnings are reported but don't fail it. Good for drafts and authoring.
- **`strict`** — the document must have **no errors _and_ no warnings**. Good as a release
  gate before sealing, publishing, or archiving.

```javascript
import { checkConformance } from "@dotit/core";

const report = checkConformance(source, { level: "strict" });
// {
//   conformant: boolean,
//   level: "lax" | "strict",
//   errors: number,
//   warnings: number,
//   issues: [{ blockId, blockType, type: "error" | "warning", code, message }],
// }
```

`checkConformance` also accepts an already-parsed `IntentDocument` if you have one, so you
don't pay to parse twice.

## The same document, two verdicts

Take a document with a non-ISO date — a **warning**, not an error:

```intenttext
title: Project Kickoff
deadline: Pay deposit | date: soon
```

```javascript
checkConformance(source, { level: "lax" });
// { conformant: true,  level: "lax",    errors: 0, warnings: 1, issues: [ … DATE_NOT_ISO … ] }

checkConformance(source, { level: "strict" });
// { conformant: false, level: "strict", errors: 0, warnings: 1, issues: [ … DATE_NOT_ISO … ] }
```

Same input, same one issue — `lax` ships it with a warning, `strict` blocks it. The issue
itself is identical:

```json
{
  "blockId": "b-2",
  "blockType": "deadline",
  "type": "warning",
  "code": "DATE_NOT_ISO",
  "message": "'date: soon' is not ISO 8601 — use YYYY-MM-DD (e.g. 2026-03-09) so date queries and sorting work reliably"
}
```

Fix it to `date: 2026-03-09` and both levels pass.

## Errors fail everywhere

An **error** (for example an `approve:` block with no `by:`) makes a document non-conformant
at **both** levels — there's no "lax enough" to let a real error through:

```intenttext
meta: | type: contract
approve: Looks good
```

```javascript
checkConformance(source, { level: "lax" }).conformant;    // false (1 error)
checkConformance(source, { level: "strict" }).conformant; // false
```

## Using it as a gate

```javascript
import { checkConformance } from "@dotit/core";

function assertReleasable(source) {
  const report = checkConformance(source, { level: "strict" });
  if (!report.conformant) {
    for (const i of report.issues) {
      console.error(`${i.type.toUpperCase()} [${i.code}] ${i.blockType}: ${i.message}`);
    }
    throw new Error(`Not releasable: ${report.errors} error(s), ${report.warnings} warning(s)`);
  }
}
```

Run `lax` while people are drafting, and flip the gate to `strict` in the step that seals or
publishes — so the strict bar is enforced exactly once, at the moment it matters.

## Next steps

- [Sealing Contracts](./sealing-contracts) — seal once a document passes the strict gate
- [Redline & Compare](./redline-and-compare) — review changes before re-checking conformance
