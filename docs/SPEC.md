# IntentText (`.it`) v2.9 — Official Specification

> **Status:** Stable · **Version:** 2.9 · **Source of Truth**

## What IntentText Is

IntentText is a universal semantic line protocol. Every line declares its type,
carries its content, and attaches structured properties — all on one line,
human readable, machine deterministic.

**The complete grammar:**

```
Line     := Type ":" Content ("|" Property)*
Property := Key ":" Value
Content  := any text (inline formatting applies)
```

One pattern. Every block. No exceptions.

**See it in 30 seconds across three domains:**

```
// AI agent workflow
agent: customer-support | model: claude-sonnet-4 | id: cs-agent
policy: Refund window   | if: order_age_days < 30 | action: approve
policy: Tone            | always: professional    | never: casual
step: Get customer      | tool: crm.lookup  | input: {{phone}}  | output: customer
decision: Route intent  | if: {{intent}} == "refund" | then: step-refund | else: step-answer
gate: Escalate          | approver: support-lead | timeout: 2h
audit: Resolved         | by: cs-agent | ref: {{customer.id}} | at: {{timestamp}}
result: Done            | code: 200
```

```
// Writer document
font: | family: Georgia | size: 12pt | leading: 1.8
title: *The Weight of Small Things*
byline: Emad Jumaah | date: March 2026 | publication: Dalil Review
epigraph: We are shaped by the things we carry. | by: Anonymous
note: The city had no memory of rain. | align: justify
quote: To begin is already to be halfway there. | by: Unknown
footnote: 1 | text: Source: field notes, Doha 2024.
```

```
// Business document template
font: | family: Inter | size: 11pt
page: | size: A4 | margins: 20mm | footer: Page {{page}} of {{pages}}
title: Invoice {{invoice.number}}
note: **{{client.name}}** — {{client.address}}
| Description             | Qty             | Total              |
| {{items.0.description}} | {{items.0.qty}} | {{items.0.total}}  |
note: **Total Due: {{totals.due}} {{invoice.currency}}** | align: right
```

Three completely different domains. One syntax. One parser. One format.
The same `.it` file is readable by a journalist, executable by an AI agent,
and renderable as a PDF — without conversion, without interpretation.

---

## 1. Design Philosophy

| Principle                         | Description                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Human-first**                   | Every line reads naturally in plain text.                                                                  |
| **Semantic, not structural**      | Keywords declare _intent_, not just appearance.                                                            |
| **AI-ready**                      | Every block is a typed, parseable data unit.                                                               |
| **Pipe-extensible**               | Metadata stays on the same line via `\|` — no extra files.                                                 |
| **Internationalization-friendly** | UTF-8, line-by-line parsing, no confusing symbols → RTL/Arabic and accented languages are fully supported. |

---

## 2. File Format

- Extension: `.it`
- Encoding: UTF-8
- Line endings: LF or CRLF (both supported)

---

## 3. Keyword Reference

Every semantic block follows this pattern:

```
[Keyword]: [Content] | [Property]: [Value] | [Property]: [Value]
```

### 3.1 Document Identity

| Keyword    | Description                                                   | Example                                                        |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `title:`   | Unique document identifier / title                            | `title: *Project Dalil* Launch Plan`                           |
| `summary:` | Short description of the document                             | `summary: Finalizing deployment in _Doha_.`                    |
| `meta:`    | Document metadata — invisible in output, any properties valid | `meta: \| author: Ahmed \| lang: en \| ref: CONTRACT-2026-042` |

> `meta:` is the escape hatch for any document-level information that
> does not fit `title:`, `summary:`, or `track:`. All properties are
> free-form. The block is completely invisible in rendered output.
> Systems and integrations read it. Readers never see it.

### 3.2 Structure

| Keyword    | Description                               | Example                                 |
| ---------- | ----------------------------------------- | --------------------------------------- |
| `section:` | Opens a new named context / major heading | `section: Logistics & Equipment`        |
| `sub:`     | Sub-section within a section              | `sub: Technical Details`                |
| `divider:` | Visual separator; optional label          | `divider:` or `divider: End of Section` |

> **Note on deeper hierarchy:** `sub:` covers H3-level nesting. If a document requires H4+, use nested `sub:` blocks contextually. A `sub2:` keyword is reserved for v1.1 to keep v1.0 clean.

### 3.3 Data & Tables

| Keyword    | Description                                  | Example                                    |
| ---------- | -------------------------------------------- | ------------------------------------------ |
| `headers:` | Defines column names for a table             | `headers: Item \| Location \| Status`      |
| `row:`     | A single data row (maps to headers in order) | `row: Dell Server \| Rack 04 \| Delivered` |
| `note:`    | A standalone, discrete fact                  | `note: Witness is 40 yrs old`              |

#### Dynamic Table Rows — `each:` property

Add `each: arrayName` to a table header row to repeat the following
template row for every item in the named data array.

    | Description          | Qty          | Total          | each: items |
    | {{item.description}} | {{item.qty}} | {{item.total}} |

The loop variable is the singular form of the array name (`items` → `item`).
Use `each: orders as order` for an explicit loop variable name.

Zero items produces zero data rows. The header row is always rendered.
The `each:` property is invisible in rendered output.

### 3.4 Tasks & Actions

| Keyword     | Description                                  | Example                                                   |
| ----------- | -------------------------------------------- | --------------------------------------------------------- |
| `task:`     | An actionable, trackable to-do               | `task: Database migration \| owner: Ahmed \| due: Sunday` |
| `done:`     | A completed task with a timestamp            | `done: Secure the domain name \| time: 09:00 AM`          |
| `question:` | An open question — AI can flag as unanswered | `question: Who has the _Master Key_?`                     |

**Inline task shorthand:** A `task:` keyword may also appear inside a list line for hybrid bullet/action items:

```
- task: Update README | owner: Sarah | due: Monday
```

The parser treats this identically to a standalone `task:` block, but preserves its position within the surrounding list context.

### 3.5 Media & Links

| Keyword  | Description        | Example                                                                 |
| -------- | ------------------ | ----------------------------------------------------------------------- |
| `image:` | An image reference | `image: Team Photo \| at: assets/photo.png \| caption: Team Day`        |
| `link:`  | A hyperlink        | `link: Google Search \| to: https://google.com \| title: Search Engine` |

Both `image:` and `link:` support optional accessibility properties (`caption:`, `title:`) via the pipe syntax.

### 3.7 References (Cross-Document Links)

| Keyword | Description              | Example                                        |
| ------- | ------------------------ | ---------------------------------------------- |
| `ref:`  | Cross-document reference | `ref: Related Doc \| to: doc.it#section:Tasks` |

The `ref:` keyword creates semantic connections between documents. Unlike `link:` which is for external URLs, `ref:` is specifically for internal/cross-document navigation.

**Properties:**

- `to:` — Target document path with optional anchor (e.g., `doc.it#section:Name`)

**Rendering:** References render as italicized links to distinguish them from regular external links.

### 3.8 The Pipe Syntax — How Properties Work

The `|` character attaches structured properties to any line.
It extends a line without wrapping it. Every segment after `|`
must be `key: value`.

```
// Without properties — still valid
task: Write the introduction

// With one property
task: Write the introduction | owner: Ahmed

// With multiple properties
task: Write the introduction | owner: Ahmed | due: Friday | priority: 1

// Works identically on any keyword
step: Deploy app | tool: k8s.deploy | depends: step-1 | output: deployment
note: Important. | align: center
image: Logo | at: logo.png | caption: Brand mark
policy: Tone rule | always: professional | never: casual
```

**Rules:**

