---
sidebar_position: 6
title: Redline & Compare
---

# Redline & Compare

## The problem

Two versions of a contract come back from a counterparty. You need a **redline** — what was
added, what was removed — and, when three people edited from a common draft, a **three-way
merge** that flags real conflicts instead of silently clobbering someone's change.

## The solution: `compareVersions`

`compareVersions(before, after)` returns a single `.it` document where every change is marked
inline with tracked-change spans — `{track: ins}` for insertions, `{track: del}` for
deletions. It's a real IntentText document: render it, seal it, or open it in the editor's
redline view.

```javascript
import { compareVersions } from "@dotit/core";

const before = `title: Purchase Order PO-9001
section: Order
text: Supplier | end: Medad Industrial
metric: Amount | value: 250000 | unit: USD
`;

const after = `title: Purchase Order PO-9001
section: Order
text: Supplier | end: Medad Industrial Co.
metric: Amount | value: 260000 | unit: USD
`;

console.log(compareVersions(before, after));
```

Output (a redline document):

```intenttext
title: Purchase Order PO-9001
section: Order
text: Supplier | end: Medad [Industrial]{track: del}[Industrial]{track: ins} [Co.]{track: ins}
metric: [Amount | value: 250000 | unit: USD]{track: del}
metric: [Amount | value: 260000 | unit: USD]{track: ins}
```

Pass `{ by: "Jane Doe" }` to attribute the changes to a reviewer. The marked spans use the
same `[text]{key: value}` inline-span syntax as the rest of IntentText, so nothing about the
output is special-cased — it queries and renders like any document.

## Three-way merge: `mergeThreeWay`

When `mine` and `theirs` both started from a common `base`, `mergeThreeWay` combines them and
reports how many spots genuinely conflict (both sides changed the same line differently):

```javascript
import { mergeThreeWay } from "@dotit/core";

const { source, conflicts } = mergeThreeWay(base, mine, theirs, {
  mineLabel: "Acme",
  theirsLabel: "GlobalTech",
});

if (conflicts > 0) {
  // `source` contains conflict markers labelled "Acme" / "GlobalTech" to resolve by hand
  console.warn(`${conflicts} conflict(s) need review`);
} else {
  // clean merge — `source` is the combined document
}
```

Non-conflicting edits from both sides are applied automatically; only true overlaps are left
for a human, each labelled with the two sides so you can see who wrote what.

## Why this beats a text diff

A plain `diff` works on lines of characters. `compareVersions` works on **blocks**, so a
re-ordered section, a reformatted table, or a re-wrapped paragraph doesn't drown the real
edits in noise — and the result is itself a valid `.it` document you can seal as the official
"changes since v1."

## Next steps

- [Amending Frozen Documents](./amending-frozen-docs) — formal `amendment:` lines on a sealed doc
- [Audit Trail](./audit-trail) — `track`/`revision`/`history` over time
- [Sealing Contracts](./sealing-contracts) — sealing the redline as the record of changes
