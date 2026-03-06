# IntentText — Add policy: Keyword

# Repo: github.com/intenttext/IntentText

# Package: @intenttext/core

# This is a spec addition + implementation. Version bump: 2.6.x → 2.7.0

---

## WHAT policy: IS

A `policy:` block is a standing behavioural rule that an agent consults during
execution. It is declarative — it states what should always or conditionally
happen — rather than imperative like `step:` or `decision:`.

Policies are distinct from:

- `context:` — runtime variables (change per run)
- `decision:` — one-time conditional branch in execution flow
- `step:` — a discrete action to perform
- `note:` — unstructured human text

A `policy:` block is a persistent rule that shapes agent behaviour throughout
a workflow, can be referenced by name, and can be stored as a standalone
queryable document.

---

## SYNTAX

```
policy: Rule name | property: value | property: value
```

### Core properties

| Property    | Purpose                                         | Example                      |
| ----------- | ----------------------------------------------- | ---------------------------- |
| `if:`       | Condition that triggers this rule               | `if: order_age_days < 30`    |
| `action:`   | What to do when rule applies                    | `action: approve_refund`     |
| `always:`   | Unconditional requirement                       | `always: respond_in_arabic`  |
| `never:`    | Unconditional prohibition                       | `never: share_personal_data` |
| `requires:` | Prerequisite for action                         | `requires: manager_approval` |
| `notify:`   | Who to alert when rule fires                    | `notify: fraud-team`         |
| `priority:` | Rule evaluation order (lower = higher priority) | `priority: 1`                |
| `id:`       | Named reference for this policy                 | `id: refund-standard`        |
| `scope:`    | Where this rule applies                         | `scope: customer-facing`     |

### Usage examples

```
// Standalone policy document
title: Customer Support Policies

policy: Standard refund    | if: order_age_days < 30        | action: approve
policy: Pro refund window  | if: customer.tier == "pro"     | action: approve | if: order_age_days < 60
policy: Digital goods      | if: product.type == "digital"  | action: deny
policy: Fraud block        | if: fraud_score > 0.8          | action: deny | notify: fraud-team
policy: Always professional| always: professional_tone      | never: casual_language
policy: Language match     | always: respond_in_user_language
policy: Manager override   | action: approve | requires: manager_approval | priority: 1
```

```
// Inline in an agent definition
agent: customer-support | model: claude-sonnet-4

policy: Refund window    | if: order_age_days < 30 | action: allow_refund
policy: Escalate anger   | if: sentiment == "angry" | after: 3_turns | action: gate
policy: Tone             | always: professional | never: casual
policy: Language         | always: respond_in_user_language

step: Get customer       | tool: crm.lookup | input: {{phone}} | output: customer
// ... rest of workflow
```

```
// Referenced via call: from a workflow
title: Order Refund Workflow

call: ./policies/refund-policy.it   // import policy rules
call: ./policies/fraud-policy.it    // import fraud rules

step: Check order    | tool: orders.get    | input: {{orderId}}  | output: order
step: Apply policies | tool: policy.eval   | input: {{order}}    | output: decision
decision: Route      | if: {{decision.action}} == "approve" | then: step-approve | else: step-deny
```

---

## PART 1 — TYPE DEFINITION

File: `packages/core/src/types.ts`

Add `policy` to the block type union. No new interface needed —
`IntentBlock` already handles it. Just add it to the keyword sets.

```typescript
// Add to AGENTIC_KEYWORDS set
export const AGENTIC_KEYWORDS = new Set([
  // existing...
  "policy",
]);

// Add to keyword documentation
export const KEYWORD_DESCRIPTIONS: Record<string, string> = {
  // existing...
  policy:
    "A standing behavioural rule for agents — what to always do, never do, or do conditionally.",
};
```

---

## PART 2 — PARSER

File: `packages/core/src/parser.ts`

No special parsing logic needed. `policy:` follows the standard
`keyword: content | property: value` pattern.

The parser already handles this. Just ensure `policy` is in the
recognised keywords set so it doesn't trigger `UNKNOWN_KEYWORD` warnings.

Standard parse output:

```json
{
  "id": "block-xyz",
  "type": "policy",
  "content": "Standard refund",
  "originalContent": "Standard refund",
  "properties": {
    "if": "order_age_days < 30",
    "action": "approve"
  }
}
```