- Split on `|` (space-pipe-space)
- First segment: `type: content`
- Every remaining segment: `key: value`
- Unknown properties are preserved — parsers must not reject them
- Escaped pipe `\|` is a literal character, not a separator

### 3.6 Code

| Keyword | Description                              | Example   |
| ------- | ---------------------------------------- | --------- |
| `code:` | A code block (single-line or multi-line) | See below |
| `end:`  | Closes a multi-line `code:` block        | `end:`    |

**Single-line code** — content follows the keyword on the same line:

```
code: console.log("Hello")
```

**Multi-line code** — use an empty `code:` opener, a fenced block, then `end:` to close:

````
code:
```
SELECT *
FROM users
WHERE active = true
```
end:
````

This makes multi-line blocks unambiguous for parsers without requiring backtick counting.

**Inline code** within any block — use single backticks:

```
note: Footage saved at `/logs/cam1`.
```

### 3.9 Keyword Aliases

IntentText supports keyword aliases — alternative names that map to
canonical keywords. Aliases are resolved by the parser before processing.
All output always uses canonical keywords.

**To add an alias in your parser implementation:**
Add one entry to `src/aliases.ts`. No other files need to change.

| Alias          | Canonical   | Context         |
| -------------- | ----------- | --------------- |
| `text:`        | `note:`     | Writer          |
| `body:`        | `note:`     | Writer          |
| `p:`           | `note:`     | HTML familiar   |
| `paragraph:`   | `note:`     | Writer          |
| `h1:`          | `title:`    | HTML familiar   |
| `h2:`          | `section:`  | HTML familiar   |
| `h3:`          | `sub:`      | HTML familiar   |
| `heading:`     | `section:`  | Writer          |
| `subheading:`  | `sub:`      | Writer          |
| `blockquote:`  | `quote:`    | MD familiar     |
| `cite:`        | `quote:`    | Writer          |
| `check:`       | `task:`     | Natural         |
| `todo:`        | `task:`     | Natural         |
| `action:`      | `task:`     | Natural         |
| `item:`        | `task:`     | Natural         |
| `completed:`   | `done:`     | Natural         |
| `finished:`    | `done:`     | Natural         |
| `rule:`        | `policy:`   | Natural         |
| `constraint:`  | `policy:`   | Formal          |
| `guard:`       | `policy:`   | Developer       |
| `requirement:` | `policy:`   | Formal          |
| `log:`         | `audit:`    | Developer       |
| `lock:`        | `freeze:`   | Intuitive       |
| `on:`          | `trigger:`  | Natural         |
| `run:`         | `step:`     | Developer       |
| `if:`          | `decision:` | Natural         |
| `status:`      | `emit:`     | Backward compat |

Aliases are case-insensitive. `Rule:`, `RULE:`, and `rule:` all resolve
to `policy:`.

---

### 3.10 Print Layout

Print layout keywords are invisible in web rendering. They apply only
when rendering to print HTML or PDF. They are valid in any document that
uses `page:`.

#### `header:` — Running page header

    header: | left: {{company.name}} | center: CONFIDENTIAL | right: {{date}}
    header: | left: Acme Corp | right: CONTRACT-2026-042 | skip-first: true

Three zones: `left:`, `center:`, `right:`. All optional.
`skip-first: true` suppresses header on the first page.

#### `footer:` — Running page footer

    footer: | left: {{contract.ref}} | center: Page {{page}} of {{pages}} | right: {{date}}
    footer: | center: Page {{page}} of {{pages}} | skip-first: true

Same three zones as `header:`. `{{page}}` and `{{pages}}` resolve at render time.

#### `watermark:` — Background watermark

    watermark: CONFIDENTIAL | color: #ff000020 | angle: -45 | size: 72pt
    watermark: DRAFT | angle: -45

Renders as fixed background text on every page.
`watermark:` with no content removes any watermark.

#### `break:` — Pagination control (extended in v2.9)

    break:                          // explicit page break
    break: | before: section       // page break before every section
    break: | keep: table           // never split tables across pages
    break: | keep: sign            // keep signatures with preceding content
    break: | before: section | keep: sign

`before: <keyword>` and `keep: <keyword>` are document-level declarations.
They apply to all blocks of that type throughout the document.

#### `print-mode:` property on `page:`

    page: | size: A4 | margins: 20mm | print-mode: minimal-ink

`minimal-ink` strips background colors and converts text to black.
Intended for black-and-white laser printing.

#### Paper sizes

| Name     | CSS @page size                         |
| -------- | -------------------------------------- |
| `A4`     | A4                                     |
| `A5`     | A5                                     |
| `A3`     | 297mm 420mm                            |
| `Letter` | Letter                                 |
| `Legal`  | 8.5in 14in                             |
| `custom` | uses `width:` and `height:` properties |

---

## 4. List Syntax

Lists use familiar WhatsApp / Markdown syntax — no new keywords required.

```
- Unordered list item
- Another item

1. First ordered step
2. Second ordered step
```

- Lines starting with `-` or `*` → **list-items** (unordered)
- Lines starting with `1.` / `2.` etc. → **step-items** (ordered; AI treats sequence as critical)

---

## 5. Inline Formatting

Inline marks follow WhatsApp conventions and apply inside any block content.

| Syntax       | Result            | Notes                        |
| ------------ | ----------------- | ---------------------------- |
| `*text*`     | **Bold**          | WhatsApp standard            |
| `_text_`     | _Italic_          | WhatsApp standard            |
| `~text~`     | ~~Strikethrough~~ | WhatsApp standard            |
| `` `text` `` | `Code`            | Inline code / path / literal |
| `^text^`     | Highlight         | Soft marker emphasis         |
| `[[text]]`   | Inline note       | Side-note/comment            |
| `@person`    | Mention           | Lightweight attribution      |
| `#topic`     | Tag               | Lightweight topic marker     |

### 5.1 Inline Mark Constraints (v1.0)

- Marks are processed **within a single line** (they do not span lines).
- Marks are **non-nesting** for v1.0. If nested or overlapping marks occur, parsers should treat the ambiguous region as plain text.
- Unmatched delimiters are treated as literal characters.

---

## 5.2 Escaping

To keep parsing deterministic while allowing literal delimiter characters, IntentText supports escaping.

- `\|` represents a literal pipe character `|`.
- `\\` represents a literal backslash `\`.

Escaping applies inside:

- Block content
- Pipe metadata segments
- Table cells (`headers:` / `row:`)

Escaping is evaluated **before** semantic splitting (pipe metadata, table cells), so escaped pipes do not create new segments.

## 6. Pipe Metadata

The `|` symbol appends structured metadata to any keyword line without breaking readability.

**Pattern:**

```
[Keyword]: [Content] | [Property]: [Value] | [Property]: [Value]
```

**Standard properties:**

| Property   | Used With | Description                      |
| ---------- | --------- | -------------------------------- |
| `owner:`   | `task:`   | Person responsible               |
| `due:`     | `task:`   | Deadline                         |
| `time:`    | `done:`   | Completion timestamp             |
| `at:`      | `image:`  | File path or URL to the asset    |
| `caption:` | `image:`  | Accessibility caption / alt text |
| `to:`      | `link:`   | Destination URL                  |
| `title:`   | `link:`   | Accessible link title            |

**Properties are fully open-ended.** Any property key is valid on any block.
The parser preserves everything it does not recognise — without error,
without warning, without loss.

```
// Standard properties
task: Write introduction | owner: Ahmed | due: Friday

