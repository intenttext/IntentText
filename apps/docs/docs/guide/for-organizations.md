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
intenttext query ./contracts --type deadline
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
intenttext ask ./contracts "what deadlines are coming up in April?"
```

## Find every contact

```bash
intenttext query ./contracts --type contact --org "Acme"
```

Your documents _become_ your contact directory — with zero extra work.

## Track who approved what

Every `approve:` and `sign:` block is queryable:

```bash
intenttext query ./contracts --type sign
intenttext query ./contracts --type approve --by "Sarah Chen"
```

## The trust workflow

Documents follow a lifecycle:

1. **Draft** — write and edit freely
2. **Track** — `track:` activates change history
3. **Approve** — `approve:` records named approval with role and timestamp
4. **Sign** — `sign:` records an integrity hash seal
5. **Freeze** — `freeze:` seals the document; any edit breaks the hash
6. **Amend** — `amendment:` formally changes a frozen document without voiding the seal

```intenttext
track: | version: 1.0 | by: Ahmed
approve: Legal review complete | by: Sarah Chen | role: General Counsel
approve: Finance approved | by: James Miller | role: CFO
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked
```

## Amending sealed documents

A signed contract needs to change. Without `amendment:`, you'd break the seal, re-sign, re-freeze — voiding all original signatures.

With `amendment:`:

```intenttext
amendment: Payment terms updated | section: Payment | was: Net 30 | now: Net 15 | ref: Amendment #1 | by: Ahmed | approved-by: Sarah Chen
```

The original seal is preserved. The amendment carries its own approval chain. Run `intenttext verify` and see both the original seal and all amendments.

## Build indexes

```bash
intenttext index ./contracts
intenttext index . --recursive
intenttext index . --recursive --watch
```

Indexes are shallow — each folder's `.it-index` only knows about its own files. Queries compose automatically across nested indexes. Change one file and only its folder's index needs rebuilding.

## Metrics and reporting

```bash
intenttext query ./reports --type metric --owner Finance
```

Every `metric:` block across every report — queryable, filterable, exportable to CSV:

```bash
intenttext query ./reports --type metric --format csv > metrics.csv
```

## Why not just use Word?

| Feature                | Word / Google Docs  | IntentText                  |
| ---------------------- | ------------------- | --------------------------- |
| Query across 500 files | No                  | `intenttext query ./`       |
| Find all deadlines     | Manual search       | `--type deadline`           |
| Verify who signed      | Check metadata      | `intenttext verify`         |
| Amend without voiding  | Break seal, re-sign | `amendment:` preserves seal |
| Version control        | Track changes       | `track:` + git              |
| Template reuse         | Copy-paste          | `{{variables}}` + merge     |

---

**Related:**

- [Folder Structure →](../cookbook/organizations/folder-structure)
- [Multi-Folder Query →](../cookbook/organizations/multi-folder-query)
- [Contact Directory →](../cookbook/organizations/contact-directory)
- [Deadline Tracking →](../cookbook/organizations/deadline-tracking)
