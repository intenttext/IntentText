---
sidebar_position: 1
title: Folder Structure
---

# Folder Structure

## The problem

Your organization has hundreds of documents — contracts, policies, reports, templates. You need a folder structure that scales and keeps queries fast.

## The solution

Organize by document type and department. Each folder gets its own `.it-index`.

```
company/
├── contracts/
│   ├── active/
│   │   ├── acme-service-2026.it
│   │   ├── globaltech-nda-2026.it
│   │   └── .it-index
│   ├── expired/
│   │   ├── acme-service-2025.it
│   │   └── .it-index
│   └── templates/
│       ├── service-agreement.it
│       ├── nda-template.it
│       └── .it-index
├── hr/
│   ├── employees/
│   │   ├── ahmed-offer.it
│   │   ├── sarah-review-q1.it
│   │   └── .it-index
│   ├── policies/
│   │   ├── remote-work.it
│   │   ├── pto-policy.it
│   │   └── .it-index
│   └── templates/
│       ├── offer-letter.it
│       ├── review-template.it
│       └── .it-index
├── finance/
│   ├── invoices/
│   │   ├── 2026-001.it
│   │   ├── 2026-002.it
│   │   └── .it-index
│   ├── budgets/
│   │   ├── q1-2026.it
│   │   └── .it-index
│   └── templates/
│       ├── invoice-template.it
│       └── .it-index
└── reports/
    ├── engineering/
    │   ├── q1-2026.it
    │   └── .it-index
    └── sales/
        ├── q1-2026.it
        └── .it-index
```

## Principles

### 1. One folder per logical boundary

Contracts and HR documents have different access controls. Keep them in separate folders — never mix document types in a single folder.

### 2. Active vs archived

Separate active documents from expired/archived ones. Queries against `active/` are faster and more relevant.

### 3. Templates live with their domain

Put the invoice template in `finance/templates/`, not in a global `templates/` folder. Teams own their templates.

### 4. Shallow indexes per folder

Each folder gets its own `.it-index`. Build them all:

```bash
intenttext index ./company --recursive
```

This creates one `.it-index` per subfolder — not one giant index for everything.

## When to create subfolders

| Situation                     | Action                             |
| ----------------------------- | ---------------------------------- |
| > 50 files in a folder        | Split by year, status, or category |
| Different access controls     | Separate folders                   |
| Different teams own the files | Separate folders                   |
| Templates vs documents        | `templates/` subfolder             |

## Building indexes

```bash
# Build index for one folder
intenttext index ./company/contracts/active

# Build all indexes recursively
intenttext index ./company --recursive
```

## Querying across the structure

```bash
# All contacts across the company
intenttext query ./company --type contact --format table

# All pending deadlines in contracts
intenttext query ./company/contracts/active --type deadline --status pending --format table

# Templates only
intenttext query ./company --type meta --content "template" --format json
```

## Next steps

- [Querying Documents](./querying-documents) — query syntax and output formats
- [Indexing Folders](./indexing-folders) — build and maintain indexes
- [Multi-Folder Query](./multi-folder-query) — how cross-folder queries work
