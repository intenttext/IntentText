# IntentText (`.it`) v2.3 — Official Specification

> **Status:** Stable · **Version:** 2.3 · **Source of Truth**

IntentText is a human-friendly, AI-semantic document language — and the structured interchange format between AI agents and humans. It combines plain-language keywords, WhatsApp-style inline formatting, and agentic metadata — so that any writer can produce machine-readable documents without learning technical markup. Agents can execute `.it` documents deterministically.

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

| Keyword    | Description                        | Example                                     |
| ---------- | ---------------------------------- | ------------------------------------------- |
| `title:`   | Unique document identifier / title | `title: *Project Dalil* Launch Plan`        |
| `summary:` | Short description of the document  | `summary: Finalizing deployment in _Doha_.` |

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

**Inline code** within any block — use triple backticks:

````
note: Footage saved at ```/logs/cam1```.
````

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

| Syntax         | Result            | Notes                        |
| -------------- | ----------------- | ---------------------------- |
| `*text*`       | **Bold**          | WhatsApp standard            |
| `_text_`       | _Italic_          | WhatsApp standard            |
| `~text~`       | ~~Strikethrough~~ | WhatsApp standard            |
| ` ```text``` ` | `Code`            | Inline code / path / literal |

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

Properties are open-ended — writers may define custom properties as needed. Parsers must preserve unknown properties without error.

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
- Blank lines → ignored / block separator
- All other non-blank, non-keyword lines → `body-text`

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

## 10. Full Example (`.it` File)

````
title: *Project Dalil* Launch Plan
summary: Finalizing the deployment for the AI-Agent hub in _Doha_.

section: Logistics & Equipment
headers: Item | Location | Status
row: Dell Server | Rack 04 | Delivered
row: Fiber Cables | Storage | ~Missing~ Ordered

section: Team Tasks
- Set up the environment.
- Configure the firewall.
- task: Update README | owner: Sarah | due: Monday
task: Database migration | owner: Ahmed | due: Sunday
done: Secure the domain name | time: 09:00 AM

section: Security Questions
question: Who has the _Master Key_ for the server room?
note: Surveillance footage is saved at ```/logs/cam1```.

section: Setup Script
code:
```
#!/bin/bash
apt-get update && apt-get install -y nginx
```
end:

divider: End of Technical Sections

link: *Full Documentation* | to: https://dalil.ai/docs | title: Dalil Docs
image: *Launch Banner* | at: assets/banner.png | caption: Project Dalil launch artwork
````

---

## 11. Reserved Keywords (v1.0)

**Layer 1 — Document Structure (8):** `title` · `summary` · `section` · `sub` · `divider` · `note` · `headers` · `row` · `code` · `end`

**Layer 2 — Human Content (10):** `task` · `done` · `ask` · `quote` · `info` · `warning` · `tip` · `success` · `link` · `image`

**Layer 3 — Agentic Workflow (18):** `step` · `decision` · `parallel` · `loop` · `call` · `gate` · `wait` · `retry` · `error` · `trigger` · `checkpoint` · `handoff` · `audit` · `emit` · `result` · `progress` · `import` · `export` · `context`

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

## 12. Versioning

| Version  | Status    | Notes                                                                            |
| -------- | --------- | -------------------------------------------------------------------------------- |
| **v1.0** | ✅ Stable | Core format                                                                      |
| **v1.3** | ✅ Stable | Query, Schema, Converters, Accessibility                                         |
| **v1.4** | ✅ Stable | Cleanup, fixture accuracy, spec overhaul                                         |
| **v2.0** | ✅ Stable | Agentic workflow blocks, document metadata, interchange format                   |
| **v2.3** | ✅ Stable | gate/call/emit, `{{variable}}` interpolation, join/on properties, removed schema |

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
| `context:`    | Scoped variable definitions     | `context: \| userId: u_123 \| plan: pro`                             |
| `gate:`       | Human approval checkpoint       | `gate: Approve deploy \| approver: lead-eng \| timeout: 24h`             |
| `call:`       | Sub-workflow composition        | `call: ./verify-email.it \| input: {{email}} \| output: verified`        |
| `emit:`       | Workflow signal / status event  | `emit: deploy.running \| phase: deploy \| level: info`                   |
| `result:`     | Execution output                | `result: User created \| code: 200 \| data: {"id":"u_123"}`              |
| `handoff:`    | Multi-agent transfer            | `handoff: Transfer \| from: agent-a \| to: agent-b`                      |
| `wait:`       | Async pause point               | `wait: User confirmation \| on: human.approved \| timeout: 30s`          |
| `parallel:`   | Concurrent execution group      | `parallel: Run checks \| steps: validate,lint,test \| join: all`         |
| `retry:`      | Retry policy                    | `retry: API call \| max: 3 \| delay: 1000 \| backoff: exponential`       |

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

### 12.3 Roadmap (Not Yet Implemented)

The following features are under consideration for future versions. They are **not implemented** in the current release.

- **`sub2:`** — Deeper hierarchy (H4+ level nesting)
- **Nested lists** — Indentation-based list nesting
- **Templates** — `template:` / `use:` / `include:` for reusable content
- **Static site builder** — Build HTML sites from `.it` files
- **Knowledge graph** — Parse folders of `.it` files and build document relationships
- **AI-native features** — `ai:` and `synthesize:` blocks for LLM workflows
- **Collaboration** — `comment:`, `@mentions`, change tracking
- **Natural language dates** — Parse "tomorrow", "next Friday" to ISO dates

_Breaking changes require a major version bump. Additive features (new keywords, new standard properties) increment the minor version._

---

_IntentText — Non-technical. Data-rich. Human by design._
