---
sidebar_position: 8
title: A Folder Is a Database
---

# A Folder Is a Database

A folder of `.it` files needs no database to be queryable. Every line in every
file is typed data, so the folder itself *is* the database: `dotit query` filters
it, `.it-index` files make it fast, `dotit ask` answers questions about it in
plain language — and the documents stay ordinary text files in git the whole time.

This guide builds that up on one realistic folder, end to end.

## The folder

A small Gulf trading company keeps its contracts as `.it` files — some written in
English, some in Arabic:

```
contracts/
├── acme-cloud-services.it      ← hosting agreement (English, sealed)
├── gulf-maintenance-ar.it      ← maintenance contract (Arabic)
└── vendor-nda.it               ← NDA still in draft
```

```intenttext title="contracts/acme-cloud-services.it"
title: Cloud Services Agreement
summary: Managed hosting for Acme Gulf Trading WLL
meta: | ref: CON-2026-014 | status: active

section: Parties
contact: Acme Gulf Trading WLL | email: ops@acmegulf.qa | role: Client
contact: Nimbus Hosting LLC | email: accounts@nimbus.co | role: Provider

section: Scope
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee
deadline: Annual renewal decision | date: 2026-12-15

section: Approvals
approve: Legal review complete | by: Sara Haddad | role: Counsel | at: 2026-06-01
task: Countersign and archive | owner: Fahad | due: 2026-06-20 | priority: high
```

```intenttext title="contracts/gulf-maintenance-ar.it"
عنوان: عقد صيانة المكاتب — برج الدوحة
ملخص: صيانة دورية لأنظمة التكييف والكهرباء
meta: | ref: CON-2026-019 | status: active

قسم: الأطراف
جهة: شركة الخليج للمقاولات | email: info@gulfco.qa | role: المقاول

قسم: الالتزامات
مهمة: تقرير الصيانة الشهري | owner: خالد | due: 2026-06-25
مهلة: تجديد العقد | date: 2026-11-30 | consequence: ينتهي العقد تلقائيا
done: Site survey completed | at: 2026-06-05
```

```intenttext title="contracts/vendor-nda.it"
title: Mutual NDA — Falcon Logistics
meta: | ref: CON-2026-021 | status: draft

section: Terms
text: Confidentiality period of 24 months from the effective date.
task: Send for signature | owner: Fahad | due: 2026-06-18 | priority: medium
```

Note the Arabic file: `عنوان` is a registered alias for `title`, `مهمة` for
`task`, `مهلة` for `deadline`, `جهة` for `contact`. The document gets full
canonical semantics while staying Arabic on disk.

## Query it

Every deadline across the folder, one command, no setup:

```bash
dotit query ./contracts --type deadline --format table
```

```
FILE                              TYPE      CONTENT                  PROPERTIES
--------------------------------  --------  -----------------------  ---------------------------------------------------
contracts/acme-cloud-services.it  deadline  First invoice due        date: 2026-07-01 | consequence: 2% late fee
contracts/acme-cloud-services.it  deadline  Annual renewal decision  date: 2026-12-15
contracts/gulf-maintenance-ar.it  deadline  تجديد العقد              date: 2026-11-30 | consequence: ينتهي العقد تلقائيا
```

The Arabic `مهلة:` line and the English `deadline:` lines came back as **one
result set** — aliases resolve to canonical types at parse time, so one query
crosses languages. The same is true for tasks:

```bash
dotit query ./contracts --type task --format table
```

```
FILE                              TYPE  CONTENT                  PROPERTIES
--------------------------------  ----  -----------------------  -------------------------------------------------
contracts/acme-cloud-services.it  task  Countersign and archive  owner: Fahad | due: 2026-06-20 | priority: high
contracts/gulf-maintenance-ar.it  task  تقرير الصيانة الشهري     owner: خالد | due: 2026-06-25
contracts/vendor-nda.it           task  Send for signature       owner: Fahad | due: 2026-06-18 | priority: medium
```

Filters compose, and output can be `table`, `json`, or `csv`:

```bash
# What has been completed?
dotit query ./contracts --type done

# Which documents carry a locked seal?
dotit query ./contracts --status locked

# Who approved things, filtered by approver
dotit query ./contracts --type approve --by "Sara Haddad"

# Substring search on content
dotit query ./contracts --type deadline --content renewal

# Every contact in the company, straight into a spreadsheet
dotit query ./contracts --type contact --format csv > contacts.csv

# Globs work too
dotit query "contracts/*.it" --type sign --format json
```

`--by` and `--status` match the block's own `by:`/`status:` properties (an
`approve:` line's approver, a `freeze:` line's `status: locked`); `--section`
and `--content` are substring matches.

## Date-aware queries

`.it` standardizes date properties on **ISO 8601** (`2026-07-01`), and that is
what makes dates queryable rather than decorative. Within a document, the
operator syntax compares ISO dates as real dates:

```bash
# Deadlines in this file before October, soonest first
dotit contracts/acme-cloud-services.it --query "type=deadline date<2026-09-30 sort:date:asc"

# Tasks due before the 22nd
dotit contracts/vendor-nda.it --query "type=task due<2026-06-22"
```

Across a folder, combine the folder query's JSON output with any JSON tool — ISO
dates also compare correctly as plain strings, which is exactly why the format
requires them:

```bash
# Every deadline in the folder that falls before December
dotit query ./contracts --type deadline --format json \
  | jq '.[] | select(.block.properties.date < "2026-12-01")'
```

