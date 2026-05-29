---
sidebar_position: 6
title: Agentic Workflow
---

# Agentic Workflow Keywords

Seven keywords for defining executable AI agent workflows. These blocks describe work that the `executeWorkflow()` runtime can directly execute — steps, branching, human gates, event triggers, terminal results, policy enforcement, and audit logging.

## `step:`

**Category:** Agentic Workflow
**Since:** v2.0
**Aliases:** `run:`

A unit of work in a workflow. Steps are executed in dependency order by the workflow runtime.

### Syntax

```
step: description | id: identifier | tool: name | depends: step_id | timeout: duration
```

### Properties

| Property  | Type   | Description                           |
| --------- | ------ | ------------------------------------- |
| `id`      | string | Unique step identifier for references |
| `tool`    | string | Tool name to invoke via `ToolHandler` |
| `depends` | string | Step ID(s) this step depends on       |
| `timeout` | string | Maximum execution time                |

### Examples

```intenttext
step: Export customer data | id: export | tool: pg_dump | timeout: 30m
step: Validate export | id: validate | depends: export | tool: checksum_verify
step: Transform records | id: transform | depends: validate | tool: jq
```

### Notes

- `depends:` determines execution order in the workflow
- The runtime calls the registered `ToolHandler` with the step block
- Validation error `DUPLICATE_STEP_ID` if two steps share the same `id:`
- Validation error `STEP_REF_MISSING` if `depends:` references a nonexistent step

---

## `decision:`

**Category:** Agentic Workflow
**Since:** v2.0
**Aliases:** `if:`

Conditional branching. Routes execution based on a condition evaluated by the runtime.

### Syntax

```
decision: description | if: condition | then: step_id | else: step_id
```

### Properties

| Property | Type   | Required | Description              |
| -------- | ------ | -------- | ------------------------ |
| `if`     | string | yes      | Condition to evaluate    |
| `then`   | string | yes      | Step to execute if true  |
| `else`   | string | no       | Step to execute if false |

### Examples

```intenttext
decision: Migration successful? | if: migrate.exit_code == 0 | then: verify | else: rollback
decision: Budget within limit? | if: amount <= 10000 | then: auto_approve | else: manager_review
```

### Notes

- Conditions are evaluated by a safe recursive-descent parser — no `eval()` is used
- Supported operators: `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`
- Variable references resolve against workflow outputs collected during execution
- Validation error `STEP_REF_MISSING` if `then:` or `else:` references a nonexistent step

---

## `gate:`

**Category:** Agentic Workflow
**Since:** v2.3

Human approval checkpoint. Blocks workflow execution until the required approver grants permission. Controlled via the `onGate` runtime callback.

### Syntax

```
gate: description | approver: name_or_role | timeout: duration | fallback: step_id | status: value
```

### Properties

| Property    | Type   | Required | Description                                     |
| ----------- | ------ | -------- | ----------------------------------------------- |
| `approver`  | string | yes      | Person or role who must approve                 |
| `timeout`   | string | no       | Maximum wait time before fallback               |
| `fallback`  | string | no       | Step to execute if approval is not received     |
| `status`    | string | no       | `approved` or `rejected` — resolved gate state  |

### Examples

```intenttext
gate: Manager approval | approver: engineering-manager | timeout: 72h | fallback: escalate
gate: Security sign-off | approver: security-team | timeout: 48h
gate: Legal review | approver: legal | status: approved
```

### Runtime behavior

When the executor encounters a `gate:` block with no `status: approved` property, it suspends execution and calls `onGate(gateBlock)`. The calling code is responsible for obtaining approval and resuming execution. The executor returns `{ status: "gate_blocked" }` if no `onGate` callback is registered.

:::note
`gate:` is IntentText's human-in-the-loop primitive. It pauses workflow execution and waits for explicit human approval. It is not an automated condition check. For conditional branching based on data, use `decision:` with an `if:` property.
:::

---

## `trigger:`

**Category:** Agentic Workflow
**Since:** v2.0
**Aliases:** `on:`

Event-based activation. Declares what event starts a workflow or a section of a workflow.

### Syntax

```
trigger: description | event: name | source: origin | filter: condition
```

### Properties

| Property | Type   | Description                |
| -------- | ------ | -------------------------- |
| `event`  | string | Event name or pattern      |
| `source` | string | Event source system        |
| `filter` | string | Condition to filter events |

### Examples

```intenttext
trigger: New invoice received | event: invoice.created | source: billing-system
trigger: Deployment complete | event: deploy.success | filter: env == "production"
```

---

## `result:`

