---
sidebar_position: 1
title: Guide Overview
---

# IntentText Guide

What is IntentText, and why should you care?

IntentText is a plain-text document format that uses **keywords** to give every line a purpose. A `.it` file is readable by humans, parseable by code, and — when sealed — legally trustworthy.

## Who is this for?

- **Organizations** building document workflows — contracts, policies, reports, invoices
- **AI agents** that need structured task plans, pipelines, and audit trails
- **Writers** who want professional output from plain text — themes, PDF export, figures

## What's new in 1.25.0 — three things only `.it` does

- **The workflow lives in the document.** Declare *who must approve, in what order* with
  `route:` / `require:`; the live state is derived (`workflowState`) and the approval order
  is hash-chained — so the system-of-record and the system-of-approval can't disagree.
  ([Approval Workflows](./approval-workflows))
- **Forms that are fillable *and* sealable.** `meta: type: form` + `input:` fields
  (`show-if:`, `compute:`) become a record with two-party trust — the author seals the blank
  structure, the filler seals the answers. ([Forms](./forms-and-workflows))
- **Authority certification.** `certify:` binds a signing key to a verified organization via
  a certification authority with a root→intermediate chain — verifiable offline.
  ([Trust & Signing](./trust-and-signing#layer-3--authority-uts-certification))

## What you get

- **Canonical + extension language model** — 41 stable canonical keywords, plus localized keyword names and namespaced extension keywords
- **Localized keyword names** — 33 Arabic keywords (`عنوان:`, `مهمة:`, `صف:`, …) ship in core, resolve to the canonical keyword, and round-trip as written
- **Zero synonym aliases** — any non-reserved word is reliably *your* custom keyword, never silently reinterpreted; the open vocabulary is collision-free by design
- **8 built-in themes** — corporate, minimal, warm, technical, print, legal, editorial, dark
- **Full trust system** — approve, sign, seal, verify, certify, amend; a seal that survives restyling
- **Template engine** — `{{variables}}`, dynamic table rows, data merge
- **Query engine + folder-as-database** — find any block across any number of files; a folder of `.it` is a queryable database with no import
- **Conformance** — `checkConformance` (lax/strict) to gate documents before a system of record
- **CLI, npm, PyPI, MCP server, VS Code extension, web editor, Hub**

## Where to start

| You want to...              | Start here                               |
| --------------------------- | ---------------------------------------- |
| Get running in 5 minutes    | [Quick Start](./quick-start)             |
| See everything `.it` can do | [Capabilities](./capabilities)           |
| Understand the mental model | [Core Concepts](./concepts)              |
| Build a real document       | [Your First Document](./first-document)  |
| Build a reusable template   | [Your First Template](./first-template)  |
| See what orgs can do        | [For Organizations](./for-organizations) |
| Build agent workflows       | [For Agents](./for-agents)               |
| Write and publish           | [For Writers](./for-writers)             |
| Fill & seal a form          | [Forms, Review & Compliance](./forms-and-workflows) |
| Query a folder of files     | [A Folder Is a Database](./folder-as-database) |
| Seal and verify documents   | [Trust & Signing](./trust-and-signing)   |
| Put the workflow in the doc | [Approval Workflows](./approval-workflows) |
| Use `.it` as config         | [Config & Options](./config-and-options) |
| Keep seals intact, always   | [Byte Preservation](./byte-preservation) |
