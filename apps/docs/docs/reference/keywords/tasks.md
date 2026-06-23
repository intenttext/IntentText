---
sidebar_position: 5
title: Tasks
---

# Task Keywords

Three keywords for actionable and open items — tasks to complete, completed work, and questions requiring answers.

## `task:`

**Category:** Tasks
**Arabic:** `مهمة:`

Actionable task item with owner and due date.

### Syntax

```
task: description | owner: name | due: date | priority: level | status: state
```

### Properties

| Property   | Type   | Description                                 |
| ---------- | ------ | ------------------------------------------- |
| `owner`    | string | Who is responsible                          |
| `due`      | string | Due date — ISO 8601 (`YYYY-MM-DD`)          |
| `priority` | string | `low`, `medium`, `high`, `critical`         |
| `status`   | string | `pending`, `in-progress`, `blocked`, `done` |

### Examples

```intenttext
task: Review contract terms | owner: Sarah Chen | due: 2026-03-15 | priority: high
task: Update API documentation | owner: Engineering | status: in-progress
task: Send invoice to client | owner: Finance | due: 2026-04-01
```

### Notes

- Queryable: `dotit query . --type task --status pending` finds all open tasks
- Keep `due:` in ISO 8601 — `due<2026-03-01` range queries depend on it, and the validator warns (`DATE_NOT_ISO`) on locale formats like `09/03/2026`
- Use `done:` when a task is completed — place it below the original `task:` block

---

## `done:`

**Category:** Tasks
**Arabic:** `منجز:`

Completed task item — the resolved state of a `task:` block.

### Syntax

```
done: description | owner: name | time: timestamp
```

### Properties

| Property | Type   | Description            |
| -------- | ------ | ---------------------- |
| `owner`  | string | Who completed the item |
| `time`   | string | When it was completed  |

### Examples

```intenttext
done: Migration complete | owner: ops-team | time: 2026-03-08T10:00:00Z
done: Report generated | owner: @analyst | time: 2026-03-08T09:30:00Z
```

:::note
`done:` marks a completed task item. For workflow terminal output or data return values, use [`result:`](./agent#result) instead.
:::

---

## `ask:`

**Category:** Tasks

Open question requiring a response.

### Syntax

```
ask: question text | to: recipient | due: date | priority: level
```

### Properties

| Property   | Type   | Description       |
| ---------- | ------ | ----------------- |
| `to`       | string | Who should answer |
| `due`      | string | Response due date |
| `priority` | string | Priority level    |

### Examples

```intenttext
ask: What is the expected delivery date for Phase 2? | to: Engineering | due: 2026-03-10
ask: Should we include the optional modules? | to: Product | priority: high
ask: Has legal reviewed the payment terms? | to: Legal
```

### Notes

- Queryable: `dotit query . --type ask` finds all open questions (filter further per file with `--query "type=ask to=Legal"`)
- Use `done:` when the question is resolved