// Custom properties — all valid, all parsed, all queryable
task: Write introduction | owner: Ahmed | due: Friday | sprint: 14 | effort: 2h | ticket: DEV-204
quote: Ship it. | by: Ahmed | from: design-review | confidence: high
step: Send email | tool: email.send | region: MENA | sla: 4h | retry_policy: aggressive
note: Patient stable. | doctor: Dr. Hassan | ward: ICU | ref: case-2847
```

The format extends at the point of use, not at the point of definition.
A journalist adds `source:` and `verified:`. A lawyer adds `clause:` and
`jurisdiction:`. A developer adds `sprint:` and `effort:`. All valid.
All stored. All queryable via `queryDocument()`.

#### Known Style Properties

Style properties apply visual formatting when rendered to HTML or print.
They are plain pipe properties — the parser stores them like any property.
The renderer applies them as inline CSS. Unknown style properties are ignored.

| Property   | Effect            | Example                          |
| ---------- | ----------------- | -------------------------------- |
| `color:`   | Text colour       | `note: Warning. \| color: red`   |
| `size:`    | Font size         | `note: Small. \| size: 0.85em`   |
| `family:`  | Font family       | `note: Body. \| family: Georgia` |
| `weight:`  | Font weight       | `note: Bold. \| weight: bold`    |
| `align:`   | Text alignment    | `note: Centre. \| align: center` |
| `bg:`      | Background colour | `note: Highlight. \| bg: yellow` |
| `indent:`  | Left indent       | `note: Indented. \| indent: 2em` |
| `opacity:` | Opacity           | `note: Faded. \| opacity: 0.5`   |
| `italic:`  | Italic text       | `note: Aside. \| italic: true`   |
| `border:`  | Border            | `note: Boxed. \| border: true`   |

Style properties are ignored by parsers that do not support rendering.
The document is valid regardless of which style properties are present.

### 6.1 Typed Conventions (Recommended)

IntentText v1.0 treats all property values as strings, but recommends conventions for interoperability:

- `due:` SHOULD use ISO 8601 dates (e.g. `2026-02-27`).
- `time:` SHOULD use 24-hour time (e.g. `09:00`).

Future versions may introduce typed wrappers (reserved syntax examples):

- `due: @date(2026-02-27)`
- `time: @time(09:00)`

Parsers MUST treat these as plain strings unless a higher-level tool explicitly interprets them.

---

## 7. Parsing Rules (For Implementors)

### Rule 1 — Block Detection

Any line matching `[Keyword]:` at the start is a **semantic block**. Parse the keyword, then split the remainder on `|` to extract content and metadata pairs. Keywords are case-insensitive; content is preserved as-is.

### Rule 2 — Symbol Mapping

- Lines starting with `-` or `*` → `list-item` (unordered)
- Lines starting with `- task:` → `list-item` with embedded `task` block
- Lines starting with a digit followed by `.` → `step-item` (ordered)
- Blank lines → paragraph separator
- All other non-blank, non-keyword lines → `body-text`
- Consecutive `body-text` lines are merged into one prose paragraph until a blank line

### Rule 3 — Inline Processing

After block detection, scan all text values for inline marks (`*`, `_`, `~`, ` ``` `) and convert them to rich-text marks. Inline processing runs _after_ pipe splitting so that marks in both content and property values are handled correctly.

### Rule 4 — Pipe Splitting

Split on `|` (space-pipe-space). The first segment is the primary `content`. Each remaining segment must match `key: value` and is stored as a property. Segments that do not match this pattern are treated as a continuation of content.

Pipe splitting must respect escaping: an escaped pipe `\|` must not be treated as a separator.

### Rule 5 — Multi-line Code Blocks

When a `code:` keyword has no inline content, the parser enters **code-capture mode** and collects all subsequent lines verbatim until it encounters an `end:` keyword on its own line. The captured content is stored as the block's `content`.

### Rule 6 — Scoping and Grouping (v1.0)

- A `section:` (or `sub:`) opens a context; subsequent blocks belong to that context until the next `section:` or `sub:` block.
- `headers:` opens a table; all immediately following `row:` blocks belong to that table.
- A `row:` without a preceding `headers:` is still valid and should be treated as a one-row table.

---

## 8. IntentBlock — Data Structure

Parsers should produce an `IntentBlock` for every detected block. This is ready for JSON serialization, CRM ingestion, or AI agent consumption.

```typescript
interface IntentBlock {
  id: string; // auto-generated UUID or sequential ID
  type: string; // title | section | sub | task | done | question
  // note | table | image | link | code
  // divider | summary | list-item | step-item | body-text
  content: string; // primary text value (inline marks already parsed)
  properties?: Record<string, string | number>; // pipe metadata: owner, due, time, at, to, caption, title, ...
  inline?: Array<
    // canonical inline model (v1.0+)
    | { type: "text"; value: string }
    | { type: "bold"; value: string }
    | { type: "italic"; value: string }
    | { type: "strike"; value: string }
    | { type: "code"; value: string }
    | { type: "highlight"; value: string }
    | { type: "inline-note"; value: string }
    | { type: "mention"; value: string }
    | { type: "tag"; value: string }
  >;
  marks?: Array<{
    // legacy model (offsets may be unreliable)
    type: "bold" | "italic" | "strike" | "code";
    start: number;
    end: number;
  }>;
  children?: IntentBlock[]; // nested blocks (e.g. list-items inside a section)
  table?: {
    // for grouped tables
    headers?: string[];
    rows: string[][];
  };
}
```

## Legacy: `marks`

`marks` is retained for backward compatibility.

The canonical inline representation is `inline: InlineNode[]`.

New implementations MUST emit `inline`.
Renderers SHOULD prefer `inline` when present.

**Example — input:**

```
task: Database migration | owner: Ahmed | due: Sunday
```

**Example — output:**

```json
{
  "id": "blk_001",
  "type": "task",
  "content": "Database migration",
  "properties": {
    "owner": "Ahmed",
    "due": "Sunday"
  }
}
```

---

## 9. Comparison: IntentText vs. Markdown

| Feature         | Markdown         | IntentText                                   | Why IT Wins                            |
| --------------- | ---------------- | -------------------------------------------- | -------------------------------------- |
| Document title  | `# Title`        | `title: My Document`                         | AI identifies it as the unique Doc ID  |
| Main heading    | `## Header`      | `section: Strategy`                          | Explicitly defines a new "Context"     |
| Sub-heading     | `### Sub`        | `sub: Technicals`                            | Natural hierarchy without counting `#` |
| Standalone fact | `- Item`         | `note: Witness is 40 yrs old`                | Distinguishes "data" from "lists"      |
| Unordered list  | `- Item`         | `- Item`                                     | Familiar — same as WhatsApp / MD       |
| Ordered process | `1. Item`        | `1. Item`                                    | Familiar — AI knows order is critical  |
| Actionable task | `- [ ] Task`     | `task: Review File \| owner: Ali`            | Executable; can be tracked in a CRM    |
| Completed task  | `- [x] Task`     | `done: Review File \| time: 2pm`             | Historical; records _when_ it finished |
| Question        | _(none)_         | `question: Where is the key?`                | AI can flag unanswered items           |
| Image           | `![Alt](URL)`    | `image: Logo \| at: img.png \| caption: ...` | Human + accessible                     |
| Link            | `[Text](URL)`    | `link: Web \| to: site.com \| title: ...`    | Human + accessible                     |
| Table header    | `\| H1 \| H2 \|` | `headers: Name \| Role \| Date`              | Portable — no pipe-alignment pain      |
| Table row       | `\| D1 \| D2 \|` | `row: Ahmed \| Admin \| 2026`                | Data-ready — basically a CSV row       |
| Bold            | `**Text**`       | `*Text*`                                     | WhatsApp — everyone knows this         |
| Italic          | `_Text_`         | `_Text_`                                     | WhatsApp — familiar muscle memory      |
| Strikethrough   | `~~Text~~`       | `~Text~`                                     | WhatsApp — simple and fast             |
| Code block      | ` ```…``` `      | `code:` / `end:`                             | Explicit open/close — parser-safe      |
| Divider         | `---`            | `divider:` or `divider: Label`               | Optional label adds context            |

