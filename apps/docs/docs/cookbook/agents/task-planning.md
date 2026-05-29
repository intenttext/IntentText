---
sidebar_position: 1
title: Task Planning
---

# Task Planning

## The problem

An AI agent needs a structured task plan — steps with dependencies, inputs, outputs, and conditions. Not a wall of text, but something a machine can execute and a human can audit.

## The solution

```intenttext
title: Customer Onboarding Pipeline
summary: Automated pipeline for new enterprise customer onboarding
meta: | type: agentic | domain: operations

section: Data Collection

step: Gather customer information | id: gather | tool: crm-lookup | input: customer_id | output: customer_data | status: pending
step: Validate business license | id: validate | depends: gather | tool: license-api | input: customer_data.license_number | output: validation_result | status: pending
step: Credit check | id: credit | depends: gather | tool: credit-api | input: customer_data.tax_id | output: credit_score | confidence: 0.95 | status: pending

section: Evaluation

decision: Credit approved? | if: credit_score > 650 | then: setup | else: manual-review
decision: Account tier | options: standard, premium, enterprise | input: customer_data.revenue | output: tier

section: Account Setup

step: Create account | id: setup | depends: validate, credit | tool: account-api | input: customer_data, tier | output: account_id | status: pending
step: Configure permissions | id: permissions | depends: setup | tool: iam-service | input: account_id, tier | status: pending
step: Send welcome email | id: welcome | depends: permissions | tool: email-service | input: customer_data.email, account_id | status: pending

section: Monitoring

trigger: Onboarding complete | event: welcome.sent | signal: onboarding-complete
audit: Pipeline initiated | by: onboarding-agent | at: 2026-03-15T10:00:00Z | level: info

done: Onboarding pipeline ready | status: template | time: 2026-03-15T10:00:00Z
```

## Step by step

1. **Steps** — Each `step:` is a unit of work with an `id:`, optional `depends:` for ordering, `tool:` for execution, and `input:`/`output:` for data flow.
2. **Gates** — `gate:` blocks pause execution until a named approver grants permission. Use `decision:` for automated condition-based branching.
3. **Decisions** — `decision:` blocks select from options based on data.
4. **Triggers** — `trigger:` fires on events. `signal:` sends events for other pipelines.
5. **Audit** — `audit:` blocks log what happened and when.
6. **Done** — `done:` marks the pipeline as complete or ready.

## Querying the plan

```bash
# All steps and their status
intenttext plan.it --query "type=step"

# Pending steps only
intenttext plan.it --query "type=step status=pending"

# Steps that depend on a specific step
intenttext plan.it --query "type=step depends:contains=gather"
```

## Next steps

- [Pipeline Definition](./pipeline-definition) — multi-step pipeline with error handling
- [Agent Handoff](./agent-handoff) — passing context between agents
- [MCP Integration](./mcp-integration) — connecting to Claude via MCP
