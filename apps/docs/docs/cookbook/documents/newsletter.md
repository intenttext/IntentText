---
sidebar_position: 4
title: Newsletter
---

# Newsletter

## The problem

You need an editorial newsletter with images, pull quotes, source citations, and a warm visual style — suitable for email or PDF distribution.

## The solution

```intenttext
title: The Acme Weekly — Issue #42
summary: AI in manufacturing, team spotlight, and Q2 roadmap
meta: | type: newsletter | domain: editorial

page: | size: A4 | margins: 2cm
font: | body: Georgia | heading: Inter | size: 11pt
header: The Acme Weekly | align: center | size: 10pt
footer: © 2026 Acme Corp — Subscribe at acme.co/newsletter | align: center | size: 8pt

section: Lead Story

text: *AI-Powered Quality Control Goes Live*

figure: Assembly line monitoring system | at: /images/ai-quality-control.jpg | caption: The new AI monitoring system inspects 2,000 units per hour with 99.7% accuracy | source: Internal photography, March 2026

text: After 18 months of development, our AI quality control system is live on Production Line 3. The system uses computer vision to inspect manufactured components, flagging defects that human inspectors miss at speed.

quote: We're not replacing inspectors — we're giving them superpowers. The AI catches the subtle defects that slip through at full line speed. | by: Sarah Chen | role: VP Manufacturing

text: Early results show a ^47% reduction^ in defect escape rate and a ~12-minute~ 8-minute average inspection cycle time. The team plans to roll out to all six production lines by Q3.

cite: McKinsey Global Institute | at: https://mckinsey.com/ai-manufacturing | note: AI quality inspection reduces defect rates by 30-50% across manufacturing sectors

section: Team Spotlight

figure: Engineering team at the March hackathon | at: /images/hackathon-team.jpg | caption: The Acme engineering team during the 2026 spring hackathon

text: *Meet the Cloud Migration Team*

contact: Ahmed Al-Rashid | role: Team Lead | email: ahmed@acme.co
contact: James Miller | role: Senior Engineer | email: james@acme.co
contact: Maria Santos | role: DevOps Engineer | email: maria@acme.co

text: This team completed the full cloud migration 2 weeks ahead of schedule and $12K under budget. Their approach — migrating service by service with zero-downtime cutover — is now the standard playbook for future migrations.

quote: The key was treating each service as an independent migration project. Small batches, fast feedback. | by: Ahmed Al-Rashid

section: Q2 Roadmap

text: Three major initiatives for the next quarter:

deadline: API Platform GA | due: 2026-04-15 | status: in-progress
deadline: Mobile SDK Alpha | due: 2026-06-01 | status: planning
deadline: Security Certification | due: 2026-06-30 | status: planning

section: Quick Links

link: Q1 Performance Report | to: https://internal.acme.co/reports/q1-2026
link: Hackathon Projects Gallery | to: https://internal.acme.co/hackathon-2026
link: Updated PTO Policy | to: https://internal.acme.co/hr/pto-policy
link: Subscribe to This Newsletter | to: https://acme.co/newsletter/subscribe
```

## Step by step

1. **Lead story** — Bold text with `*asterisks*`, a `figure:` for the hero image, `quote:` for a pull quote, and `cite:` for the external source.
2. **Inline formatting** — `^highlight^` for emphasis, `~strikethrough~` for the old number replaced by the new one.
3. **Team spotlight** — `contact:` blocks make team members queryable across all newsletters.
4. **Figures** — `figure:` with `caption:` and `source:` for auto-numbered, captioned images.
5. **Deadlines** — Even in a newsletter, `deadline:` blocks are queryable so you can track initiatives across issues.
6. **Links** — `link:` blocks for resources, each with a `to:` URL.

## Render with the right theme

Newsletters look best with `warm` or `editorial` themes:

```bash
# Warm theme — friendly, approachable
intenttext newsletter.it --html --theme warm

# Editorial theme — magazine-style
intenttext newsletter.it --html --theme editorial

# PDF for email attachment
intenttext newsletter.it --pdf --theme editorial
```

## Query it

```bash
# All people mentioned across newsletters
intenttext query ./newsletters --type contact --format table

# All deadlines announced in newsletters
intenttext query ./newsletters --type deadline --format table

# Find citations
intenttext query ./newsletters --type cite --format json
```

## Next steps

- [Figures & Captions](../data/figures-and-captions) — deep dive on figure auto-numbering
- [Definitions & Glossaries](../data/definitions-and-glossaries) — add a glossary section for technical newsletters
- [Print-Ready Documents](../print/print-ready-documents) — full print layout configuration
