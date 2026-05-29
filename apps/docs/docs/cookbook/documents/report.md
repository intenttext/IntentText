---
sidebar_position: 3
title: Report
---

# Report

## The problem

You need a monthly report with KPIs, figures with captions, source citations, and a management sign-off — all queryable and renderable to a polished PDF.

## The solution

```intenttext
title: Q1 2026 Performance Report
summary: Engineering department quarterly metrics and achievements
meta: | type: report | domain: business | track: true

page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | size: 11pt
header: Q1 2026 — Engineering | align: left | size: 8pt
footer: CONFIDENTIAL — Page {page} of {pages} | align: center | size: 8pt
watermark: DRAFT | color: #cccccc | opacity: 0.06

section: Executive Summary

text: Engineering delivered 3 of 4 planned initiatives on schedule. Cloud migration completed ahead of timeline. API platform launch delayed by 2 weeks due to security review findings. Team grew from 42 to 48 engineers.

section: Key Metrics

metric: Sprint velocity | value: 87 | target: 80 | unit: points | trend: up
metric: Deployment frequency | value: 4.2 | target: 3 | unit: per week | trend: up
metric: Incident MTTR | value: 18 | target: 30 | unit: minutes | trend: down | color: green
metric: Code coverage | value: 91 | target: 85 | unit: % | trend: up
metric: Customer-reported bugs | value: 12 | target: 20 | unit: count | trend: down | color: green
metric: Team satisfaction | value: 4.2 | target: 4.0 | unit: /5 | trend: flat

section: Project Status

| Project | Status | Lead | Target Date |
| Cloud migration | ✓ Complete | Sarah Chen | 2026-02-28 |
| API platform | In progress | James Miller | 2026-04-15 |
| Security hardening | On track | Maria Santos | 2026-05-01 |
| Mobile SDK | Planning | Ahmed Al-Rashid | 2026-06-30 |

section: Infrastructure

figure: Monthly deployment frequency | at: /images/deploy-frequency.png | caption: Deployment frequency increased 40% after CI/CD improvements | source: Internal metrics dashboard
figure: Incident response times | at: /images/mttr-chart.png | caption: Mean time to recovery dropped below 20 minutes in March | source: PagerDuty analytics

section: Analysis

text: The 40% improvement in deployment frequency directly correlates with the CI/CD pipeline rebuild completed in January. Teams are now shipping smaller, more frequent changes.

cite: State of DevOps Report 2025 | by: DORA Team | at: https://dora.dev/report | note: Elite performers deploy multiple times per day with sub-hour recovery times. Our metrics now meet elite performer benchmarks.

text: Customer-reported bugs dropped 40% quarter-over-quarter, tracking with the code coverage increase from 82% to 91%.

section: Risks

warning: API platform launch delayed 2 weeks. Security audit found 3 critical issues requiring remediation before public release.
warning: Two senior engineers departing in Q2. Knowledge transfer plan in progress.

section: Next Quarter Goals

deadline: API platform GA | due: 2026-04-15 | status: pending
deadline: Security hardening complete | due: 2026-05-01 | status: pending
deadline: Mobile SDK alpha | due: 2026-06-30 | status: pending
deadline: Q2 report due | due: 2026-07-07 | status: pending

section: Sign-Off

approve: Engineering review | by: Ahmed Al-Rashid | role: VP Engineering | at: 2026-04-01
approve: Executive review | by: Lisa Park | role: CTO | at: 2026-04-02

track: | by: ahmed@acme.co
```

## Step by step

1. **Metrics grid** — Multiple `metric:` blocks in a section render as a dashboard grid. Each has a value, target, unit, and trend. Color coding happens automatically: value meeting/exceeding target → green.
2. **Figures** — `figure:` with `caption:` and `source:` creates numbered, captioned images. Auto-numbered: Figure 1, Figure 2, etc.
3. **Citations** — `cite:` for external sources. Includes author, URL, and annotation.
4. **Deadlines** — Every upcoming milestone is a `deadline:` block. Queryable across all reports.
5. **Approvals** — Management sign-off with `approve:`.
6. **Watermark** — `watermark: DRAFT` stamps every page. Remove when finalized.

## Query it

```bash
# Find all metrics across reports
intenttext query ./reports --type metric --format table

# Overdue deadlines
intenttext ask ./reports "What deadlines are overdue?" --format text

# All risks and warnings
intenttext query ./reports --type warning --format table

# Metrics by department
intenttext query ./reports --type metric --section "Key Metrics" --format csv
```

## Render

```bash
# Corporate theme for executive presentation
intenttext report.it --print --theme corporate

# PDF export
intenttext report.it --pdf --theme corporate
```

## Next steps

- [Metrics & Dashboards](../data/metrics-and-dashboards) — deep dive on `metric:` blocks
- [Figures & Captions](../data/figures-and-captions) — auto-numbering and print layout
- [Approval Workflow](../trust/approval-workflow) — formal sign-off process