---

## PART 3 — RENDERER

File: `packages/core/src/renderer.ts`

### HTML rendering

Render `policy:` as a styled rule card — similar to `info:` callouts but
with a distinct "rule" appearance:

```typescript
case 'policy': {
  const conditions = [];
  if (props.if) conditions.push(`<span class="it-policy-condition">if ${escapeHtml(props.if)}</span>`);
  if (props.always) conditions.push(`<span class="it-policy-always">always: ${escapeHtml(props.always)}</span>`);
  if (props.never) conditions.push(`<span class="it-policy-never">never: ${escapeHtml(props.never)}</span>`);
  if (props.action) conditions.push(`<span class="it-policy-action">→ ${escapeHtml(props.action)}</span>`);
  if (props.requires) conditions.push(`<span class="it-policy-requires">requires: ${escapeHtml(props.requires)}</span>`);

  return `
    <div class="it-block it-policy" data-id="${block.id}">
      <div class="it-policy-name">${renderInline(block.inline)}</div>
      <div class="it-policy-rules">${conditions.join(' ')}</div>
    </div>
  `;
}
```

### CSS for policy blocks

```css
.it-policy {
  border-left: 3px solid #cba6f7;
  background: rgba(203, 166, 247, 0.08);
  padding: 10px 14px;
  margin: 6px 0;
  border-radius: 0 6px 6px 0;
  font-family: inherit;
}

.it-policy-name {
  font-weight: 600;
  color: #cba6f7;
  font-size: 0.9em;
  margin-bottom: 4px;
}

.it-policy-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.82em;
  font-family: monospace;
}

.it-policy-condition {
  color: #89b4fa;
}
.it-policy-always {
  color: #a6e3a1;
}
.it-policy-never {
  color: #f38ba8;
}
.it-policy-action {
  color: #fab387;
  font-weight: 600;
}
.it-policy-requires {
  color: #f9e2af;
}
```

---

## PART 4 — VALIDATION

File: `packages/core/src/validate.ts`

Add these validation rules for `policy:` blocks:

**WARNINGS:**

- `POLICY_NO_CONDITION` — a `policy:` block has neither `if:`, `always:`,
  nor `never:` property. A policy with no condition is effectively a comment.
  Message: "Policy '${content}' has no condition (if:, always:, or never:). Add a condition or use note: instead."

- `POLICY_NO_ACTION` — a `policy:` block has `if:` but no `action:`,
  `notify:`, or `requires:`. A conditional policy without a consequence does nothing.
  Message: "Policy '${content}' has a condition but no action. Add action:, notify:, or requires:."

**INFO:**

- `POLICY_HAS_ID` — a `policy:` block with an `id:` property is noted as
  a named policy, which can be referenced by other blocks.

---

## PART 5 — documentToSource()

File: `packages/core/src/source.ts`

Add canonical property order for `policy:` blocks:

```typescript
const PROPERTY_ORDER: Record<string, string[]> = {
  // existing...
  policy: [
    "if",
    "always",
    "never",
    "action",
    "requires",
    "notify",
    "priority",
    "scope",
    "after",
    "id",
  ],
};
```

---

## PART 6 — QUERY

No changes needed. `queryDocument(doc, { type: 'policy' })` works automatically
since query operates on block type and that's already handled generically.

---

## PART 7 — SPEC UPDATE

File: `docs/SPEC.md`

Add `policy:` to the Agentic Workflow Blocks section:

````markdown
### policy:

A standing behavioural rule for agents. Declares what the agent should always
do, never do, or do conditionally throughout a workflow.

