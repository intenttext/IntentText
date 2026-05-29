---
sidebar_position: 2
title: Document Identity
---

# Document Identity Keywords

Four keywords that establish what a document is — its title, description, metadata, and execution context.

## `title:`

**Category:** Identity
**Since:** v1.0
**Aliases:** `h1:`

The document title. Renders as H1. Every document should have exactly one.

### Syntax

```
title: content
```

### Examples

```intenttext
title: Service Agreement
title: Q2 2026 Financial Report
title: Invoice {{invoice.number}}
```

### Notes

- One `title:` per document
- In templates, supports `{{variables}}`

---

## `summary:`

**Category:** Identity
**Since:** v1.0
**Aliases:** `abstract:`

Brief description of the document. Renders as a subtitle below the title.

### Syntax

```
summary: content
```

### Examples

```intenttext
summary: Consulting services agreement between Acme Corp and GlobalTech
summary: Monthly financial performance report for the board
```

---

## `meta:`

**Category:** Identity
**Since:** v2.8.1

Document metadata as key-value pairs. Not rendered visually — used for classification, filtering, and template system.

### Syntax

```
meta: | key: value | key: value
```

### Properties

| Property  | Type   | Description                                            |
| --------- | ------ | ------------------------------------------------------ |
| `type`    | string | Document type: `template`, `invoice`, `contract`, etc. |
| `author`  | string | Document author                                        |
| `date`    | string | Document date                                          |
| `version` | string | Document version                                       |
| `lang`    | string | Language code (e.g., `en`, `ar`)                       |
| `license` | string | License identifier                                     |
| `domain`  | string | Business domain (e.g., `finance`, `legal`)             |
| `tags`    | string | Comma-separated tags                                   |
| `theme`   | string | Default theme for rendering                            |

### Examples

```intenttext
meta: | type: template | domain: finance | author: Ahmed Al-Rashid
meta: | type: contract | lang: en | tags: consulting, q2-2026
meta: | theme: corporate | version: 2.1
```

### Notes

- `meta:` content is empty — all data is in pipe properties
- `type: template` is how the merge system identifies templates
- Can have multiple `meta:` blocks — properties merge

---

## `context:`

**Category:** Document Identity
**Since:** v2.0

Execution context for the document — the agent identity, goal, and operating constraints.

### Syntax

```
context: agent name | goal: description | constraints: rules
```

### Properties

| Property      | Type   | Description                       |
| ------------- | ------ | --------------------------------- |
| `agent`       | string | Agent name or identifier          |
| `goal`        | string | What the agent aims to accomplish |
| `constraints` | string | Rules or limitations              |

### Examples

```intenttext
context: Data Migration Agent | goal: Migrate legacy DB to cloud | constraints: Zero downtime
context: Report Generator | goal: Produce monthly financial summary | constraints: Data from SAP only
```

### Notes

- Typically the first block after `title:` in agent task plans
- Sets the framing for all `step:`, `gate:`, and `decision:` blocks that follow

### Related

- [`step:`](./agent#step) — workflow execution unit
- [For Agents guide →](../../guide/for-agents)
