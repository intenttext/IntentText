<p align="center">
  <img src="docs/icon.png" alt="IntentText icon" width="96" />
</p>

# IntentText (.it)

**A structured interchange format for AI agents and humans.**

Write plans that humans can read and agents can execute. No YAML boilerplate, no JSON noise — just clear keywords and pipe metadata that parse to deterministic, typed JSON.

```
title: Deploy E-Commerce Platform
agent: deploy-agent | model: claude-sonnet-4

section: Pre-Deploy Checks
step: Run test suite | tool: ci.test | timeout: 300000
step: Audit dependencies | tool: npm.audit | depends: step-1
parallel: Final checks | steps: lint,typecheck,security-scan
decision: All green? | if: tests == "pass" | then: step-4 | else: step-5
step: Deploy to staging | id: step-4 | tool: k8s.deploy | status: pending
error: Rollback | id: step-5 | fallback: step-1 | notify: ops-team

section: Post-Deploy
wait: Smoke test results | timeout: 60s | fallback: rollback
result: Deployed successfully | code: 200
handoff: Transfer monitoring | from: deploy-agent | to: observability-agent
```

Every line parses to a typed JSON block. Every block is queryable, renderable, and executable.

---

## Why IntentText?

| Format                | Humans            | Agents                  | Structure    | Executable            |
| --------------------- | ----------------- | ----------------------- | ------------ | --------------------- |
| Plain text / Markdown | ✅                | ❌ guesses at structure | ❌           | ❌                    |
| JSON / YAML           | ❌ hard to author | ✅                      | ✅           | ✅                    |
| **IntentText**        | **✅ natural**    | **✅ deterministic**    | **✅ typed** | **✅ workflow-ready** |

IntentText is the format you write when you need a document to be both the **human-authored plan** and the **agent-executable specification** at the same time.

---

## Use Cases

### 1. Agent-to-Agent Workflows

Agents pass `.it` files to coordinate multi-step, multi-agent tasks:

```
title: Customer Support Pipeline
agent: triage-agent | model: gpt-4o

section: Intake
step: Classify ticket | tool: classifier.run | input: ticketText
result: Classification done | code: 200 | data: {"category":"billing"}

section: Routing
handoff: Transfer to billing | from: triage-agent | to: billing-agent
wait: Billing response | timeout: 30s | fallback: escalate

section: Resolution
retry: Send confirmation | max: 3 | delay: 1000 | backoff: exponential
emit: Resolved | phase: complete | level: info
audit: Ticket closed | by: billing-agent | at: {{timestamp}}
```

### 2. Human-to-Agent Task Delegation

A PM writes a plan. An agent executes it:

```
title: Launch Marketing Campaign
agent: marketing-agent | model: claude-sonnet-4

section: Content
step: Generate ad copy | tool: copywriter.generate | input: brief
step: Create social assets | tool: design.social | depends: step-1
decision: Needs review? | if: confidence < 0.9 | then: step-3 | else: step-4
step: Send for human review | id: step-3 | status: blocked
step: Schedule posts | id: step-4 | tool: social.schedule

section: Analytics
trigger: campaign.launched | event: campaign.live
loop: Check metrics daily | over: campaignDays | do: step-5
step: Pull analytics | id: step-5 | tool: analytics.pull
checkpoint: campaign-end
```

### 3. Project Documentation

Structure that stays useful — queryable tasks, real metadata:

```
title: *Project Dalil* Launch Plan
summary: Finalizing deployment in _Doha_.

section: Team Tasks
task: Database migration | owner: Ahmed | due: Sunday | priority: 1
task: API endpoint testing | owner: Sarah | due: Monday
done: Setup repository | time: last Tuesday

section: Resources
link: *Documentation* | to: https://dalil.ai/docs
image: Architecture Diagram | at: arch.png | caption: System overview

| Component | Status  | Owner |
| Backend   | Ready   | Ahmed |
| Frontend  | Testing | Sarah |
| Deploy    | Pending | Ops   |
```

### 4. Meeting Notes & Decisions

```
title: Sprint Planning — Week 12
summary: Reviewed priorities and assigned tasks.

section: Decisions
ask: Should we migrate to Postgres?
quote: Yes, the performance benchmarks justify it. | by: Ahmed

section: Action Items
task: Write migration script | owner: Sarah | due: Wednesday
task: Update CI pipeline | owner: Dev Team | due: Friday
done: Security audit complete

section: Notes
note: Next sprint starts Monday. Demo on Friday 3pm.
info: New staging environment available at staging.dalil.ai
warning: Production deploy freeze starts Thursday 6pm.
```

---

## Quick Start

### Install

```bash
npm install @intenttext/core
```

### Parse & Render

```javascript
import { parseIntentText, renderHTML } from "@intenttext/core";

const doc = parseIntentText(`
title: My First Workflow
agent: my-agent | model: gpt-4o

section: Steps
step: Fetch user data | tool: api.getUser | input: userId
step: Send welcome email | tool: email.send | depends: step-1
result: Onboarding complete | code: 200
`);

console.log(doc.version); // "2.0"
console.log(doc.metadata?.agent); // "my-agent"

const html = renderHTML(doc); // Beautiful styled HTML
```

### CLI

```bash
node cli.js document.it           # Parse to JSON
node cli.js document.it --html    # Render to HTML
```

### Web Converter