---

## 10. Complete Examples

The same syntax works across entirely different domains.
These three examples show the full range of IntentText in practice.

### 10.1 — AI Agent Definition

```
agent: customer-support | model: claude-sonnet-4 | id: cs-agent

context: | language: arabic | tone: professional | escalation_threshold: 3

policy: Refund standard    | if: order_age_days < 30          | action: approve
policy: Refund extended    | if: customer.tier == "pro"        | action: approve
policy: No digital refund  | if: product.type == "digital"     | action: deny
policy: Fraud block        | if: fraud_score > 0.8             | action: deny  | notify: fraud-team
policy: Escalate anger     | if: sentiment == "angry" | after: 3_turns          | action: gate
policy: Language           | always: respond_in_user_language
policy: Tone               | always: professional | never: casual

trigger: webhook | event: message.received

step: Get customer     | tool: crm.lookup      | input: {{phone}}       | output: customer    | id: step-1
step: Get order        | tool: orders.latest   | input: {{customer.id}} | output: order       | id: step-2 | depends: step-1
step: Score sentiment  | tool: llm.sentiment   | input: {{message}}     | output: sentiment   | id: step-3
step: Check fraud      | tool: fraud.score     | input: {{customer.id}} | output: fraudScore  | id: step-4

decision: Route intent | if: {{intent}} == "refund"              | then: step-refund  | else: step-answer
decision: Refund check | if: {{order.age_days}} < 30             | then: step-approve | else: step-deny
step: Approve refund   | tool: orders.refund   | input: {{order.id}}    | output: refund      | id: step-approve
step: Deny refund      | tool: whatsapp.send   | input: "Refund window expired"               | id: step-deny
step: Answer query     | tool: llm.answer      | input: {{message}}     | output: response    | id: step-answer
step: Send reply       | tool: whatsapp.send   | input: {{response}}    | output: sent

gate: Human escalation | approver: support-lead | timeout: 2h | trigger: {{turns}} > 3

checkpoint: post-response
audit: Interaction logged | by: cs-agent | ref: {{customer.id}} | at: {{timestamp}}
emit: support.resolved    | data: {{sent}} | channel: analytics
result: Resolved          | code: 200
```

### 10.2 — Writer Document

```
font: | family: Georgia | size: 12pt | leading: 1.8 | heading: Playfair Display
page: | size: A5 | margins: 24mm | footer: {{page}} | numbering: roman

title: *The Weight of Small Things*
byline: Emad Jumaah | date: March 2026 | publication: Dalil Review
toc: | depth: 2 | title: Contents

---

epigraph: We are shaped by the things we carry, not the things we put down. | by: Anonymous
dedication: For everyone who builds quietly, without applause.

---

section: Part One — Beginnings
sub: The First Morning

note: The city had no memory of rain. Not in the way cities forget things — deliberately,
with purpose — but in the way a child forgets a dream, completely and without regret. | align: justify

quote: To begin is already to be halfway there. | by: Unknown

note: She stood at the window for a long time before she understood that the view had
not changed. She had. | align: justify

image: The window | at: window.jpg | caption: Looking out, not looking away.
footnote: 1 | text: This scene was inspired by a photograph taken in Doha, winter 2024.

---

section: Part Two — The Work
sub: What Gets Built

note: Most things worth building are built slowly, in the hours between other things.
In the margins of the day. In the quiet after everyone else has stopped. | align: justify

warning: The temptation is always to wait for a better time. There is no better time.
tip: Write the first draft as if no one will read it. Edit as if everyone will.

note: She had learned this the hard way — that the work does not announce itself.
It simply accumulates, line by line, day by day, until one morning you look up and
realise something exists that did not exist before. | align: justify

---

section: Acknowledgements
note: This would not exist without the people who asked the right questions at the right time.
```

### 10.3 — Business Document with Placeholders

```
font: | family: Inter | size: 11pt | leading: 1.6 | mono: JetBrains Mono
page: | size: A4 | margins: 20mm | header: {{company.name}} | footer: Page {{page}} of {{pages}}

title: Invoice {{invoice.number}}
summary: Issued by {{company.name}} to {{client.name}} — {{invoice.date}}

---

section: Issued By
note: **{{company.name}}**
note: {{company.address}}, {{company.city}}, {{company.country}}
note: {{company.email}} · {{company.phone}}

section: Billed To
note: **{{client.name}}**
note: {{client.address}}, {{client.city}}, {{client.country}}
note: {{client.email}}

section: Invoice Details
| Field        | Value                |
| Invoice No.  | {{invoice.number}}   |
| Issue Date   | {{invoice.date}}     |
| Due Date     | {{invoice.due_date}} |
| Currency     | {{invoice.currency}} |

section: Services
| Description              | Qty              | Unit Price             | Total             |
| {{items.0.description}}  | {{items.0.qty}}  | {{items.0.unit_price}} | {{items.0.total}} |
| {{items.1.description}}  | {{items.1.qty}}  | {{items.1.unit_price}} | {{items.1.total}} |
| {{items.2.description}}  | {{items.2.qty}}  | {{items.2.unit_price}} | {{items.2.total}} |

---

note: Subtotal: **{{totals.subtotal}} {{invoice.currency}}**             | align: right
note: Tax ({{totals.tax_rate}}%): **{{totals.tax}} {{invoice.currency}}**| align: right
note: **Total Due: {{totals.due}} {{invoice.currency}}**                 | align: right

---

section: Payment
note: {{payment.instructions}}
note: Bank: **{{payment.bank}}** · IBAN: **{{payment.iban}}** · Ref: **{{invoice.number}}**

section: Notes
note: {{invoice.notes}}
tip: Payment due by {{invoice.due_date}}. Late payments subject to {{payment.late_fee}}% monthly fee.

result: Invoice {{invoice.number}} | code: 200
```

---

## 11. Reserved Keywords (v1.0)

**Layer 1 — Document Identity (9):** `title` · `summary` · `section` · `sub` · `divider` · `note` · `headers` · `row` · `code` · `end` · `track`

**Layer 2 — Human Content (10):** `task` · `done` · `ask` · `quote` · `info` · `warning` · `tip` · `success` · `link` · `image`

**Layer 3 — Agentic Workflow (19):** `step` · `decision` · `parallel` · `loop` · `call` · `gate` · `wait` · `retry` · `error` · `trigger` · `checkpoint` · `handoff` · `audit` · `emit` · `result` · `policy` · `progress` · `import` · `export` · `context`

**Layer 4 — Document Generation (9):** `font` · `page` · `break` · `byline` · `epigraph` · `caption` · `footnote` · `toc` · `dedication`

**Layer 5 — Document Trust (4):** `approve` · `sign` · `freeze` · `revision`

**Alias:** `status` → `emit` (backward compatibility)

All keywords are **case-insensitive** (`Title:` = `title:`). User content is always preserved as written.

**Removed in v2.3:** `schema:` (runtime concern, not format concern).

**Reserved for future versions:** `sub2` (deeper hierarchy), `embed` (rich embeds).

### 11.1 Extension Keywords

To support safe experimentation without fragmenting the core format, extensions should use a prefixed keyword namespace:

- `x-<name>:` (experimental)
- `ext-<name>:` (tool/vendor-specific)

Parsers should preserve unknown extension blocks as `body-text` (or optionally emit a warning diagnostic) and must not crash.

---

## 12. Document Trust

