---
sidebar_position: 7
title: For Agents
---

# IntentText for Agents

AI agents produce Markdown. Markdown has no structure for workflows, no typed blocks, no audit trail, no trust chain.

IntentText gives agents a small set of canonical workflow keywords that produce documents machines can execute and humans can read. The executor enforces gate checks and policy rules before a single step runs.

## The workflow keywords

Seven canonical keywords cover the full agent workflow lifecycle:

| Keyword     | Purpose                                                              |
| ----------- | -------------------------------------------------------------------- |
| `step:`     | A unit of work — the primary building block                          |
| `decision:` | Conditional branching — if/then/else                                 |
| `gate:`     | Hard checkpoint — execution blocked until the condition is satisfied |
| `trigger:`  | Event-based activation                                               |
| `result:`   | Terminal workflow outcome                                            |
| `policy:`   | Rule declaration — constraints the executor enforces before running  |
| `audit:`    | Immutable audit log entry                                            |

**Related keywords in other categories:**

- `task:` / `done:` / `ask:` — task tracking (Tasks category)
- `context:` — agent execution context, goal, and constraints (Document Identity)

**Extended workflow keywords** (for complex orchestration):

Looping, parallel execution, handoff, retry, wait, checkpoint, and other advanced workflow primitives are available in the `x-agent:` extension namespace. See [Extension Keywords →](../reference/keywords/extensions).

---

## Executing a workflow

Use `executeWorkflow()` from `@intenttext/core` to run a document against a runtime. The executor evaluates `policy:` blocks first — if a required gate is unmet, execution returns `policy_blocked` without running any steps.

```typescript
import { parseIntentText, executeWorkflow } from "@intenttext/core";

const doc = parseIntentText(source);

const result = await executeWorkflow(doc, {
  executeStep: async (block) => {
    // dispatch to your agent or tool runner
    console.log(`Executing: ${block.content}`);
    return { status: "completed", output: "Done" };
  },
  evaluateDecision: async (block) => {
    // evaluate the if: condition
    return { branch: "yes" };
  },
  checkGate: async (block) => {
    // check external approval, condition, etc.
    return { passed: true };
  },
});

console.log(result.status); // "completed" | "gate_blocked" | "policy_blocked" | "error" | "dry_run"
console.log(result.executedSteps);
```

### Execution result statuses

| Status           | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `completed`      | All steps executed successfully                                         |
| `gate_blocked`   | A `gate:` check returned `passed: false` — halted at that gate          |
| `policy_blocked` | A `policy:` `requires: gate` was not satisfied before execution started |
| `error`          | A step threw an unhandled exception                                     |
| `dry_run`        | Runtime `dryRun: true` — returns plan without execution                 |

---

## A complete agent task plan

```intenttext
title: Data Migration Pipeline
context: agent | goal: Migrate customer data from legacy DB | constraints: Zero downtime, max 4 hours

policy: Migrations require manager approval | requires: gate | gate: manager-approval

section: Preparation
step: Export legacy data | id: export | tool: pg_dump | timeout: 30m
step: Validate export | id: validate | depends: export | tool: checksum_verify

section: Migration
gate: Manager approval | id: manager-approval | approver: engineering-manager | timeout: 72h
step: Create backup | id: backup | depends: manager-approval | tool: pg_backup
step: Run migration scripts | id: migrate | depends: backup | tool: flyway
decision: Migration successful? | if: migrate.exit_code == 0 | then: verify | else: result-fail

section: Verification
step: Verify row counts | id: verify | depends: migrate | tool: row_counter
step: Run integration tests | id: test | depends: verify | tool: pytest
audit: Migration complete | by: DataBot | at: {{now}} | action: migrate
result: Success | status: completed

section: Rollback
result: id: result-fail | status: error | message: Migration failed — rollback initiated
step: Restore backup | depends: result-fail | tool: pg_restore
```

---

## Gates and decisions

`gate:` blocks execution until a condition is satisfied:

```intenttext
gate: Approval received | id: approval | approver: engineering-manager | timeout: 72h
```

`decision:` branches the workflow based on a condition:

```intenttext
decision: Budget approved? | if: budget.amount <= 10000 | then: auto_approve | else: manager_review
```

Gates are evaluated by the `checkGate` handler in your runtime. If `gate:` returns `passed: false`, `executeWorkflow` returns `{ status: "gate_blocked", blockingGate: "approval" }`.

---

## Policy enforcement

`policy:` blocks declare constraints the executor enforces _before_ any step runs:

```intenttext
policy: No production writes without approval | requires: gate | gate: prod-approval | action: block
policy: All migrations require a backup step | requires: step | id: backup
```

If a required gate has not passed, the executor returns `policy_blocked` without touching any steps. No partial execution — either the policy allows the run, or nothing runs.

---

## Audit logging

Agents write `audit:` blocks to build an immutable record of what was executed, by whom, and when:

```intenttext
audit: Fetched 12,450 records | by: DataBot | at: 2026-03-06T02:15:00Z | action: export
audit: Migration complete — 0 errors | by: DataBot | at: 2026-03-06T03:45:00Z | action: migrate
```

Query the audit trail:

```bash
intenttext query ./logs --type audit --by DataBot --format table
```

---

## MCP server integration

The IntentText MCP server gives agents direct access to `.it` files without the need to import `@intenttext/core` directly:

```bash
npm install intenttext-mcp
```

Available MCP tools:

| Tool                | Purpose                           |
| ------------------- | --------------------------------- |
| `intenttext_parse`  | Parse a `.it` file to JSON        |
| `intenttext_render` | Render to HTML                    |
| `intenttext_query`  | Query blocks with filters         |
| `intenttext_merge`  | Merge template with data          |
| `intenttext_seal`   | Seal a document                   |
| `intenttext_verify` | Verify integrity                  |
| `intenttext_amend`  | Amend a frozen document           |
| `intenttext_diff`   | Diff two document versions        |
| `intenttext_source` | Convert JSON back to `.it` source |

Connect to Claude:

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "node",
      "args": ["./node_modules/intenttext-mcp/dist/index.js"]
    }
  }
}
```

---

**Related:**

- [Agentic Workflow Keywords →](../reference/keywords/agent)
- [Core API — executeWorkflow →](../ecosystem/core-api#workflow)
- [Task Planning →](../cookbook/agents/task-planning)
- [Pipeline Definition →](../cookbook/agents/pipeline-definition)
- [MCP Integration →](../cookbook/agents/mcp-integration)
