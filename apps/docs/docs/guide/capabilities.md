---
title: Capabilities — everything .it can do
description: The complete map of IntentText capabilities — authoring, data, trust, forms, compliance, output, integration — each linked to its guide, reference, and API. One page to see the whole surface.
---

# Capabilities

Everything `.it` can do, on one page. Each capability links to its guide, reference, and
API so you can go from "can it do X?" to "here's exactly how" in one hop.

The throughline: a `.it` file is **one plain-text artifact** that is readable by people,
parseable by code, and — when sealed — tamper-evident and verifiable offline, forever. The
same file is your document, your data, your form, your contract, your config, and your audit
trail. No second system to keep in sync.

---

## Authoring & structure

| Capability | What it is | Docs |
| --- | --- | --- |
| **Keyword model** | 38 canonical keywords give every line a purpose; tiered core / agent / contract / data / print | [Concepts](./concepts) · [Keywords](../reference/keywords/index.md) |
| **Bare prose** | `text:` is optional — write natural prose, reach for keywords only when a line needs meaning | [Bare prose](../reference/keywords/content#bare-prose--text-is-optional) |
| **Aliases** | `todo:` → `task:`, plus 33 Arabic aliases (`عنوان:`, `مهمة:`) that round-trip as written | [Aliases](../reference/keywords/aliases) |
| **Custom keywords** | Any `word: …` line you invent parses as a typed `custom` block — never an error | [Concepts §2](./concepts) |
| **Sections** | `section:` (H2) / `sub:` (H3) group blocks; `toc:` builds a table of contents | [Structure](../reference/keywords/structure) |
| **Inline formatting** | `*bold*`, `_italic_`, `~strike~`, `` `code` ``, dates, mentions, tags, footnote refs | [Style properties](../reference/style-properties#inline-formatting) |
| **Two-tier styling** | Pipe properties (`color:`, `weight:`) + `[text]{ key: value }` inline spans + `style:` house rules | [Style properties](../reference/style-properties) |
| **RTL / bidi** | Arabic and mixed-direction documents render and round-trip correctly | [Aliases](../reference/keywords/aliases) |

## Data & query

| Capability | What it is | Docs |
| --- | --- | --- |
| **Tables** | `columns:` / `row:` typed tabular data; totals; `each:` dynamic rows from data | [Data keywords](../reference/keywords/data) · [Templates](../reference/templates) |
| **Metrics** | `metric:` measurable values, queryable and dashboard-ready | [Metrics cookbook](../cookbook/data/metrics-and-dashboards) |
| **Definitions & figures** | `def:` glossary entries, `figure:` numbered captioned figures, `ref:` cross-doc references | [Data cookbook](../cookbook/data/definitions-and-glossaries) |
| **Folder as a database** | Every `.it` in a folder is a queryable row — no DB, no import | [A Folder Is a Database](./folder-as-database) |
| **Query engine** | `queryBlocks` / `queryDocument` / `dotit query` across any number of files | [Query reference](../reference/query) |
| **Natural-language query** | `askDocuments` — ask a folder a question in plain English | [Core API](../ecosystem/core-api#ask-ai-query) |
| **Shallow index** | `.it-index` files for fast lookup over large folders | [Index files](../reference/index-file) |

## Templates & merge

| Capability | What it is | Docs |
| --- | --- | --- |
| **Templates** | `{{variables}}`, dot paths, array access; same parser as documents | [Templates](../reference/templates) · [First template](./first-template) |
| **Data merge** | `mergeData` / `parseAndMerge` — fill a template from JSON | [Core API](../ecosystem/core-api#merge) |
| **Dynamic rows** | `each:` repeats a table row per array item | [Building templates](../cookbook/templates/building-templates) |

## Trust, signing & approvals

| Capability | What it is | Docs |
| --- | --- | --- |
| **Integrity seal** | SHA-256 seal over exact bytes — tamper-evident, offline-verifiable forever | [Trust & Signing](./trust-and-signing) |
| **Approve / sign / freeze / amend** | The trust lifecycle, each step a line in the file | [Trust & Signing](./trust-and-signing) |
| **Ed25519 signatures** | `@dotit/sign` — cryptographic identity binding a key to a hash | [Trust §Layer 2](./trust-and-signing#layer-2--identity-ed25519-signatures) |
| **Authority / certification** | UTS `certify:` with root→intermediate X.509-style chain | [Trust §Layer 3](./trust-and-signing#layer-3--authority-uts-certification) |
| **In-file approval routing** | `route:` / `require:` declare *who* must approve, in what order, conditionally | [Approval Workflows](./approval-workflows) |
| **Derived workflow state** | `workflowState()` — pending / next / complete, never stored, can't drift | [Approval Workflows](./approval-workflows#3-read-the-live-state-workflowstate) |
| **Hash-chained audit** | `appendApproval` / `verifyAuditChain` — the approval *order* is tamper-evident | [Approval Workflows](./approval-workflows#4-make-the-order-tamper-evident-the-audit-chain) |
| **Byte preservation** | No tool reformats a `.it`; `reconcileEdit` + storage contract keep seals intact | [Byte Preservation](./byte-preservation) |
| **Amendments** | `amendment:` changes a frozen doc additively, preserving the original seal | [Trust §Amend](./trust-and-signing#step-5-amend-when-needed) |

## Forms, review & compliance

| Capability | What it is | Docs |
| --- | --- | --- |
| **Fillable forms** | `meta: type: form` + `input:` fields; text, choice, date, signature, table, attachment | [Forms](./forms-and-workflows#forms--fillable-signable-documents) |
| **Conditional & computed fields** | `show-if:` reveals fields; `compute:` derives values (safe, no `eval`) | [Forms](./forms-and-workflows#forms--fillable-signable-documents) |
| **Two-party form trust** | Author seals the blank structure; filler seals the answers; both verify independently | [Form trust](./forms-and-workflows#two-party-trust) |
| **Attachments** | Carry files by `href:` reference or embedded base64 (covered by the seal) | [Attachments](./forms-and-workflows#attachments--it-as-a-container) |
| **Redline & compare** | Tracked changes + comments; `compareVersions`; accept/reject | [Redline](./forms-and-workflows#redline--version-compare) |
| **Async co-authoring** | `mergeThreeWay` — merge two independent edits, surfacing conflicts | [Co-authoring](./forms-and-workflows#co-authoring-async-merge) |
| **Redaction** | `applyRedactions` legally *removes* content with a verifiable salted receipt | [Redaction](./forms-and-workflows#redaction) |

## Output & rendering

| Capability | What it is | Docs |
| --- | --- | --- |
| **HTML** | `renderHTML` with 8 built-in themes + per-document house styling | [Themes](../ecosystem/themes) · [Core API](../ecosystem/core-api#renderer) |
| **Print / PDF** | `renderPrint` → WYSIWYG PDF; page setup, headers/footers, watermarks | [PDF export](../cookbook/print/pdf-export) |
| **Accessible (tagged) PDF** | Structure tree + alt text for screen readers (PDF/UA-style) — automatic | [Accessible PDFs](../cookbook/print/pdf-export#accessible-tagged-pdfs) |
| **PDF/A archival** | `toPdfA` — XMP + sRGB + document ID, validated with veraPDF | [Compliance](./forms-and-workflows#legal-signatures--archival-pdf) |
| **PAdES signatures** | `@dotit/pades` — ECDSA + X.509 + CMS PDF signatures Adobe and courts recognize | [Compliance](./forms-and-workflows#legal-signatures--archival-pdf) |
| **Math** | `math:` blocks + inline `[E=mc^2]{math: tex}`; MathML / KaTeX via `@dotit/math` | [Math](./forms-and-workflows#math) |
| **Conversion** | `.it` ⇄ Markdown / HTML / `.xlsx` / `.docx` | [Core API](../ecosystem/core-api#conversion) |

## Agents & workflows

| Capability | What it is | Docs |
| --- | --- | --- |
| **Agent keywords** | `step:` `decision:` `gate:` `trigger:` `result:` `policy:` `audit:` for machine workflows | [Agent keywords](../reference/keywords/agent) · [For Agents](./for-agents) |
| **Workflow extraction / execution** | `extractWorkflow` (DAG) / `executeWorkflow` with a runtime | [Core API](../ecosystem/core-api#workflow) |
| **MCP server** | `@dotit/mcp` — let an AI agent parse, render, query, and seal `.it` over MCP | [MCP server](../ecosystem/mcp-server) |

## Config & integration

| Capability | What it is | Docs |
| --- | --- | --- |
| **Config / options file** | A readable, commentable, *signable* alternative to YAML/JSON | [Config & Options](./config-and-options) |
| **Lossless round-trip** | `parseIntentText` ⇄ `documentToSource` reproduce source byte-for-byte | [Conformance](../reference/conformance) |
| **Storage contract** | `toStorageRecord` / `verifyStorageRecord` — byte-exact persistence, drift detected | [Byte Preservation](./byte-preservation#storing-without-re-encoding-the-storage-contract) |
| **Embeddable editor** | `@dotit/editor` — a controlled React editor over plain `.it` source | [Editor](../ecosystem/editor) |
| **CLI** | `dotit` — seal, verify, amend, history, query, convert, render | [CLI reference](../reference/cli) |
| **SDKs & tools** | npm (`@dotit/*`), PyPI, VS Code extension, Hub | [Ecosystem](../ecosystem/index.md) |
| **ERP / app integration** | The template → merge → seal → PDF pipeline in a backend | [ERP Integration](../ecosystem/erp-integration) |

---

## The five things only `.it` does

If you remember nothing else, these are the capabilities no Word/PDF/YAML/DB stack gives
you in **one portable text file**:

1. **One artifact, six jobs.** Document, data, form, contract, config, and audit trail are
   the same file — no second system to sync. ([Concepts](./concepts))
2. **Trust travels with the file.** A SHA-256 seal anyone can verify offline, forever — no
   vendor, no server. ([Trust & Signing](./trust-and-signing))
3. **The workflow lives inside the document.** Routing policy, live state, and a
   tamper-evident approval trail are derived from the file, not a database.
   ([Approval Workflows](./approval-workflows))
4. **The bytes are sacred.** No tool reformats your file; a sealed document keeps its hash
   through editing, storage, and round-tripping. ([Byte Preservation](./byte-preservation))
5. **It reads like a document and parses like a database.** The same lines a clerk reads,
   code queries. ([A Folder Is a Database](./folder-as-database))

---

**Start here:** [Quick Start](./quick-start) · [Core Concepts](./concepts) · [Reference Overview](../reference)
