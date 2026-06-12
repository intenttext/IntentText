---
slug: v1-dotit-rebrand
title: "1.0: IntentText Is Now @dotit — Plus Arabic Keywords That Round-Trip"
authors: [intenttext]
tags: [release, announcement]
---

Today the IntentText packages hit **1.0.0** under a new npm scope: **`@dotit/core`**, **`@dotit/pdf`**, and **`@dotit/mcp`**. Same format, same `.it` extension, same code — direct lineage from `@intenttext` 4.3.x, which is now deprecated on npm with pointer messages to the new names.

```bash
npm install @dotit/core      # the format: parse, render, merge, query, trust
npm install @dotit/pdf       # optional: server-side PDFs (issue → seal → PDF)
npm install -g @dotit/mcp    # the MCP server for AI agents
```

1.0 is a statement, not just a version bump: the line grammar, the 38 canonical keywords, and the trust model are stable. And this release ships the feature we've wanted since the beginning — documents that aren't just readable in any language, but **written** in any language.

{/* truncate */}

## Arabic keywords, as written

The keyword grammar is now Unicode (`\p{L}` words), so domain keywords in Arabic — or any script — parse as typed, queryable blocks exactly like ASCII ones:

```
مصروف: كراسي مكتب | المورد: ايكيا | فئة: أثاث | date: 2026-06-12
```

That's a typed block with keyword `مصروف`, queryable by Arabic property (`فئة = أثاث`) and by ISO date range.

But custom keywords were never the hard part. The hard part was semantics — and that's what the **33 registered Arabic aliases** deliver. `عنوان` is `title`. `قسم` is `section`. `مهمة` is `task`. `صف` is `row`, `أعمدة` is `columns`, `مؤشر` is `metric`, `توقيع` is `sign`, `اعتماد` is `approve`, `تجميد` is `freeze`. An Arabic document gets full canonical behavior — totals rows, contact cards, signatures, deadline logic — and one query (`type:task`) finds tasks across languages.

The detail that makes this real: **aliases now round-trip as written.** `documentToSource` re-emits the keyword the author used (`block.keywordAlias`) instead of normalizing to canonical English. An Arabic document stays Arabic through every parse → serialize cycle. `abstract:` stays `abstract:`. Table keywords (`أعمدة`/`صف`, `headers`) are preserved too.

This matters most for trust. A sealed document's hash covers the exact bytes — if serialization rewrote `توقيع` as `sign`, the seal would break on the first round-trip. Now it doesn't. Sealed Arabic documents keep their hash.

## Dates are ISO 8601

One language did get standardized: dates. Date-bearing properties (`date`, `due`, `at`, `expires`, `issued`) are canonically `YYYY-MM-DD` (or full ISO timestamps), and the semantic validator now flags locale formats with a `DATE_NOT_ISO` warning.

`09/03/2026` is ambiguous — March 9th or September 3rd, depending on who's reading — and it breaks the query engine's date-range comparisons, which work out of the box with ISO values. Write the content in any language; write the dates in ISO.

## Escaping that survives round-trips

` | ` is the reserved property delimiter, and `\|` has always parsed correctly into a literal pipe. But the serializer emitted it back *unescaped* — so re-parsing split it as a property delimiter. Data corruption, two round-trips in.

Fixed. The serializer now re-escapes `\` and `|` in content and property values, so escape round-trips are a fixpoint: parse → serialize → parse gives you the same document, every time.

## A fuzz-tested parser

1.0 also marks the start of the hardening track. The new fuzz/property suite throws 500 random structured documents, 200 random byte-soup inputs, and a gallery of pathological cases (10K newlines, 5K pipes, 100KB hash values, BOM, CRLF, deep nesting) at the full pipeline — parse → render → print → serialize → re-parse → hash → verify → merge — with one rule: **never throw.** Deterministic seeds, so every failure reproduces.

It already paid for itself: the suite found a stack-overflow DoS where a single ~10KB line of repeated list markers crashed the parser — a real risk for any server parsing untrusted `.it`. Fixed in 4.3.1, carried into 1.0. 897 tests passing.

## What you need to do

- **New projects:** install `@dotit/core` (and `@dotit/pdf` / `@dotit/mcp` as needed).
- **Existing projects:** swap `@intenttext/*` for `@dotit/*` in package.json and imports. The API is unchanged — it's the same code.
- **Your `.it` files:** nothing. The format is the format.

One format, every language, version 1.0.

[Core API →](/docs/ecosystem/core-api) · [MCP Server →](/docs/ecosystem/mcp-server)