A locale-format date like `09/03/2026` would silently break all of this — which
is why the semantic validator flags non-ISO dates with a `DATE_NOT_ISO` warning.
See [Query System](/docs/reference/query) for the full operator table.

## Index files: how it stays fast

The first time you query a directory, `dotit` writes a `.it-index` file into each
folder — a shallow JSON cache of every block in that folder's files:

```bash
dotit index ./contracts
# ✅ Index built: /…/contracts/.it-index (3 files)

dotit index ./contracts        # nothing changed
# ✓ Index up to date: /…/contracts/.it-index (3 files)
```

Edit one file and the index heals itself — incrementally, touching only what
changed:

```bash
echo "task: Arrange handover meeting | owner: Fahad" >> contracts/vendor-nda.it
dotit index ./contracts
# ✅ Index refreshed: /…/contracts/.it-index (+0 ~1 -0, 2 unchanged)
```

You rarely need to run `index` by hand: **directory queries refresh stale entries
automatically** before answering. The index is a cache, never a source of truth —
delete any `.it-index` and the next query rebuilds it.

Three design rules worth knowing (full detail:
[Index Files](/docs/reference/index-file)):

- **Shallow** — each `.it-index` covers only its own folder, never subfolders.
  Folder boundaries are organizational boundaries (HR and finance can have
  different access controls).
- **Composed** — a recursive query (`dotit query ./company …`) loads each
  subfolder's index and composes them explicitly. `dotit index ./company
  --recursive` pre-builds the whole tree.
- **Self-healing** — staleness is detected per file by content hash and modified
  time, then only changed entries are reparsed.

## Ask in plain language

When the question doesn't reduce to one filter, hand the folder to an LLM:

```bash
export ANTHROPIC_API_KEY=sk-ant-…
dotit ask ./contracts "Which contracts renew before December, and who owns the follow-up tasks?"
dotit ask ./contracts "ما هي المهام المتأخرة؟" --format json
```

`ask` parses the folder, serializes the typed blocks as context, and sends your
question to the Anthropic API — so the answer is grounded in the actual block
data, not a text search. It requires the `ANTHROPIC_API_KEY` environment
variable (everything else on this page runs fully offline).

## The same thing from code

The CLI is a thin layer over `@dotit/core` exports — your app can do exactly what
`dotit query` does:

```js
const fs = require("fs");
const path = require("path");
const {
  parseIntentText,
  buildShallowIndex,
  composeIndexes,
  queryComposed,
} = require("@dotit/core");

// Build a shallow index for one folder
const folder = "./contracts";
const files = {};
for (const name of fs.readdirSync(folder).filter((f) => f.endsWith(".it"))) {
  const source = fs.readFileSync(path.join(folder, name), "utf-8");
  files[name] = {
    source,
    doc: parseIntentText(source),
    modifiedAt: fs.statSync(path.join(folder, name)).mtime.toISOString(),
  };
}
// The third argument stamps the index with the @dotit/core version that built it
// (used for staleness/compat). Read it from the package — never hard-code a literal.
const coreVersion = require("@dotit/core/package.json").version;
const index = buildShallowIndex("contracts", files, coreVersion);

// Compose (one or many folder indexes) and query
const composed = composeIndexes([index], ".");
const deadlines = queryComposed(composed, { type: "deadline" });
// → [{ file: "contracts/acme-cloud-services.it",
//      block: { type: "deadline", content: "First invoice due",
//               properties: { date: "2026-07-01", … } } }, …]
```

For richer per-document queries — property operators, date ranges, sorting —
use `queryBlocks` with the same string syntax as the CLI:

```js
const { parseIntentText, queryBlocks } = require("@dotit/core");

const doc = parseIntentText(fs.readFileSync("contracts/acme-cloud-services.it", "utf-8"));
const { blocks } = queryBlocks(doc, "type=deadline date<2026-09-30 sort:date:asc");
```

`checkStaleness()` and `updateIndex()` give you the same incremental refresh the
CLI uses — see [Index Files](/docs/reference/index-file#programmatic-api).

## The same thing from an AI agent (MCP)

The [MCP server](/docs/ecosystem/mcp-server) (`@dotit/mcp`) exposes
`query_document` as a tool, so an agent can interrogate any document it has read:

```json
{
  "name": "query_document",
  "arguments": {
    "source": "title: T\ntask: Ship | owner: Ahmed | due: 2026-06-20\ndeadline: Renewal | date: 2026-11-30",
    "type": "task"
  }
}
```

```json
{
  "count": 1,
  "blocks": [
    {
      "type": "task",
      "content": "Ship",
      "properties": { "owner": "Ahmed", "due": "2026-06-20" }
    }
  ]
}
```

An agent with filesystem access plus this tool has the whole folder-as-database
workflow: list `.it` files, query each, act on the typed results.

## Why not just use a database?

Sometimes you should — if you need transactions, concurrent writers, or
millisecond joins, use a database. But for the documents themselves:

- **No import step.** The contract *is* the row. Edit the file, the query result
  changes. Nothing to sync, no schema migration when someone adds a property.
- **Git is the history.** Every change to the "database" is a diff with an
  author, reviewable in a pull request.
- **Folder boundaries are access boundaries.** Sharing `contracts/` with someone
  shares exactly that data — indexes are shallow by design.
- **The data outlives the tooling.** A `.it` file with no CLI installed is still
  a readable document; the index is a disposable cache, never a dependency.

Next: documents in this folder can be sealed and verified —
[Trust & Signing](/docs/guide/trust-and-signing) — and rendered to print —
[CLI guide](/docs/ecosystem/cli).