**Category:** Agentic Workflow
**Since:** v2.1

Terminal workflow result — the final output of a completed workflow.

### Syntax

```
result: description | format: type | data: payload
```

### Properties

| Property | Type   | Description                     |
| -------- | ------ | ------------------------------- |
| `format` | string | Output format (JSON, PDF, etc.) |
| `data`   | string | Result data or reference        |

### Examples

```intenttext
result: Migration report | format: JSON | data: ./reports/migration.json
result: Invoice generated | format: PDF | data: ./invoices/inv-2026-001.pdf
```

---

## `policy:`

**Category:** Agentic Workflow
**Since:** v2.7
**Aliases:** `rule:`, `constraint:`, `guard:`, `requirement:`

Enforceable constraint or rule. Policies are evaluated by the workflow runtime before execution begins. A policy with `requires: gate` blocks execution unless a matching gate block with `status: approved` exists in the document.

### Syntax

```
policy: description | if: condition | always: rule | never: rule | action: response | requires: block_type | notify: target
```

### Properties

| Property   | Type      | Required                   | Description                                        |
| ---------- | --------- | -------------------------- | -------------------------------------------------- |
| `if`       | condition | one of if/always/never     | Conditional rule — applies when condition is true  |
| `always`   | rule      | one of if/always/never     | Rule that applies unconditionally                  |
| `never`    | rule      | one of if/always/never     | Rule that must never be violated                   |
| `action`   | response  | yes (if `if:` is set)      | What happens when the policy triggers              |
| `requires` | string    | no                         | Mandates presence of a specific block type         |
| `notify`   | string    | no                         | Who to alert when the policy triggers              |
| `priority` | number    | no                         | Evaluation order (lower = higher priority)         |

### Examples

```intenttext
policy: All contracts require legal review | requires: gate | action: block
policy: No production changes without approval | always: require-approval | action: block | notify: ops-team
policy: Log all data access | always: audit-access | notify: security
```

### Runtime behavior — `requires: gate`

When a policy declares `requires: gate`, the runtime evaluates it **before** the execution loop:

1. If the policy's `if:` condition is true (or `always:` is set)
2. And no `gate:` block with `status: approved` exists in the document

→ Execution stops immediately and returns `{ status: "policy_blocked", blockedByPolicy: <policy block> }`.

This is the primary mechanism for enforcing mandatory human oversight in automated workflows.

---

## `audit:`

**Category:** Agentic Workflow
**Since:** v2.0
**Aliases:** `log:`

Audit log entry. Records what an agent or person did, when, and the action taken. The runtime calls `onAudit()` when this block is encountered during execution.

### Syntax

```
audit: description | by: actor | at: timestamp | action: type
```

### Properties

| Property | Type   | Description                 |
| -------- | ------ | --------------------------- |
| `by`     | string | Who performed the action    |
| `at`     | string | When it happened (ISO 8601) |
| `action` | string | Action type or category     |

### Examples

```intenttext
audit: Exported 12,450 records | by: DataBot | at: 2026-03-06T02:15:00Z | action: export
audit: Approved quarterly report | by: Sarah Chen | at: 2026-03-06T10:00:00Z | action: approve
```

---

## Workflow Executor

The `@intenttext/core` package includes a production-ready workflow executor that runs `.it` workflow documents directly.

### `executeWorkflow(document, runtime)`

```typescript
import { parseIntentText, executeWorkflow } from "@intenttext/core";

const doc = parseIntentText(source);

const result = await executeWorkflow(doc, {
  tools: {
    pg_dump: async (step) => {
      return { output: "legacy_dump.sql" };
    },
    checksum_verify: async (step) => {
      return { valid: true };
    },
  },
  onGate: async (gate) => {
    // Return "approved" to allow execution to continue
    return "approved";
  },
  onAudit: (entry) => {
    console.log(`[audit] ${entry.content}`);
  },
});

console.log(result.status);
// "completed" | "gate_blocked" | "policy_blocked" | "error" | "dry_run"
```

### `WorkflowRuntime`

```typescript
interface WorkflowRuntime {
  /** Tool handlers keyed by the tool: property value on step: blocks */
  tools?: Record<string, ToolHandler>;

  /** Called when a gate: block requires approval */
  onGate?: (gate: IntentBlock) => Promise<"approved" | "rejected" | "pending">;

  /** Called when an audit: block is encountered */
  onAudit?: (entry: IntentBlock) => void;

  /** Called at the start of each step */
  onStepStart?: (step: IntentBlock) => void;

  /** Called when a step completes */
  onStepComplete?: (step: IntentBlock, output: unknown) => void;

  /** Called when a step fails */
  onStepError?: (step: IntentBlock, error: Error) => void;

  /** Traverse all blocks without executing tools or gates */
  dryRun?: boolean;

  /** Maximum steps to execute before stopping (default: 1000) */
  maxSteps?: number;

  /** Per-step timeout in milliseconds */
  stepTimeout?: number;

  /** Behavior for steps with an unknown tool: "skip" (default) | "error" */
  unknownTool?: "skip" | "error";
}

type ToolHandler = (step: IntentBlock) => Promise<unknown>;
```

