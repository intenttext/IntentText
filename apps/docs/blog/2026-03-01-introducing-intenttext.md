---
slug: introducing-intenttext
title: "Introducing IntentText: Documents That Think"
authors: [intenttext]
tags: [announcement, launch]
---

Every document format forces a choice. Binary formats (Word, PDF) give you layout but lock out machines. Markdown gives you plaintext but stops at content. Neither understands what the document _means_.

IntentText is a new open format that refuses the tradeoff.

<!-- truncate -->

## The problem

Organizations run on documents — contracts, invoices, reports, policies. These documents carry structured intent: deadlines, approvals, signatures, metrics, contact information. But in every existing format, that intent is buried in prose. You can read it. Your code cannot.

Markdown gets close. It's readable. It's plaintext. But try querying all deadlines across your contracts folder. Try sealing a document so no one can tamper with it. Try merging a template with your CRM data. Markdown has no answer.

## The dual-purpose insight

A document should be written once and serve two audiences:

1. **Humans** read it as a professional document — themed, printable, clear.
2. **Machines** parse it as structured data — queryable, composable, trustworthy.

This is what IntentText does. A `.it` file is a plain text document where every line starts with a keyword that declares its _intent_.

```
title: Service Agreement
summary: Consulting services Q2 2026
meta: | client: Acme Corp | ref: CONTRACT-2026-042

section: Scope
text: Strategic consulting for platform migration.
deadline: Phase 1 complete | date: 2026-04-30

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp

approve: Reviewed by legal | by: Sarah Chen | role: Legal Counsel
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked
```

That's a complete contract. A human reads it clearly. But your code can also:

- Parse it into a typed AST
- Query all deadlines across 500 contracts
- Verify the document hasn't been tampered with
- Merge it from a template with CRM data
- Render it as a themed PDF

One file. Both audiences. No conversion step.

## What's in the box

IntentText ships as a core npm package (`@intenttext/core`) with:

- **A stable canonical keyword core** with aliases and extensions for document identity, content, structure, data, agent workflows, trust, and print layout
- **8 built-in themes** for professional rendering
- **A query engine** that works across files and folders
- **A trust system** — approvals, signatures, sealing, and tamper detection
- **Template merging** with `{{variable}}` syntax and `{{each:}}` loops

Plus an ecosystem: CLI, VS Code extension, MCP server for AI agents, Python SDK, web editor, and the Hub for community templates.

## What's coming

This is v2.11 — the result of rapid iteration on what documents actually need. We're working on:

- More themes from the community
- Richer query operators
- IDE integrations beyond VS Code
- A desktop app for visual editing

The format is open. The spec is public. If your documents carry intent, they should be `.it` files.

[Get started →](/docs/guide/quick-start)
