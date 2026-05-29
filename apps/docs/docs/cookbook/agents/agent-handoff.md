---
sidebar_position: 3
title: Agent Handoff
---

# Agent Handoff

## The problem

Multiple AI agents need to collaborate on a task. Agent A gathers data, Agent B analyzes it, Agent C takes action. Each agent needs structured context — not a raw transcript.

## The solution

Agents pass `.it` files as context. Each agent reads the file, adds its work, and passes it along. `ref:` links connect related documents.

### Agent A: Research

```intenttext
title: Market Research — Q2 Cloud Services
summary: Competitive analysis for cloud services market
meta: | type: research | agent: research-agent

section: Findings

text: The cloud services market grew 22% YoY in Q1 2026.
cite: Gartner Cloud Report 2026 | by: Gartner | at: https://gartner.com/cloud-2026

metric: Market size | value: 540 | unit: billion USD | trend: up
metric: YoY growth | value: 22 | unit: % | trend: up
metric: Top 3 share | value: 67 | unit: % | trend: flat

context: Analysis prepared for strategic planning team. Focus on mid-market segment.

audit: Research complete | by: research-agent | at: 2026-03-15T10:00:00Z | level: info
done: Research phase complete | status: complete | time: 2026-03-15T10:30:00Z
```

### Agent B: Analysis

```intenttext
title: Strategic Analysis — Q2 Cloud Services
summary: Strategy recommendations based on market research
meta: | type: analysis | agent: strategy-agent

ref: Market Research — Q2 Cloud Services | rel: based-on | to: ./research-q2-cloud.it

section: Context

memory: Previous analysis showed 18% growth in Q1 2025 | source: q1-2025-analysis.it

section: Recommendations

step: Expand mid-market offering | id: expand | priority: high | status: recommended
step: Adjust pricing for enterprise tier | id: pricing | priority: medium | depends: expand | status: recommended
step: Invest in AI integration features | id: ai-invest | priority: high | status: recommended

decision: Budget available? | if: budget > 2000000 | then: expand | else: pricing

decision: Market entry strategy | options: organic growth, acquisition, partnership | output: strategy

section: Risk Assessment

warning: Market consolidation accelerating — top 3 providers control 67% of market
warning: Regulatory changes expected in EU market by Q3

audit: Analysis complete | by: strategy-agent | at: 2026-03-15T14:00:00Z | level: info
done: Analysis phase complete | status: complete | time: 2026-03-15T14:30:00Z
```

### Agent C: Execution plan

```intenttext
title: Execution Plan — Q2 Cloud Expansion
summary: Implementation plan based on strategic analysis
meta: | type: plan | agent: execution-agent

ref: Strategic Analysis — Q2 Cloud Services | rel: based-on | to: ./analysis-q2-cloud.it
ref: Market Research — Q2 Cloud Services | rel: references | to: ./research-q2-cloud.it

section: Phase 1 — Product

step: Design mid-market feature set | id: design | tool: product-team | output: feature_spec | deadline: 2026-04-15
step: Develop MVP | id: mvp | depends: design | tool: engineering-team | output: mvp | deadline: 2026-06-01

section: Phase 2 — Launch

step: Beta program | id: beta | depends: mvp | tool: customer-success | output: feedback | deadline: 2026-07-01
step: GA release | id: ga | depends: beta | tool: marketing-team | deadline: 2026-08-01

policy: All features must pass security review before beta | always: require-security-review | action: block

audit: Plan created | by: execution-agent | at: 2026-03-16T09:00:00Z | level: info
```

## Step by step

### 1. Context passing

Each agent reads the previous agent's `.it` file. Structured blocks mean the agent doesn't need to parse prose — it reads `metric:`, `step:`, `decision:` blocks directly.

### 2. Reference linking

`ref:` with `rel:` types connect the document chain:

```intenttext
ref: Previous Document Title | rel: based-on | to: ./path-to-file.it
```

Common `rel:` types for agent handoff:

- `based-on` — this document builds on that one
- `references` — this document cites that one
- `supersedes` — this document replaces that one

### 3. Memory

`memory:` blocks carry forward relevant context:

```intenttext
memory: Previous quarter showed 18% growth | source: q1-2025-analysis.it
```

### 4. Audit trail

Each agent logs its work with `audit:`:

```intenttext
audit: Research complete | by: research-agent | at: 2026-03-15T10:00:00Z | level: info
```

## Querying the chain

```bash
# Find all agent outputs
intenttext query ./agents --type done --format table

# Find all references between documents
intenttext query ./agents --type ref --format json

# Trace the chain from any document
intenttext ask ./agents "What documents led to the execution plan?" --format text
```

## Next steps

- [MCP Integration](./mcp-integration) — connect agents via MCP
- [Task Planning](./task-planning) — structured task plans
- [Pipeline Definition](./pipeline-definition) — multi-step pipelines
