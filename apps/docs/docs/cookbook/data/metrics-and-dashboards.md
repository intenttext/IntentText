---
sidebar_position: 1
title: Metrics & Dashboards
---

# Metrics & Dashboards

## The problem

KPIs live in Excel sheets, Word tables, and Slack messages. Nobody can query them. Nobody can compare across documents. Your monthly reports have metrics, but they're trapped in prose.

## The solution

`metric:` makes KPIs structured, queryable, and renderable. Multiple `metric:` blocks in a section render as a dashboard grid.

### Executive dashboard

```intenttext
title: Q1 2026 Executive Dashboard
summary: Key performance indicators across departments
meta: | type: report | domain: business

section: Revenue

metric: Total Revenue | value: 4200000 | target: 4000000 | unit: USD | trend: up
metric: MRR | value: 350000 | target: 320000 | unit: USD | trend: up
metric: Churn Rate | value: 2.1 | target: 3.0 | unit: % | trend: down | color: green
metric: NRR | value: 115 | target: 110 | unit: % | trend: up

section: Engineering

metric: Sprint Velocity | value: 87 | target: 80 | unit: points | trend: up
metric: Deploy Frequency | value: 4.2 | target: 3.0 | unit: per week | trend: up
metric: MTTR | value: 18 | target: 30 | unit: minutes | trend: down | color: green
metric: Uptime | value: 99.97 | target: 99.9 | unit: % | trend: flat

section: Customer

metric: NPS | value: 72 | target: 60 | unit: score | trend: up
metric: CSAT | value: 4.5 | target: 4.0 | unit: /5 | trend: up
metric: Tickets Resolved | value: 1847 | target: 1500 | unit: count | trend: up
metric: Avg Resolution Time | value: 4.2 | target: 8.0 | unit: hours | trend: down | color: green
```

### How the metric grid renders

When a section contains multiple `metric:` blocks, they render as a dashboard grid — cards with the metric name, value, target, and trend indicator. The renderer handles layout automatically.

## Color coding

Metrics are color-coded automatically based on value vs target:

| Condition                             | Color  |
| ------------------------------------- | ------ |
| Value meets or exceeds target         | Green  |
| Value is close to target (within 10%) | Yellow |
| Value misses target by more than 10%  | Red    |

You can override with an explicit `color:` property:

```intenttext
metric: Churn Rate | value: 2.1 | target: 3.0 | unit: % | color: green
```

For metrics where lower is better (churn, MTTR, resolution time), the renderer handles the inversion automatically — lower value = green.

## Trend indicators

| Trend  | Display |
| ------ | ------- |
| `up`   | ↑       |
| `down` | ↓       |
| `flat` | →       |

Trend arrows combine with color coding — an upward trend on revenue is green, an upward trend on churn is red.

## Querying metrics

```bash
# All metrics across all reports
intenttext query ./reports --type metric --format table

# Metrics in a specific section
intenttext query ./reports --type metric --section "Revenue" --format csv

# Natural language
intenttext ask ./reports "What's our MRR trend?" --format text
```

## Agent monitoring

Agents can write metrics to a `.it` file as part of their pipeline:

```intenttext
title: Pipeline Metrics — 2026-03-15
meta: | type: metrics | agent: monitoring-agent

section: Execution

metric: Tasks completed | value: 47 | target: 50 | unit: count
metric: Avg execution time | value: 3.2 | target: 5.0 | unit: seconds | trend: down | color: green
metric: Error rate | value: 0.8 | target: 2.0 | unit: % | trend: down | color: green
metric: Confidence | value: 0.94 | target: 0.90 | unit: score | trend: up

audit: Metrics recorded | by: monitoring-agent | at: 2026-03-15T10:00:00Z | level: info
```

Query agent performance over time:

```bash
intenttext query ./agent-logs --type metric --content "Error rate" --format csv
```

## Next steps

- [Report](../documents/report) — full report with metric grid
- [Cross-Document References](./cross-document-refs) — link metrics across reports
- [Querying Documents](../organizations/querying-documents) — query syntax
