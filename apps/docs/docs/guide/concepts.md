---
sidebar_position: 3
title: Core Concepts
---

# Core Concepts

Eight ideas that explain everything in IntentText.

## 1. One line, one intent

Every block in a `.it` file follows one pattern:

```
keyword: value | property: x | property: y
```

```intenttext
text: This is a text block
task: Review the contract | owner: Ahmed | due: 2026-04-15
```

No nesting. No indentation rules. No closing tags. The keyword tells you what the line _is_. The value after the colon is the content. Properties follow pipes.

**Even code follows this rule.** Triple backticks delimit the value — think of it like a stringified JSON object placed as the keyword's value:

````intenttext
code: ```const total = items.reduce((s, i) => s + i.price, 0);``` | lang: js
````

Multi-line code is the same pattern — the backticks wrap the value across lines:

````intenttext
code: ```
SELECT *
FROM users
WHERE active = true
``` | lang: sql
````

The `code:` keyword isn't special. Every block is `keyword: value | properties`. The backticks are just value delimiters — like quotes around a string.

## 2. Keywords

IntentText has a stable **37-keyword canonical core**, plus aliases and extension keywords for specialized domains.

Keywords are grouped into 7 categories:

| Category      | Keywords                                                                                                                                                                                                                                                                           | Purpose                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Identity**  | `title:`, `summary:`, `meta:`, `context:`, `track:`, `agent:`, `model:`                                                                                                                                                                                                            | What the document is          |
| **Content**   | `text:`, `quote:`, `cite:`, `warning:`, `danger:`, `tip:`, `info:`, `success:`, `code:`, `image:`, `link:`, `def:`, `figure:`, `contact:`, `byline:`, `epigraph:`, `caption:`, `footnote:`, `dedication:`                                                                          | What the document says        |
| **Structure** | `section:`, `sub:`, `break:`, `ref:`, `deadline:`, `embed:`, `toc:`                                                                                                                                                                                                                | How the document is organized |
| **Data**      | `columns:`, `row:`, `input:`, `output:`, `metric:`                                                                                                                                                                                                                                 | Typed data blocks             |
| **Agent**     | `step:`, `gate:`, `trigger:`, `signal:`, `decision:`, `memory:`, `prompt:`, `tool:`, `audit:`, `done:`, `error:`, `result:`, `handoff:`, `wait:`, `parallel:`, `retry:`, `call:`, `loop:`, `checkpoint:`, `import:`, `export:`, `progress:`, `task:`, `ask:`, `assert:`, `secret:` | Workflow for AI agents        |
| **Trust**     | `approve:`, `sign:`, `freeze:`, `revision:`, `policy:`, `amendment:`, `history:`                                                                                                                                                                                                   | Document integrity            |
| **Layout**    | `page:`, `font:`, `header:`, `footer:`, `watermark:`, `signline:`, `divider:`                                                                                                                                                                                                      | Print and PDF rendering       |

Every keyword has a purpose. Use `text:` for text, `task:` for trackable work, `metric:` for measurable values, `deadline:` for dates with consequences.

## 3. Pipe properties

Properties follow the content, separated by pipes:

```intenttext
task: Review the contract | owner: Ahmed | due: 2026-04-15 | status: pending
```

The first value after the colon is always the **content**. Everything after a `|` is a **property**. Properties are `key: value` pairs.

Some keywords have specific properties — `task:` understands `owner:`, `due:`, `status:`. Others have general properties — any keyword can use [style properties](../reference/style-properties) like `color:`, `weight:`, `align:`.

## 4. Sections

Sections organize blocks into groups:

```intenttext
section: Scope
text: The project covers phases 1 through 3.

section: Timeline
deadline: Phase 1 complete | date: 2026-06-01
deadline: Phase 2 complete | date: 2026-09-01
```

`section:` renders as H2. `sub:` renders as H3. Blocks belong to the section above them.

## 5. The history boundary

The `history:` keyword separates the document from its history:

```intenttext
title: Consulting Agreement
text: Terms and conditions...

approve: Reviewed | by: Sarah Chen | role: Legal
sign: Ahmed Al-Rashid | role: CEO
freeze: | status: locked

history:
revision: | version: 1.0 | at: 2026-03-06 | by: Ahmed | change: Initial draft
```

Everything above `history:` is the document. Everything below is machine-managed history. You read history. You don't edit it.

## 6. Templates vs documents

Same format, different intent.

A **document** has real data:

```intenttext
title: Invoice INV-2026-042
contact: Acme Corp | role: Client | email: billing@acme.com
```

A **template** has placeholders:

```intenttext
title: Invoice {{invoice.number}}
meta: | type: template
contact: {{client.name}} | role: {{client.role}} | email: {{client.email}}
```

Merge a template with data:

```bash
intenttext invoice-template.it --data client-data.json --html
```

The same parser handles both. Templates are just documents with `{{variables}}`.

## 7. The trust chain

Documents follow a lifecycle: **draft → tracked → approved → signed → frozen → amended**.

```intenttext
track: | version: 1.0 | by: Ahmed          // activate history
approve: Legal review | by: Sarah Chen      // named approval
sign: Ahmed Al-Rashid | role: CEO           // integrity hash seal
freeze: | status: locked                    // seal — no more edits
amendment: Payment terms | section: Payment | was: 30 days | now: 15 days
```

Once frozen, a document can only change through formal `amendment:` blocks. The original seal is preserved. The amendment carries its own approval chain.

## 8. The `.it` file is yours

IntentText is an open format. Your `.it` files are plain text — readable in any editor, storable in any VCS, parseable with any language.

No proprietary format. No vendor lock-in. No binary blobs. The file is yours.

---

**Next:** [Build your first real document →](./first-document)