### `ExecutionResult`

```typescript
interface ExecutionResult {
  /** Final execution status */
  status: "completed" | "gate_blocked" | "policy_blocked" | "error" | "dry_run";

  /** Outputs collected from each step, keyed by step id: */
  outputs: Record<string, unknown>;

  /** Steps that were executed */
  executedSteps: IntentBlock[];

  /** The gate block that blocked execution (when status is gate_blocked) */
  blockedByGate?: IntentBlock;

  /** The policy block that blocked execution (when status is policy_blocked) */
  blockedByPolicy?: IntentBlock;

  /** The error that occurred (when status is error) */
  error?: Error;
}
```

### Execution status reference

| Status             | Meaning                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `completed`        | All steps executed successfully                                                     |
| `gate_blocked`     | A `gate:` block was reached with no approval and no `onGate` callback registered   |
| `policy_blocked`   | A `policy: requires: gate` was satisfied with no approved gate in the document      |
| `error`            | An unhandled error occurred during step execution                                   |
| `dry_run`          | `dryRun: true` was set — blocks traversed, no tools or gates called                 |

### Policy enforcement example

```intenttext
title: Production Deploy
policy: All production deploys require approval | requires: gate | always: enforce

gate: Engineering manager approval | approver: engineering-manager | status: approved

step: Run deployment | id: deploy | tool: deploy_script
result: Deployment complete
```

```typescript
// Without gate status: approved — execution is blocked
const r1 = await executeWorkflow(docWithoutApproval, { tools });
// { status: "policy_blocked", blockedByPolicy: <policy block> }

// With gate status: approved in the document — execution proceeds
const r2 = await executeWorkflow(docWithApproval, { tools });
// { status: "completed", outputs: { deploy: ... }, executedSteps: [...] }
```

### Complete workflow example

```intenttext
title: Data Migration Pipeline
context: Data Engineering Agent | goal: Migrate customer data from legacy DB | constraints: Zero downtime

policy: Migrations require manager sign-off | requires: gate | always: enforce

section: Preparation
step: Export legacy data | id: export | tool: pg_dump | timeout: 30m
step: Validate export | id: validate | depends: export | tool: checksum_verify

section: Approval
gate: Manager approval | approver: engineering-manager | timeout: 72h

section: Migration
step: Create backup | id: backup | tool: pg_backup
step: Run migration | id: migrate | depends: backup | tool: flyway
decision: Migration successful? | if: migrate.exit_code == 0 | then: verify | else: rollback

section: Verification
step: Verify row counts | id: verify | tool: row_counter
audit: Migration completed | by: DataBot | action: migration
result: Migration complete | format: JSON | data: ./reports/migration.json

section: Rollback
step: Restore backup | id: rollback | tool: pg_restore
```

---

## Extension keywords — `x-agent:`

Advanced orchestration primitives are available in the `x-agent:` namespace. They follow the same pipe-property syntax and are parsed, rendered, and queryable through all core APIs.

| Extension             | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `x-agent: loop`       | Iterate over a collection                |
| `x-agent: parallel`   | Run multiple steps concurrently          |
| `x-agent: retry`      | Retry a failed step with backoff         |
| `x-agent: wait`       | Pause until event or timeout             |
| `x-agent: handoff`    | Transfer control to another agent        |
| `x-agent: call`       | Invoke a sub-workflow by file            |
| `x-agent: checkpoint` | Named workflow resume point              |
| `x-agent: signal`     | Emit a named workflow event              |
| `x-agent: import`     | Import a workflow from a file            |
| `x-agent: export`     | Export data or workflow output           |
| `x-agent: progress`   | Progress indicator for long-running ops  |
| `x-agent: tool`       | External tool declaration                |
| `x-agent: prompt`     | LLM prompt template                      |
| `x-agent: memory`     | Agent state or persistent memory         |
| `x-agent: error`      | Error record                             |
| `x-agent: agent`      | Agent name or identifier metadata        |
| `x-agent: model`      | Default LLM model for the document       |

See [Extension Keywords →](./extensions) for full syntax documentation.
