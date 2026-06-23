---
sidebar_position: 1
title: Cookbook
---

# Cookbook

Complete, working examples for common IntentText use cases. Each recipe gives you a real problem, a working solution, and the commands to make it happen. (Fundamentals live in the [Guide](../guide/index.md) and exact syntax in the [Reference](../reference/index.md) — recipes here don't repeat them.)

## Documents

Build real documents — contracts, reports, newsletters. For an invoice walkthrough, see [Your First Document](../guide/first-document).

- [Contract](./documents/contract) — verifiable contract with approval trail and signatures
- [Report](./documents/report) — monthly report with metrics and figures
- [Newsletter](./documents/newsletter) — editorial newsletter with images and pull quotes
- [E-Invoices (EN16931 / UBL)](./documents/e-invoice) — emit standards UBL XML from one `.it` source

## Templates

- [Building Templates](./templates/building-templates) — from document to reusable template. Variable syntax, `each:` tables, and the merge API live in the [Templates reference](../reference/templates).

## Forms

Fillable, signable `.it` documents — the PDF-form workflow in plain text.

- [Fillable Forms](./forms/fillable-forms) — `meta: type: form`, `input:` fields, conditional `show-if:`, computed `compute:`, file `type: attachment`, two-party trust, and `submitForm()`/`isFormComplete()`

## Trust

Approvals, routing, signatures, sealing, redline, and conformance.

- [Approval Workflow](./trust/approval-workflow) — approve → sign → freeze, plus in-file `route:`/`require:` routing and `workflowState`
- [Sealing Contracts](./trust/sealing-contracts) — `dotit seal` and `dotit verify`
- [Attachments](./trust/attachments) — embed files with `attach:` so they ride inside the doc and are covered by the seal
- [Amending Frozen Documents](./trust/amending-frozen-docs) — formal amendments without breaking the seal
- [Audit Trail](./trust/audit-trail) — track + revision + history
- [Redline & Compare](./trust/redline-and-compare) — `compareVersions` and three-way `mergeThreeWay`
- [Conformance](./trust/conformance) — `checkConformance` lax vs strict

## Agents

AI agent pipelines, task planning, and MCP integration.

- [Task Planning](./agents/task-planning) — agent task plan as a `.it` document
- [Pipeline Definition](./agents/pipeline-definition) — multi-step pipeline with gates
- [Agent Handoff](./agents/agent-handoff) — passing context between agents
- [MCP Integration](./agents/mcp-integration) — MCP server tools with Claude

## Organizations

Folder structures and team workflows. Query syntax and `.it-index` mechanics live in [A Folder Is a Database](../guide/folder-as-database), the [Query reference](../reference/query), and the [Index File reference](../reference/index-file).

- [Folder Structure](./organizations/folder-structure) — recommended structure for organizations
- [Contact Directory](./organizations/contact-directory) — build a contact directory from existing files
- [Deadline Tracking](./organizations/deadline-tracking) — track deadlines across hundreds of documents

## Print

- [Print-Ready Documents](./print/print-ready-documents) — full print layout with headers and signatures
- [PDF Export](./print/pdf-export) — CLI export with themes and metadata. Watermark syntax is in the [Layout reference](../reference/keywords/layout#watermark).

## Data

Metrics, definitions, references, and figures.

- [Metrics & Dashboards](./data/metrics-and-dashboards) — queryable KPIs and metric grids
- [Definitions & Glossaries](./data/definitions-and-glossaries) — machine-readable defined terms
- [Cross-Document References](./data/cross-document-refs) — typed relationships between documents
- [Figures & Captions](./data/figures-and-captions) — numbered, captioned, referenceable figures