IntentText includes a native trust system for documents that require approval, signing, freezing, and audit trails. This is opt-in — documents without `track:` are completely unaffected.

### 12.1 Activation

Add `track:` after `title:` and `summary:` to activate:

    track: | version: 1.0 | by: Ahmed

### 12.2 The Trust Lifecycle

    draft → tracked → approved → signed → frozen

- **draft** — no `track:` block. Normal editing, no history.
- **tracked** — `track:` present. Every save records what changed.
- **approved** — `approve:` blocks present. Process approval recorded.
- **signed** — `sign:` blocks present. Cryptographic binding to content.
- **frozen** — `freeze:` block present. Document is immutable.

### 12.3 The History Boundary

A `---` divider followed by `// history` marks the system metadata section. Everything below this boundary is CLI-owned. Renderers ignore it. Editors hide it. Parsers skip it for block output.

### 12.4 New Keywords

**`track:`** — Activates history tracking. Properties: `version`, `by`.

**`approve:`** — Workflow approval stamp. Properties: `by`, `role`, `at`, `ref`.

**`sign:`** — Cryptographic signature. Content is the signer name. Properties: `role`, `at`, `hash`.

**`freeze:`** — Seals the document. Properties: `at`, `hash`, `status`.

**`revision:`** — System-generated change record in the history section. Properties: `version`, `at`, `by`, `change`, `id`, `block`, `section`, `was`, `now`.

### 12.5 CLI Commands

    intenttext seal <file>    — sign and freeze a document
    intenttext verify <file>  — verify document integrity
    intenttext history <file> — display change history

### 12.6 History Section Format

Below the history boundary:

```
---
// history

// registry
b-1a2 | title | root | service agreement
b-3c4 | note | Payment | net 30 days from invoice

// revisions
revision: | version: 1.1 | at: 2026-03-03T09:00:00Z | by: Sarah | change: added | id: b-5e6 | block: note | section: Scope | now: Consulting included
```

---

## 13. Versioning

| Version    | Status    | Notes                                                                                                         |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| **v1.0**   | ✅ Stable | Core format                                                                                                   |
| **v1.3**   | ✅ Stable | Query, Schema, Converters, Accessibility                                                                      |
| **v1.4**   | ✅ Stable | Cleanup, fixture accuracy, spec overhaul                                                                      |
| **v2.0**   | ✅ Stable | Agentic workflow blocks, document metadata, interchange format                                                |
| **v2.3**   | ✅ Stable | gate/call/emit, `{{variable}}` interpolation, join/on properties, removed schema                              |
| **v2.4**   | ✅ Stable | Writer-first inline syntax, prose paragraphs, alignment                                                       |
| **v2.5**   | ✅ Stable | Document Generation Engine: layout blocks, writer blocks, template merge, print                               |
| **v2.6**   | ✅ Stable | Production API: parseIntentTextSafe, documentToSource, validateDocumentSemantic, queryDocument, diffDocuments |
| **v2.7**   | ✅ Stable | `policy:` keyword — standing behavioural rules for AI agents                                                  |
| **v2.8**   | ✅ Stable | Document Trust: `track`, `approve`, `sign`, `freeze`, `revision` — seal, verify, change history               |
| **v2.8.1** | ✅ Stable | `meta:` keyword, `each:` dynamic table rows, keyword aliases, known style properties                          |
| **v2.9**   | ✅ Stable | Print Quality: `header:`, `footer:`, `watermark:` keywords, extended `break:`, `print-mode:`, paper sizes     |

### 12.1 Implemented Features (v1.0 – v1.3)

#### Query Language (v1.2+)

Query IntentText documents using a SQL-like syntax.

```bash
node cli.js document.it --query "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10"
```

| Operator             | Description     | Example                   |
| -------------------- | --------------- | ------------------------- |
| `=`                  | Equality        | `type=task`               |
| `!=`                 | Not equal       | `status!=done`            |
| `<`, `>`, `<=`, `>=` | Comparison      | `due<2026-03-01`          |
| `:contains`          | Substring match | `content:contains=urgent` |
| `:startsWith`        | Prefix match    | `content:startsWith=API`  |
| `?`                  | Field exists    | `priority?`               |
| `sort:field:dir`     | Sorting         | `sort:due:asc`            |
| `limit:N`            | Limit results   | `limit:10`                |
| `offset:N`           | Pagination      | `offset:5`                |

#### Schema Validation (v1.2+)

Validate documents against predefined or custom schemas.

```bash
node cli.js project.it --validate project
node cli.js article.it --validate article
```

| Schema      | Required Blocks    | Block Schemas                              |
| ----------- | ------------------ | ------------------------------------------ |
| `project`   | `title`            | task (owner, due, priority), done (time)   |
| `meeting`   | `title`, `section` | note, question, task (owner, due required) |
| `article`   | `title`, `summary` | image (at required), link, section         |
| `checklist` | `title`            | task, done                                 |

#### Converters (v1.3+)

- **Markdown → IntentText**: `convertMarkdownToIntentText(md)`
- **HTML → IntentText**: `convertHtmlToIntentText(html)` (Node.js only)

#### Accessibility Features (v1.3+)

- **Implicit paragraphs**: Lines without keywords become `body-text` blocks
- **Checkbox tasks**: `[ ] todo` and `[x] done` syntax
- **Inline links**: `[text](url)` inside any content
- **Property shortcuts**: `@owner`, `!high`, `!critical`
- **Callouts**: `info:`, `warning:`, `tip:`, `success:` blocks
- **Markdown-style tables**: `| col1 | col2 |` syntax
- **Emoji shortcuts**: 🚨 (priority), 📅 (due), ✅ (completed), ⏰ (time)

### 12.2 Agentic Workflow Blocks (v2.0)

> **Updated in v2.3** — added `gate:`, `call:`, `emit:` keywords; `{{variable}}` interpolation; `join:` on parallel; `on:` on wait; removed `schema:` standalone block; `status:` is now an alias for `emit:`.

IntentText v2 adds a new layer of **agentic workflow blocks** on top of the v1 core. These blocks enable AI agents to write, read, and execute `.it` documents as structured workflow specifications. All v1 syntax is fully backward compatible.

#### Document Header Metadata

v2 introduces document-level metadata for agent identification:

```
title: User Onboarding Flow
agent: onboard-agent | model: claude-sonnet-4
context: | userId: u_123 | plan: pro
```

- **`agent:`** — When appearing before any `section:`, populates `metadata.agent` (not emitted as a block). Pipe properties like `model:` also populate metadata.
- **`model:`** — When appearing before any `section:`, populates `metadata.model`.
- **`context:`** — Parses key-value pairs into both block properties and `metadata.context`. Supports both pipe syntax (`| key: value`) and legacy syntax (`key = "value"`).

#### Workflow Block Reference