[![Web to IntentText Converter](https://res.cloudinary.com/drceui2nh/image/upload/v1772457511/webtoit_ctghye.png)](https://toit-psi.vercel.app/)

Try it live at [toit-psi.vercel.app](https://toit-psi.vercel.app/)

---

## JSON Output

Every `.it` document parses to typed, deterministic JSON:

```json
{
  "version": "2.0",
  "metadata": {
    "title": "Customer Support Pipeline",
    "agent": "triage-agent",
    "model": "gpt-4o",
    "context": { "userId": "u_123" }
  },
  "blocks": [
    {
      "id": "step-1",
      "type": "step",
      "content": "Classify ticket",
      "properties": {
        "id": "step-1",
        "tool": "classifier.run",
        "input": "ticketText",
        "status": "pending"
      }
    },
    {
      "type": "handoff",
      "content": "Transfer to billing",
      "properties": {
        "from": "triage-agent",
        "to": "billing-agent"
      }
    },
    {
      "type": "retry",
      "content": "Send confirmation",
      "properties": {
        "max": 3,
        "delay": 1000,
        "backoff": "exponential"
      }
    }
  ]
}
```

---

## Syntax Reference

### Document Structure

| Keyword    | Example                     |
| ---------- | --------------------------- |
| `title:`   | `title: *My Document*`      |
| `summary:` | `summary: Project overview` |
| `section:` | `section: Action Items`     |
| `sub:`     | `sub: Details`              |
| `---`      | Horizontal divider          |
| `//`       | Comment (ignored)           |

### Content Blocks

| Keyword                                    | Example                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `note:`                                    | `note: Remember to backup`                       |
| `task:`                                    | `task: Write docs \| owner: John \| due: Friday` |
| `done:`                                    | `done: Setup repo \| time: Monday`               |
| `ask:`                                     | `ask: Who has the access key?`                   |
| `quote:`                                   | `quote: Be concise. \| by: Strunk`               |
| `info:` / `warning:` / `tip:` / `success:` | Callout blocks                                   |

### Data & Media

| Keyword             | Example                                         |
| ------------------- | ----------------------------------------------- |
| `\| Col \| Col \|`  | Pipe tables                                     |
| `headers:` + `row:` | Keyword tables                                  |
| `image:`            | `image: Logo \| at: logo.png \| caption: Brand` |
| `link:`             | `link: Docs \| to: https://docs.com`            |
| `code:`             | Fenced code blocks                              |

### Agentic Workflow Blocks (v2)

| Keyword               | Purpose              | Example                                                           |
| --------------------- | -------------------- | ----------------------------------------------------------------- |
| `step:`               | Workflow step        | `step: Send email \| tool: email.send \| status: pending`         |
| `decision:`           | Conditional branch   | `decision: Check \| if: x == "y" \| then: step-2 \| else: step-3` |
| `trigger:`            | Workflow start       | `trigger: webhook \| event: user.signup`                          |
| `loop:`               | Iteration            | `loop: Process \| over: items \| do: step-3`                      |
| `checkpoint:`         | Resume point         | `checkpoint: post-setup`                                          |
| `audit:`              | Execution log        | `audit: Done \| by: {{agent}} \| at: {{timestamp}}`               |
| `error:`              | Error handler        | `error: Fail \| fallback: step-2 \| notify: admin`                |
| `context:`            | Scoped variables     | `context: userId = "u_123" \| plan = "pro"`                       |
| `progress:`           | Progress bar         | `progress: 3/5 tasks completed`                                   |
| `import:` / `export:` | Document composition | `import: ./auth.it \| as: auth`                                   |

### Inter-Agent Communication (v2.1+)

| Keyword     | Purpose               | Example                                                            |
| ----------- | --------------------- | ------------------------------------------------------------------ |
| `emit:`     | Signal / status event | `emit: Running \| phase: deploy \| level: info`                    |
| `gate:`     | Human approval        | `gate: Approve deploy \| approver: ops-lead \| timeout: 24h`       |
| `call:`     | Sub-workflow call     | `call: ./verify.it \| input: {{email}} \| output: verified`        |
| `result:`   | Execution output      | `result: Success \| code: 200 \| data: {"id":"u_123"}`             |
| `handoff:`  | Agent transfer        | `handoff: Transfer \| from: agent-a \| to: agent-b`                |
| `wait:`     | Async pause           | `wait: Approval \| on: human.approved \| timeout: 30s`             |
| `parallel:` | Concurrent steps      | `parallel: Run checks \| steps: lint,test,build \| join: all`      |
| `retry:`    | Retry policy          | `retry: API call \| max: 3 \| delay: 1000 \| backoff: exponential` |

> **Note:** `status:` is accepted as an alias for `emit:` for backward compatibility. `schema:` has been removed (it was a runtime concern, not a format concern).

### Inline Formatting

| Style         | Syntax         |
| ------------- | -------------- |
| Bold          | `*text*`       |
| Italic        | `_text_`       |
| Strikethrough | `~text~`       |
| Inline code   | `` `code` ``   |
| Link          | `[label](url)` |

---

## Project Structure

```
IntentText/
├── packages/core/           # @intenttext/core (npm)
│   ├── src/
│   │   ├── types.ts        # Block types, interfaces
│   │   ├── parser.ts       # Core parser
│   │   ├── renderer.ts     # HTML renderer
│   │   └── index.ts        # Public API
│   └── tests/              # 255 tests
├── docs/
│   ├── SPEC.md             # Full specification
│   └── USAGE.md            # Usage guide
├── examples/               # Sample .it files
├── cli.js                  # CLI tool
├── preview.html            # Live editor
└── intenttext.browser.js   # Browser bundle
```

## Development

```bash
npm install && npm run build
npm test                          # 255 tests passing
npm run demo                      # Demo output
npm run preview                   # Live editor in browser
```

## Specification

See [docs/SPEC.md](docs/SPEC.md) for the full language specification.

## License

MIT
