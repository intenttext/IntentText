---
sidebar_position: 2
title: Quick Start
---

# Quick Start

You want IntentText working in 5 minutes. Here's how.

## Install

```bash
npm install @intenttext/core
```

Or use the CLI globally:

```bash
npm install -g intenttext
```

## Write your first `.it` file

Create `hello.it`:

```intenttext
title: Project Kickoff
summary: Planning meeting notes for Atlas project

section: Decisions
text: Launch date confirmed for June 15
text: Budget approved at USD 180,000 | weight: bold

section: Tasks
task: Finalize vendor contracts | owner: Sarah | due: 2026-04-15
task: Set up staging environment | owner: Dev Team | due: 2026-04-20
task: Draft press release | owner: Marketing | due: 2026-05-01

section: Next Steps
deadline: Vendor selection complete | date: 2026-04-10 | consequence: Delays launch
```

## Parse it

```bash
npx intenttext hello.it
```

You get structured JSON — every block typed, every property extracted.

## Render to HTML

```bash
npx intenttext hello.it --html
```

Clean, styled HTML. Add a theme:

```bash
npx intenttext hello.it --html --theme corporate
```

## Query it

Find all tasks owned by Sarah:

```bash
npx intenttext hello.it --query "type=task owner=Sarah"
```

Find all deadlines:

```bash
npx intenttext hello.it --query "type=deadline"
```

## Use in code

```typescript
import { parseIntentText, renderHTML } from "@intenttext/core";

const source = `
title: Quick Example
text: This is structured text.
task: Review document | owner: Ahmed | due: 2026-04-01
`;

const doc = parseIntentText(source);
const html = renderHTML(doc);

// Query blocks
const tasks = doc.blocks.filter((b) => b.type === "task");
console.log(tasks[0].properties.owner); // "Ahmed"
```

## What's next

You've parsed, rendered, and queried. Now understand the model:

**[Core Concepts →](./concepts)**