| Keyword       | Purpose                         | Example                                                                  |
| ------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `step:`       | A workflow step with tool call  | `step: Send email \| tool: email.send \| input: userId`                  |
| `decision:`   | Conditional branch              | `decision: Check status \| if: x == "y" \| then: step-2 \| else: step-3` |
| `trigger:`    | What starts this workflow       | `trigger: webhook \| event: user.signup`                                 |
| `loop:`       | Iterate over a collection       | `loop: Process items \| over: itemList \| do: step-3`                    |
| `checkpoint:` | Resume point after interruption | `checkpoint: post-verification`                                          |
| `audit:`      | Immutable execution log         | `audit: Step completed \| by: agent \| at: {{timestamp}}`                |
| `error:`      | Error handler                   | `error: On failure \| fallback: step-2 \| notify: admin`                 |
| `import:`     | Import another `.it` file       | `import: ./auth-flow.it \| as: auth`                                     |
| `export:`     | Export data from document       | `export: userRecord \| format: json`                                     |
| `progress:`   | Progress bar indicator          | `progress: 3/5 tasks completed`                                          |
| `context:`    | Scoped variable definitions     | `context: \| userId: u_123 \| plan: pro`                                 |
| `gate:`       | Human approval checkpoint       | `gate: Approve deploy \| approver: lead-eng \| timeout: 24h`             |
| `call:`       | Sub-workflow composition        | `call: ./verify-email.it \| input: {{email}} \| output: verified`        |
| `emit:`       | Workflow signal / status event  | `emit: deploy.running \| phase: deploy \| level: info`                   |
| `result:`     | Execution output                | `result: User created \| code: 200 \| data: {"id":"u_123"}`              |
| `handoff:`    | Multi-agent transfer            | `handoff: Transfer \| from: agent-a \| to: agent-b`                      |
| `wait:`       | Async pause point               | `wait: User confirmation \| on: human.approved \| timeout: 30s`          |
| `parallel:`   | Concurrent execution group      | `parallel: Run checks \| steps: validate,lint,test \| join: all`         |
| `retry:`      | Retry policy                    | `retry: API call \| max: 3 \| delay: 1000 \| backoff: exponential`       |
| `policy:`     | Standing behavioural rule       | `policy: Refund window \| if: order_age_days < 30 \| action: approve`    |

> **Note:** `status:` is accepted as an alias for `emit:` for backward compatibility. The parser auto-maps `status:` → `emit:`.

#### Pipe Properties for v2 Blocks

| Property      | Purpose                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `id:`         | Unique block identifier for cross-references                                                      |
| `depends:`    | Dependency on another block by id                                                                 |
| `input:`      | Input variable name (supports `{{variable}}` refs)                                                |
| `output:`     | Output variable name                                                                              |
| `tool:`       | Tool or function to invoke                                                                        |
| `model:`      | AI model for this step                                                                            |
| `status:`     | Execution state (pending/running/blocked/failed/skipped/cancelled/done/approved/rejected/waiting) |
| `confidence:` | Agent certainty (0.0–1.0)                                                                         |
| `source:`     | `human` or `ai` — who authored this block                                                         |
| `if:`         | Condition expression (decision blocks)                                                            |
| `then:`       | Branch target if condition true                                                                   |
| `else:`       | Branch target if condition false                                                                  |
| `event:`      | Trigger event name                                                                                |
| `over:`       | Loop collection variable                                                                          |
| `do:`         | Loop step target                                                                                  |
| `fallback:`   | Error fallback step id                                                                            |
| `notify:`     | Error notification target                                                                         |
| `as:`         | Import alias                                                                                      |
| `format:`     | Export format (json/yaml/csv)                                                                     |
| `timeout:`    | Maximum execution time (numeric ms or string with unit, e.g. `30s`)                               |
| `priority:`   | Step execution priority (numeric, lower = higher priority)                                        |
| `data:`       | Structured data payload (preserved as string)                                                     |
| `retries:`    | Maximum retry count (numeric)                                                                     |
| `delay:`      | Wait before executing (numeric ms or string with unit)                                            |
| `level:`      | Log/status severity level (e.g. `info`, `warning`, `critical`)                                    |
| `phase:`      | Current workflow phase                                                                            |
| `from:`       | Source agent for handoff                                                                          |
| `to:`         | Target agent for handoff                                                                          |
| `steps:`      | Comma-separated step IDs for parallel execution                                                   |
| `max:`        | Maximum retry attempts (numeric)                                                                  |
| `backoff:`    | Retry backoff strategy (`linear`, `exponential`)                                                  |
| `code:`       | HTTP status code or result code                                                                   |
| `join:`       | Barrier semantics for `parallel:` (`all`, `any`, `none`). Default: `all`                          |
| `on:`         | Trigger condition for `wait:` (e.g. `smoketest.complete`, `human.approved`)                       |
| `approver:`   | Person/role required for `gate:` approval                                                         |

#### `step:` block

Steps are the primary workflow unit. If no explicit `| id:` is provided, the parser auto-generates sequential IDs: `step-1`, `step-2`, etc. Status defaults to `pending`.

**Syntax:**

```
step: Verify email | tool: email.verify | input: userId | output: emailStatus
step: Create workspace | tool: ws.create | depends: step-1
```

**JSON output:**

```json
{
  "id": "step-1",
  "type": "step",
  "content": "Verify email",
  "properties": {
    "id": "step-1",
    "tool": "email.verify",
    "input": "userId",
    "output": "emailStatus",
    "status": "pending"
  }
}
```

#### `decision:` block

Conditional branches that reference other steps.

**Syntax:**

```
decision: Check plan | if: plan == "pro" | then: step-3 | else: step-4
```

**JSON output:**

```json
{
  "type": "decision",
  "content": "Check plan",
  "properties": {
    "if": "plan == \"pro\"",
    "then": "step-3",
    "else": "step-4"
  }
}
```

#### `audit:` block

Immutable execution log entries. Template variables `{{timestamp}}` and `{{agent}}` pass through unparsed — the runtime is responsible for substitution.

**Syntax:**

```
audit: Workflow initialized | by: {{agent}} | at: {{timestamp}}
```

**JSON output:**

```json
{
  "type": "audit",
  "content": "Workflow initialized",
  "properties": {
    "by": "{{agent}}",
    "at": "{{timestamp}}"
  }
}
```

#### `context:` block

Defines scoped variables. Preferred syntax is pipe-style (`| key: value`). Legacy `key = "value"` syntax is also supported for backward compatibility. Values populate both block properties and `metadata.context` when appearing before any section.

**Syntax:**

```
context: | userId: u_123 | plan: pro
context: userId = "u_123" | plan = "pro"   // legacy — still valid
```

**JSON output:**

```json
{
  "type": "context",
  "content": "| userId: u_123 | plan: pro",
  "properties": {
    "userId": "u_123",
    "plan": "pro"
  }
}
```

#### `checkpoint:` block

A named resume point in the workflow. Content only, no required properties.

**Syntax:**

```
checkpoint: onboarding-complete
```

#### `error:` block

Defines error handling with fallback steps and notification targets.

**Syntax:**

```
error: On failure | fallback: step-2 | notify: admin
```

#### `trigger:` block

Declares what starts the workflow.

**Syntax:**

```
trigger: webhook | event: user.signup
```

#### `loop:` block

Iterates over a collection.

**Syntax:**

```
loop: Process items | over: itemList | do: step-3
```

#### `import:` / `export:` blocks

Define document composition and data interfaces.

**Syntax:**

```
import: ./auth-flow.it | as: auth
export: userRecord | format: json
```

#### `progress:` block

Renders a progress indicator. Parses `value/total` from content or from explicit properties.

**Syntax:**

```
progress: 3/5 tasks completed
progress: Upload | value: 75 | total: 100
```

#### `{{variable}}` Interpolation _(v2.3)_

Any property value containing `{{identifier}}` or `{{identifier.path}}` is a **variable reference**. The parser preserves these as-is in JSON output — the runtime is responsible for substitution.

Variable references enable data wiring between steps:

**Syntax:**

```
step: Fetch user   | tool: api.getUser | input: {{userId}}  | output: userData
step: Send email   | tool: email.send  | to: {{userData.email}}
gate: Confirm deletion | approver: {{requester}}
audit: Completed | by: {{agent}} | at: {{timestamp}}
```

**Scope:** Flat. Variables reference names declared in `context:` blocks or `output:` properties on steps. No closures or nesting.

**Parser behavior:** The parser detects `{{...}}` patterns in property values and preserves them as string values. Runtime tools may interpret them as typed references:

