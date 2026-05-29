---
sidebar_position: 3
title: Cross-Document References
---

# Cross-Document References

## The problem

Documents reference each other — a contract references its amendment, an invoice references the contract it's billing against, a report references the data source. These references are unstructured text that no machine can follow.

## The solution

`ref:` with typed `rel:` relationships creates machine-readable links between documents.

### Contract referencing related documents

```intenttext
title: Service Agreement — Acme Corp & GlobalTech Industries
meta: | type: contract | domain: legal

ref: Non-Disclosure Agreement | rel: requires | to: ./nda-acme-globaltech.it
ref: Statement of Work — Phase 1 | rel: includes | to: ./sow-phase1.it
ref: Previous Agreement (2025) | rel: supersedes | to: ../expired/acme-globaltech-2025.it
ref: Amendment #1 | rel: amended-by | to: ./amendments/amendment-1.it
ref: Invoice Template | rel: uses | to: ../templates/invoice-standard.it
```

### Relationship types

| `rel:` type  | Meaning                                   | Example                                |
| ------------ | ----------------------------------------- | -------------------------------------- |
| `supersedes` | This document replaces that one           | New contract supersedes the old one    |
| `references` | This document cites that one              | Report references a data source        |
| `requires`   | This document depends on that one         | Contract requires an NDA               |
| `includes`   | This document contains part of that one   | Agreement includes a Statement of Work |
| `amended-by` | This document was changed by that one     | Contract amended by Amendment #1       |
| `based-on`   | This document builds on that one          | Analysis based on research             |
| `uses`       | This document uses that one as a template | Invoice uses invoice template          |

### Agent navigation

Agents use `ref:` to navigate a document graph:

```intenttext
title: Research Analysis — Q2 Cloud Market
meta: | type: analysis | agent: strategy-agent

ref: Market Research — Q2 Cloud | rel: based-on | to: ./research-q2-cloud.it
ref: Q1 Analysis | rel: references | to: ../q1/analysis-q1-cloud.it
ref: Execution Plan | rel: references | to: ./execution-plan-q2.it
```

An agent reading this document can follow `ref:` links to gather full context without being told where to look.

### Querying references

```bash
# All references across contracts
intenttext query ./contracts --type ref --format table

# Find what supersedes what
intenttext query ./contracts --type ref --content "supersedes" --format json

# Find all amendments
intenttext query ./contracts --type ref --content "amended-by" --format table

# Natural language
intenttext ask ./contracts "Which contract supersedes the 2025 agreement?" --format text
```

## Building a document graph

Export all references to visualize the relationships:

```bash
intenttext query ./company --type ref --format json > document-graph.json
```

Each entry contains:

```json
{
  "file": "contracts/acme-globaltech.it",
  "type": "ref",
  "content": "Non-Disclosure Agreement",
  "properties": {
    "rel": "requires",
    "to": "./nda-acme-globaltech.it"
  }
}
```

Build a graph visualization from this data, or feed it to an agent for navigation.

## Properties

| Property   | Description                               |
| ---------- | ----------------------------------------- |
| `rel:`     | Relationship type                         |
| `to:`      | Path or URL to the referenced document    |
| `title:`   | Display title (if different from content) |
| `section:` | Specific section being referenced         |
| `note:`    | Annotation about the reference            |

## Next steps

- [Definitions & Glossaries](./definitions-and-glossaries) — link defined terms
- [Figures & Captions](./figures-and-captions) — reference figures across documents
- [Agent Handoff](../agents/agent-handoff) — agents navigating `ref:` links
