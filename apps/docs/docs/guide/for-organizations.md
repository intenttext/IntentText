---
sidebar_position: 6
title: For Organizations
---

# IntentText for Organizations

Your contracts are in Word. Your policies are in SharePoint. Your reports are in Google Docs. Nobody can query any of them. Nobody can verify who approved what. Nobody can find the deadline buried on page 12.

IntentText fixes this.

## The folder structure

```
company/
├── contracts/
│   ├── .it-index
│   ├── acme-services-2026.it
│   ├── globaltech-consulting.it
│   └── vendor-nda-template.it
├── policies/
│   ├── .it-index
│   ├── data-retention.it
│   └── travel-expenses.it
├── reports/
│   ├── .it-index
│   ├── q1-2026-finance.it
│   └── q1-2026-engineering.it
└── hr/
    ├── .it-index
    ├── onboarding-checklist.it
    └── profiles/
        ├── .it-index
        ├── ahmed.it
        └── sarah.it
```

Each folder has a `.it-index` — a shallow index of its own files. Queries compose across nested indexes automatically.

## Find every deadline

```bash
dotit query ./contracts --type deadline
```

```
┌──────────────────────────────┬────────────┬────────────────────┐
│ Content                      │ Date       │ File               │
├──────────────────────────────┼────────────┼────────────────────┤
│ Payment due                  │ 2026-04-30 │ acme-services.it   │
│ Renewal deadline             │ 2026-06-15 │ globaltech.it      │
│ NDA expiration               │ 2027-03-01 │ vendor-nda.it      │
└──────────────────────────────┴────────────┴────────────────────┘
```

Or ask in plain English:

```bash
dotit ask ./contracts "what deadlines are coming up in April?"
```

## Find every contact

```bash
dotit query ./contracts --type contact
```

Your documents _become_ your contact directory — with zero extra work. Folder query
supports `--type`, `--by`, `--status`, `--section`, and `--content` (substring) filters;
for arbitrary property filters like `org=Acme`, run the per-file query form:

```bash
dotit ./contracts/acme-services.it --query "type=contact org=Acme"
```

## Track who approved what

Every `approve:` and `sign:` block is queryable:

```bash
dotit query ./contracts --type sign
dotit query ./contracts --type approve --by "Sarah Chen"
```

## The trust workflow

Documents follow a lifecycle:

1. **Draft** — write and edit freely
2. **Track** — `track:` activates change history
3. **Approve** — `approve:` records named approval with role and timestamp
4. **Sign** — `sign:` records an integrity hash seal
5. **Freeze** — `freeze:` seals the document; any content edit breaks the hash (restyling doesn't)
6. **Certify** — `certify:` (optional) binds the signing key to a verified org via a certification authority
7. **Amend** — `amendment:` formally changes a frozen document without voiding the seal

```intenttext
track: | version: 1.0 | by: Ahmed
approve: Legal review complete | by: Sarah Chen | role: General Counsel
approve: Finance approved | by: James Miller | role: CFO
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked
```

## Put the approval policy in the document

Most companies track "who must sign, who has signed, what's next" in a workflow database —
which then drifts from the file in storage. IntentText declares the policy **in the file**
with `route:` / `require:`, and the live state is *derived*, never stored:

```intenttext
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
```

`workflowState(source)` answers "who's pending, who's next, is it complete?" from the file
alone; the hash-chained audit trail (`appendApproval` / `verifyAuditChain`) makes the
approval *order* tamper-evident. **The approval state is derived from the file, so the
system-of-record and the system-of-approval can't disagree.** See
[Approval Workflows](./approval-workflows).

## Amending sealed documents

A signed contract needs to change. Without `amendment:`, you'd break the seal, re-sign, re-freeze — voiding all original signatures.

With `amendment:`:

```intenttext
amendment: Payment terms updated | section: Payment | was: Net 30 | now: Net 15 | ref: Amendment #1 | by: Ahmed | approved-by: Sarah Chen
```

The original seal is preserved. The amendment carries its own approval chain. Run `dotit verify` and see both the original seal and all amendments.

## Build indexes

```bash
dotit index ./contracts
dotit index . --recursive
```

Indexes also self-heal on query, so you rarely need to run `index` by hand — a directory
query refreshes any stale entries before answering.

Indexes are shallow — each folder's `.it-index` only knows about its own files. Queries compose automatically across nested indexes. Change one file and only its folder's index needs rebuilding.

## Metrics and reporting

```bash
dotit query ./reports --type metric
```

Every `metric:` block across every report — queryable, filterable, exportable to CSV:

```bash
dotit query ./reports --type metric --format csv > metrics.csv
```

## Why not just use Word / PDF / a database?

`.it` collapses tools you currently keep in three places — the document (Word), the signed
archive (PDF), and the queryable data (a database/ETL pipeline) — into one plain-text file:

| Feature                       | Word / Google Docs  | PDF                       | Database / ETL              | IntentText                  |
| ----------------------------- | ------------------- | ------------------------- | --------------------------- | --------------------------- |
| Query across 500 files        | No                  | No                        | Yes (after import)          | `dotit query ./`            |
| Find all deadlines            | Manual search       | Manual search             | Yes (if a column exists)    | `--type deadline`           |
| Verify who signed             | Check metadata      | Digital signature panel   | Audit table (separate)      | `dotit verify`              |
| Amend without voiding         | Break seal, re-sign | Re-sign the whole PDF     | n/a                         | `amendment:` preserves seal |
| Version control               | Track changes       | Opaque binary diff        | Migrations                  | `track:` + git              |
| Template reuse                | Copy-paste          | Form fields               | App templating              | `{{variables}}` + merge     |
| Data + document in one file   | No                  | No                        | No (data only)              | Yes — the line a clerk reads, code queries |
| No import / ETL step          | n/a                 | n/a                       | Import required             | The file *is* the row       |
| Render to signed/archival PDF | Export              | Native                    | n/a                         | `--pdf`, PAdES, PDF/A       |

## Named outcomes

Concrete things teams ship with `.it` that need no second system:

- **RFP → scored → sealed.** Receive vendor responses as `.it`, score them with `metric:`
  lines, seal the evaluation — the scoring, the rationale, and the signature are one
  tamper-evident file you can produce in a dispute.
- **SOX / audit export.** `dotit query ./contracts --type sign --format csv` (and `--type
  approve`, `--type amendment`) exports the complete who-approved-what trail straight to a
  spreadsheet — the audit trail *is* the documents, with no reconciliation.
- **Approval state that can't drift.** Because `route:`/`require:` live in the file and the
  state is derived, "the database says approved but the file is a different version" simply
  can't happen — the system-of-record and the system-of-approval are the same file.

## Conformance gating

Before a document enters a system of record, gate it with `checkConformance`:

```typescript
import { checkConformance } from "@dotit/core";
const { conformant } = checkConformance(source, { level: "strict" });
// strict = no errors AND no warnings (every date ISO 8601, etc.) — the bar for a clean archive
```

Use **lax** for "parses cleanly" and **strict** for "spotless enough to certify." See
[Conformance](../reference/conformance).

---

**Related:**

- [Folder Structure →](../cookbook/organizations/folder-structure)
- [Query reference →](../reference/query)
- [Contact Directory →](../cookbook/organizations/contact-directory)
- [Deadline Tracking →](../cookbook/organizations/deadline-tracking)