```json
{
  "input": "{{userId}}",
  "to": "{{userData.email}}"
}
```

#### `emit:` block _(v2.3)_

Declares a workflow signal or status event. Replaces the former `status:` standalone block. The `status:` keyword is accepted as an alias and auto-mapped to `emit:`. Default `level:` is `info`.

**Syntax:**

```
emit: deploy.running | phase: deploy | level: info
emit: Build complete | phase: ci | level: success
```

**JSON output:**

```json
{
  "type": "emit",
  "content": "deploy.running",
  "properties": {
    "phase": "deploy",
    "level": "info"
  }
}
```

> **Alias:** `status: Running | phase: deploy` is parsed identically to `emit: Running | phase: deploy`.

#### `gate:` block _(v2.3)_

Human approval checkpoint — the most important safety primitive in agentic systems. Status defaults to `blocked`. Transitions to `approved` or `rejected`. On rejection or timeout, takes `fallback:` action.

**Syntax:**

```
gate: Approve production deploy | approver: lead-engineer | timeout: 24h | fallback: exit
gate: Review AI-generated copy | approver: content-team | timeout: 4h
gate: Confirm customer deletion | approver: {{requester}}
```

**JSON output:**

```json
{
  "type": "gate",
  "content": "Approve production deploy",
  "properties": {
    "status": "blocked",
    "approver": "lead-engineer",
    "timeout": "24h",
    "fallback": "exit"
  }
}
```

#### `call:` block _(v2.3)_

Synchronous sub-workflow composition. The called `.it` file executes to its `result:`, which binds to the `output:` variable. For async composition, use `handoff:` instead. Status defaults to `pending`.

**Syntax:**

```
call: ./verify-email.it | input: {{userData.email}} | output: verified
call: ./create-workspace.it | input: {{userData}} | output: workspace
call: ./notify-team.it
```

**JSON output:**

```json
{
  "type": "call",
  "content": "./verify-email.it",
  "properties": {
    "status": "pending",
    "input": "{{userData.email}}",
    "output": "verified"
  }
}
```

#### `result:` block _(v2.1)_

Captures execution output. Status defaults to `"success"` if not provided.

**Syntax:**

```
result: User created successfully | code: 200 | data: {"id":"u_123"}
result: Request failed | status: error | code: 500
```

**JSON output:**

```json
{
  "type": "result",
  "content": "User created successfully",
  "properties": {
    "status": "success",
    "code": "200",
    "data": "{\"id\":\"u_123\"}"
  }
}
```

#### `handoff:` block _(v2.1)_

Declares multi-agent control transfer.

**Syntax:**

```
handoff: Transfer to billing | from: onboarding-agent | to: billing-agent
```

**JSON output:**

```json
{
  "type": "handoff",
  "content": "Transfer to billing",
  "properties": {
    "from": "onboarding-agent",
    "to": "billing-agent"
  }
}
```

#### `wait:` block _(v2.1, updated v2.3)_

Async pause point. Status defaults to `"waiting"`. Supports `on:` condition, `timeout:` (with optional unit suffix), and `fallback:`.

**Syntax:**

```
wait: Smoke tests | on: smoketest.complete | timeout: 60s | fallback: rollback
wait: Human approval | on: human.approved | timeout: 24h
wait: User confirmation | timeout: 30s | fallback: step-3
```

**JSON output:**

```json
{
  "type": "wait",
  "content": "Smoke tests",
  "properties": {
    "status": "waiting",
    "on": "smoketest.complete",
    "timeout": "60s",
    "fallback": "rollback"
  }
}
```

#### `parallel:` block _(v2.1, updated v2.3)_

Concurrent execution group. Lists step IDs as comma-separated values in the `steps:` property. Supports `join:` barrier semantics: `all` (wait for all, default), `any` (continue on first done), `none` (fire and forget).

**Syntax:**

```
parallel: Run checks | steps: validate,lint,test | join: all
parallel: Race handlers | steps: fast,slow | join: any
parallel: Batch jobs | timeout: 60000
```

**JSON output:**

```json
{
  "type": "parallel",
  "content": "Run checks",
  "properties": {
    "steps": "validate,lint,test",
    "join": "all"
  }
}
```

#### `retry:` block _(v2.1)_

Defines retry policy. Numeric properties (`max`, `delay`, `retries`) are auto-coerced to numbers.

**Syntax:**

```
retry: API call | max: 3 | delay: 1000 | backoff: exponential
retry: Send email | retries: 5
```

**JSON output:**

```json
{
  "type": "retry",
  "content": "API call",
  "properties": {
    "max": 3,
    "delay": 1000,
    "backoff": "exponential"
  }
}
```

### 12.2.1 How an Agent Reads an IntentText Document

When an agent receives a `.it` file — via the MCP server, direct parse,
or file query — it sees a flat sequence of typed blocks:

```javascript
[
  {
    type: "agent",
    content: "customer-support",
    properties: { model: "claude-sonnet-4", id: "cs-agent" },
  },

  {
    type: "policy",
    content: "Refund window",
    properties: { if: "order_age_days < 30", action: "approve" },
  },

  {
    type: "policy",
    content: "Tone",
    properties: { always: "professional", never: "casual" },
  },

  {
    type: "step",
    content: "Get customer",
    properties: {
      tool: "crm.lookup",
      input: "{{phone}}",
      output: "customer",
      id: "step-1",
    },
  },

  {
    type: "decision",
    content: "Route intent",
    properties: {
      if: "{{intent}} == 'refund'",
      then: "step-refund",
      else: "step-answer",
    },
  },

  {
    type: "gate",
    content: "Escalate",
    properties: { approver: "support-lead", timeout: "2h" },
  },

  {
    type: "audit",
    content: "Resolved",
    properties: { by: "cs-agent", ref: "{{customer.id}}", at: "{{timestamp}}" },
  },

  { type: "result", content: "Done", properties: { code: "200" } },
];
```

The agent:

- Queries all `policy:` blocks to understand its own behavioural rules
- Follows `step:` → `decision:` → `gate:` as an execution graph
- Pauses at `gate:` until a human approves
- Writes `audit:` blocks back into the document as execution records
- Updates `status:` properties on each block as execution progresses
- Returns the modified `.it` document as the execution record

The `.it` file is simultaneously the agent's instruction set, its
execution plan, and its audit trail — all in one human-readable file
that the person who owns the agent can open, read, and edit in any
text editor.

### 12.3 Document Generation Engine (v2.5)

> **Added in v2.5** — Layout blocks, writer blocks, template merge engine, and print rendering.

IntentText v2.5 adds a complete document generation layer. An `.it` file can serve as a **template** with `{{placeholders}}`; a separate JSON object provides the **data**. The engine merges them and renders print-ready output.

All v2.4 and earlier syntax is fully backward compatible.

#### Layout Blocks

Layout blocks declare document-level typography and page settings. They should appear near the top of the document, before content.

##### `font:` — Typography declaration

```
font: | family: Georgia | size: 12pt | leading: 1.6
```

| Property  | Description                        | Default     |
| --------- | ---------------------------------- | ----------- |
| `family`  | Body font family                   | `Georgia`   |
| `size`    | Base font size (`pt`, `px`, `rem`) | `12pt`      |
| `leading` | Line height multiplier             | `1.6`       |
| `weight`  | `normal` or `bold`                 | `normal`    |
| `heading` | Heading font family (if different) | _(same)_    |
| `mono`    | Monospace font for code            | `monospace` |

##### `page:` — Page layout declaration

```
page: | size: A4 | margins: 20mm | header: {{title}} | footer: Page {{page}} of {{pages}}
```

