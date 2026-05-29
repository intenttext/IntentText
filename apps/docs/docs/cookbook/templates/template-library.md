---
sidebar_position: 4
title: Template Library
---

# Template Library

## The problem

You need a starting point — not a blank page. You want a well-structured template for an invoice, a contract, a meeting agenda, or a care plan.

## The solution

The [IntentText Hub](https://hub.intenttext.io) hosts **76 curated templates** across 8 domains. Browse, fork, and merge.

## Templates by domain

### Legal (10 templates)

| Template                 | Description                                   |
| ------------------------ | --------------------------------------------- |
| Service Agreement        | Full contract with terms, payment, signatures |
| Non-Disclosure Agreement | Mutual NDA with defined terms                 |
| Terms of Service         | Public-facing terms with definitions section  |
| Privacy Policy           | GDPR-compliant privacy policy                 |
| Employment Agreement     | Full employment contract with benefits        |
| Consulting Agreement     | Independent contractor terms                  |
| License Agreement        | Software/IP license with usage terms          |
| Letter of Intent         | Pre-contract intent declaration               |
| Settlement Agreement     | Dispute resolution with payment terms         |
| Power of Attorney        | Authority delegation with scope               |

### Business (10 templates)

| Template          | Description                                |
| ----------------- | ------------------------------------------ |
| Business Proposal | Problem, solution, timeline, pricing       |
| Quarterly Report  | KPIs, status updates, risk analysis        |
| Meeting Minutes   | Agenda, decisions, action items, deadlines |
| Project Charter   | Scope, stakeholders, milestones            |
| Business Plan     | Market analysis, financials, roadmap       |
| Status Update     | Weekly update with metrics and blockers    |
| Change Request    | Proposed change with impact analysis       |
| Risk Assessment   | Risk matrix with mitigation plans          |
| Vendor Evaluation | Scoring criteria with comparison table     |
| Board Report      | Executive summary for board meetings       |

### HR (10 templates)

| Template             | Description                                    |
| -------------------- | ---------------------------------------------- |
| Offer Letter         | Compensation, benefits, start date             |
| Performance Review   | Goals, achievements, development plan          |
| Job Description      | Requirements, responsibilities, qualifications |
| Onboarding Checklist | Day 1 to Day 90 tasks                          |
| PTO Policy           | Leave types, accrual, request process          |
| Employee Handbook    | Company policies and procedures                |
| Exit Interview       | Feedback form with improvement areas           |
| Compensation Review  | Market data with adjustment recommendation     |
| Training Plan        | Skills gap analysis with timeline              |
| Team Charter         | Team goals, roles, working agreements          |

### Education (10 templates)

| Template            | Description                               |
| ------------------- | ----------------------------------------- |
| Course Syllabus     | Schedule, objectives, assessment criteria |
| Lesson Plan         | Activities, materials, time allocations   |
| Assessment Rubric   | Criteria grid with scoring levels         |
| Student Report      | Progress metrics and recommendations      |
| Research Proposal   | Hypothesis, methodology, timeline         |
| Lab Report          | Procedure, results, analysis              |
| Study Guide         | Key concepts with review questions        |
| Group Project Brief | Roles, deliverables, deadlines            |
| Peer Review Form    | Evaluation criteria and feedback          |
| Academic Paper      | Abstract, sections, citations             |

### Technical (10 templates)

| Template                     | Description                               |
| ---------------------------- | ----------------------------------------- |
| API Specification            | Endpoints, schemas, auth requirements     |
| Architecture Decision Record | Context, decision, consequences           |
| Incident Report              | Timeline, impact, root cause, remediation |
| Runbook                      | Step-by-step operational procedures       |
| RFC                          | Problem statement, proposal, alternatives |
| Release Notes                | Changes, fixes, known issues              |
| Technical Spec               | Requirements, design, implementation plan |
| Postmortem                   | Incident review with action items         |
| Migration Guide              | Version upgrade steps with checks         |
| Security Advisory            | Vulnerability, impact, patch instructions |

### Finance (8 templates)

| Template          | Description                          |
| ----------------- | ------------------------------------ |
| Standard Invoice  | Line items, tax, payment terms       |
| Budget Proposal   | Department budget with justification |
| Expense Report    | Line items with receipt references   |
| Financial Summary | Revenue, expenses, profit metrics    |
| Purchase Order    | Items, quantities, delivery terms    |
| Credit Memo       | Adjustment with original reference   |
| Audit Report      | Findings, recommendations, timeline  |
| Tax Summary       | Categories, amounts, deductions      |

### Healthcare (10 templates)

| Template                | Description                              |
| ----------------------- | ---------------------------------------- |
| Patient Consent         | Procedure, risks, alternatives           |
| Treatment Plan          | Diagnosis, interventions, timeline       |
| Discharge Summary       | Stay summary with follow-up instructions |
| Medical History         | Conditions, medications, allergies       |
| Lab Results             | Test values with reference ranges        |
| Referral Letter         | Patient info to specialist               |
| Care Plan               | Goals, interventions, evaluations        |
| Incident Report         | Event, response, follow-up               |
| Medication List         | Drugs, doses, schedules                  |
| Clinical Trial Protocol | Study design, endpoints, schedule        |

### Government (8 templates)

| Template                 | Description                           |
| ------------------------ | ------------------------------------- |
| Building Permit          | Application, requirements, conditions |
| FOIA Request             | Request details, scope, timeline      |
| Public Comment           | Issue, position, supporting data      |
| Grant Application        | Project, budget, timeline, outcomes   |
| Environmental Assessment | Impact, mitigation, monitoring        |
| Policy Brief             | Issue, analysis, recommendations      |
| Meeting Agenda           | Public meeting with comment periods   |
| Compliance Report        | Requirements, status, evidence        |

## Using a Hub template

### Browse and fork

1. Go to [hub.intenttext.io](https://hub.intenttext.io)
2. Filter by domain or search by name
3. Click **Fork** to copy to your account
4. Download the `.it` file

### Merge with data

```bash
# Download template
intenttext hub pull invoice-standard --domain finance

# Merge with your data
intenttext invoice-standard.it --data my-data.json --html --theme corporate
```

### Publish your own

```bash
intenttext hub publish my-template.it --domain business
```

Community templates are published instantly. Apply for curated status to appear in the official directory.

## Next steps

- [Building Templates](./building-templates) — create your own templates
- [Dynamic Tables](./dynamic-tables) — make tables data-driven
- [Merging Data](./merge-data) — CLI and API merge workflows