**Syntax:**
\```
policy: Rule name | if: condition | action: consequence
policy: Rule name | always: behaviour
policy: Rule name | never: behaviour | requires: approval
\```

**Properties:**

| Property    | Description                                       |
| ----------- | ------------------------------------------------- |
| `if:`       | Condition expression that triggers this rule      |
| `action:`   | What to do when the rule applies                  |
| `always:`   | Unconditional requirement — always do this        |
| `never:`    | Unconditional prohibition — never do this         |
| `requires:` | Human or system approval required for the action  |
| `notify:`   | Who to alert when this rule fires                 |
| `priority:` | Evaluation order — lower number = higher priority |
| `id:`       | Named reference for this policy rule              |
| `scope:`    | Context where this rule applies                   |
| `after:`    | Fire after N occurrences (e.g. `after: 3_turns`)  |

**Use cases:**

- Define refund, escalation, and tone rules in customer support agents
- Store compliance and security policies as queryable `.it` files
- Import shared policies into workflows via `call:`
- Express agent constraints that humans can read and edit

**Example — standalone policy file:**
\```
title: Customer Support Policies

policy: Refund standard | if: order_age_days < 30 | action: approve
policy: Refund extended | if: customer.tier == "pro" | action: approve
policy: No digital refund| if: product.type == "digital" | action: deny
policy: Fraud block | if: fraud_score > 0.8 | action: deny | notify: fraud-team
policy: Escalate anger | if: sentiment == "angry" | after: 3_turns | action: gate
policy: Language | always: respond_in_user_language
policy: Tone | always: professional | never: casual
\```
````

---

## PART 8 — README UPDATE

File: `README.md`

Add `policy:` to the Agentic Workflow Blocks table:

```markdown
| `policy:` | Declare a standing behavioural rule | `policy: Refund window | if: order_age_days < 30 | action: approve` |
```

Update the keyword count in the Design Principles section:

- Change "current set is final at 36 keywords" → "current set is final at 37 keywords"

Add `policy:` to the agent.it example in the developer section if that
example was added by the README update prompt. Insert after the `context:` line:

```
policy: Refund window   | if: order_age_days < 30          | action: allow_refund
policy: Escalate anger  | if: sentiment == "angry" | after: 3_turns | action: gate
policy: Language        | always: respond_in_user_language
policy: Tone            | always: professional | never: casual
```

---

## PART 9 — TESTS

File: `packages/core/tests/policy.test.ts`

Minimum 15 tests:

**Parser:**

- `policy: name | if: x > 0 | action: approve` parses to type `policy`
- Content is `name`
- Properties contain `if`, `action`
- `policy: name | always: professional` parses correctly
- `policy: name | never: casual | requires: approval` parses correctly
- Unknown properties on policy block are preserved (open schema)

**Renderer:**

- `policy:` block renders with `it-policy` class
- `if:` property renders with `it-policy-condition` class
- `always:` renders with `it-policy-always` class
- `never:` renders with `it-policy-never` class
- `action:` renders with `it-policy-action` class

**Validation:**

- Policy with `if:` and `action:` passes with no warnings
- Policy with no condition returns `POLICY_NO_CONDITION` warning
- Policy with `if:` but no action returns `POLICY_NO_ACTION` warning
- Policy with `always:` and no action passes (always IS the action)

**documentToSource:**

- Round-trip: `policy:` block serialises and re-parses identically
- Properties serialise in canonical order

---

## PART 10 — VS CODE EXTENSION

File: `intenttext-vscode/src/hover.ts`

Add `policy` to the keyword docs:

```typescript
policy: {
  description: 'A standing behavioural rule for agents — what to always, never, or conditionally do.',
  properties: ['if', 'always', 'never', 'action', 'requires', 'notify', 'priority', 'id', 'scope', 'after'],
},
```

Also add to the completion provider's block schemas.

---

## VERSION

Bump `packages/core/package.json` from current version to next minor: `x.x.x → x.y.0`

Add CHANGELOG entry:

```markdown
## [2.7.0] — March 2026

### Added

- `policy:` keyword — standing behavioural rules for AI agents
  - Supports `if:`, `always:`, `never:`, `action:`, `requires:`, `notify:`,
    `priority:`, `id:`, `scope:`, `after:` properties
  - Rendered as styled rule cards in HTML output
  - Validated for missing conditions and actions
  - documentToSource() canonical property order
  - Full test coverage (15 tests)
```

---

## CONSTRAINTS

- No breaking changes to any existing API
- All existing tests must continue to pass
- `policy:` follows the same parsing path as all other keywords — no special cases
- Do not add `policy:` to document header keywords — it belongs in the agentic set
- The keyword is intentionally open-schema — any property key is valid,
  the named properties get special rendering and validation treatment

_IntentText policy: keyword — Implementation Prompt — March 2026_