| Property      | Description                               | Default    |
| ------------- | ----------------------------------------- | ---------- |
| `size`        | `A4`, `A5`, `Letter`, `Legal`, `custom`   | `A4`       |
| `margins`     | Single value or `top:20mm right:15mm ...` | `20mm`     |
| `header`      | Header text (supports `{{variables}}`)    | _(none)_   |
| `footer`      | Footer text (supports `{{variables}}`)    | _(none)_   |
| `columns`     | `1`, `2`, or `3`                          | `1`        |
| `orientation` | `portrait` or `landscape`                 | `portrait` |
| `numbering`   | `true` or `false`                         | `false`    |

##### `break:` — Explicit page break

```
break:
```

Inserts a page break in print output. No content or properties required.

#### Writer Blocks

Writer blocks are semantic elements for book-style and professional document authoring.

##### `byline:` — Author attribution

```
byline: Ahmed Al-Rashid | role: Senior Reporter | date: 2026-03-15
```

##### `epigraph:` — Opening quotation

```
epigraph: The only way to do great work is to love what you do. | source: Steve Jobs
```

##### `caption:` — Figure or table caption

```
caption: Figure 1 — Revenue growth by quarter
```

##### `footnote:` — Footnote definition

```
footnote: 1 | Sources: World Bank Open Data 2025, IMF Fiscal Monitor.
```

Referenced inline with `{1}` syntax, which renders as a superscript link to the footnote.

##### `toc:` — Table of contents

```
toc: | depth: 2 | title: Contents
```

| Property | Description                                    | Default    |
| -------- | ---------------------------------------------- | ---------- |
| `depth`  | Heading depth to include (`1` = sections only) | `2`        |
| `title`  | Heading text for the TOC                       | `Contents` |

##### `dedication:` — Book dedication

```
dedication: To my family, who believed in this project from day one.
```

#### Template Merge Engine

The merge engine resolves `{{variable}}` placeholders in an `.it` document using a JSON data object.

**API:**

```typescript
import { mergeData, parseAndMerge } from "@intenttext/core";

// Merge placeholders in a parsed document
const merged = mergeData(document, data);

// Parse + merge in one step
const doc = parseAndMerge(itString, data);
```

**Variable resolution:**

- Dot notation: `{{company.name}}` → `data.company.name`
- Array indices: `{{items.0.description}}` → `data.items[0].description`
- System variables: `{{date}}` → current date, `{{year}}` → current year
- Runtime variables: `{{page}}`, `{{pages}}` — left as-is for the print renderer
- Missing variables: block is marked `unresolved: 1`

**Example data file** (`invoice.data.json`):

```json
{
  "company": { "name": "Acme Corp" },
  "invoice_number": "INV-2026-001",
  "items": [{ "description": "Consulting", "amount": "12,000" }]
}
```

#### Print Rendering

The `renderPrint()` function produces a print-optimized full HTML document with embedded CSS. It reads `font:` and `page:` blocks to generate dynamic styles.

**API:**

```typescript
import { renderPrint } from "@intenttext/core";

const printHTML = renderPrint(document);
// Full <!DOCTYPE html> document ready for printing or PDF conversion
```

**CLI usage:**

```bash
# Merge data and render HTML
node cli.js template.it --data data.json --html

# Render print-optimized HTML
node cli.js template.it --data data.json --print

# Generate PDF (requires puppeteer)
node cli.js template.it --data data.json --pdf output.pdf
```

### 12.4 Production API (v2.6)

> **Added in v2.6** — Five new APIs that complete the public surface and make the library production-safe.

All v2.5 and earlier syntax is fully backward compatible. No new keywords — these are programmatic APIs.

#### `parseIntentTextSafe(source, options?)` — Safe parser wrapper

Production-grade parser that **never throws**. Wraps `parseIntentText` with configurable limits and unknown-keyword handling.

| Option           | Type                              | Default  | Description                              |
| ---------------- | --------------------------------- | -------- | ---------------------------------------- |
| `unknownKeyword` | `'note'` \| `'skip'` \| `'throw'` | `'note'` | How to handle unrecognised keywords      |
| `maxBlocks`      | `number`                          | `10000`  | Maximum number of blocks before stopping |
| `maxLineLength`  | `number`                          | `50000`  | Lines longer than this are truncated     |
| `strict`         | `boolean`                         | `false`  | Unknown keywords become errors           |

**Returns:** `SafeParseResult` — `{ document, warnings[], errors[] }`

**Warning codes:** `LINE_TRUNCATED`, `UNKNOWN_KEYWORD`, `MAX_BLOCKS_REACHED`

#### `documentToSource(doc)` — JSON → .it source

Reverse of the parser. Takes a parsed `IntentDocument` and produces valid `.it` source text.

- Round-trip guarantee: `parseIntentText(documentToSource(doc))` produces identical block types, content, and properties
- Properties serialise in canonical order per block type (e.g. `step:` → tool, input, output, depends, id, status, timeout)
- Preserves inline formatting via `originalContent`
- Pure function — no mutation

#### `validateDocumentSemantic(doc)` — Semantic validation

Cross-block validation beyond syntax. Returns `{ valid: boolean, issues[] }`.

**Errors** (valid: false):

- `STEP_REF_MISSING` — decision then/else references nonexistent step
- `DEPENDS_REF_MISSING` — step depends on nonexistent step
- `PARALLEL_REF_MISSING` — parallel references nonexistent step
- `CALL_LOOP` — call references the document's own title
- `RESULT_NOT_TERMINAL` — result block is not last in its section
- `DUPLICATE_STEP_ID` — two blocks share the same explicit id

**Warnings** (valid: true):

- `GATE_NO_APPROVER`, `STEP_NO_TOOL`, `HANDOFF_NO_TO`, `RETRY_NO_MAX`
- `UNRESOLVED_VARIABLE` — `{{variable}}` not declared in context or step output
- `EMPTY_SECTION` — section with no content blocks

**Info:** `DOCUMENT_NO_TITLE`, `TEMPLATE_HAS_UNRESOLVED`

#### `queryDocument(doc, options)` — Simple block query

Filter blocks with an intuitive, composable API. All conditions are ANDed; type arrays are ORed.

| Option       | Type                               | Description                      |
| ------------ | ---------------------------------- | -------------------------------- |
| `type`       | `string \| string[]`               | Filter by block type(s)          |
| `content`    | `string \| RegExp`                 | Substring or regex match         |
| `properties` | `Record<string, string \| RegExp>` | All key/value pairs must match   |
| `section`    | `string \| RegExp`                 | Only blocks in matching sections |
| `limit`      | `number`                           | Max results                      |

**Returns:** `IntentBlock[]`

#### `diffDocuments(before, after)` — Semantic diff

Computes a content-similarity diff between two document versions. Blocks matched by Levenshtein similarity, not by ID.

**Returns:** `DocumentDiff` — `{ added[], removed[], modified[], unchanged[], summary }`

Each `modified` entry tracks `contentChanged`, `propertiesChanged[]`, and `typeChanged`.

---

### 12.5 Roadmap (Not Yet Implemented)

The following features are under consideration for future versions. They are **not implemented** in the current release.

- **`sub2:`** — Deeper hierarchy (H4+ level nesting)
- **Nested lists** — Indentation-based list nesting
- **Static site builder** — Build HTML sites from `.it` files
- **Knowledge graph** — Parse folders of `.it` files and build document relationships
- **AI-native features** — `ai:` and `synthesize:` blocks for LLM workflows
- **Collaboration** — `comment:`, `@mentions`, change tracking
- **Natural language dates** — Parse "tomorrow", "next Friday" to ISO dates

_Breaking changes require a major version bump. Additive features (new keywords, new standard properties) increment the minor version._

---

_IntentText — Each line is intent plus parameters. That is the whole format._
