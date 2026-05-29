---
sidebar_position: 1
title: Cookbook
---

# Cookbook

Complete, working examples for every common IntentText use case. Each recipe gives you a real problem, a working solution, and the commands to make it happen.

## Documents

Build real documents — invoices, contracts, reports, newsletters.

- [Invoice](./documents/invoice) — professional invoice with line items and PDF export
- [Contract](./documents/contract) — verifiable contract with approval trail and signatures
- [Report](./documents/report) — monthly report with metrics and figures
- [Newsletter](./documents/newsletter) — editorial newsletter with images and pull quotes

## Templates

Turn documents into reusable templates and merge them with data.

- [Building Templates](./templates/building-templates) — from document to reusable template
- [Dynamic Tables](./templates/dynamic-tables) — `each:` property, singularization, empty arrays
- [Merging Data](./templates/merge-data) — CLI and API merge, nested data, missing values
- [Template Library](./templates/template-library) — the 76 Hub templates by domain

## Trust

Approvals, signatures, sealing, and amendments.

- [Approval Workflow](./trust/approval-workflow) — approve → sign → freeze
- [Sealing Contracts](./trust/sealing-contracts) — `intenttext seal` and `intenttext verify`
- [Amending Frozen Documents](./trust/amending-frozen-docs) — formal amendments without breaking the seal
- [Audit Trail](./trust/audit-trail) — track + revision + history

## Agents

AI agent pipelines, task planning, and MCP integration.

- [Task Planning](./agents/task-planning) — agent task plan as a `.it` document
- [Pipeline Definition](./agents/pipeline-definition) — multi-step pipeline with gates
- [Agent Handoff](./agents/agent-handoff) — passing context between agents
- [MCP Integration](./agents/mcp-integration) — MCP server tools with Claude

## Organizations

Folder structures, queries, indexes, and team workflows.

- [Folder Structure](./organizations/folder-structure) — recommended structure for organizations
- [Querying Documents](./organizations/querying-documents) — single file, folder, glob, natural language
- [Indexing Folders](./organizations/indexing-folders) — `.it-index` setup and management
- [Multi-Folder Query](./organizations/multi-folder-query) — shallow architecture explained
- [Contact Directory](./organizations/contact-directory) — build a contact directory from existing files
- [Deadline Tracking](./organizations/deadline-tracking) — track deadlines across hundreds of documents

## Print

Print-ready documents, watermarks, and PDF export.

- [Print-Ready Documents](./print/print-ready-documents) — full print layout with headers and signatures
- [Watermarks](./print/watermarks) — CONFIDENTIAL, DRAFT, VOID overlays
- [PDF Export](./print/pdf-export) — CLI export with themes and metadata

## Data

Metrics, definitions, references, and figures.

- [Metrics & Dashboards](./data/metrics-and-dashboards) — queryable KPIs and metric grids
- [Definitions & Glossaries](./data/definitions-and-glossaries) — machine-readable defined terms
- [Cross-Document References](./data/cross-document-refs) — typed relationships between documents
- [Figures & Captions](./data/figures-and-captions) — numbered, captioned, referenceable figures
