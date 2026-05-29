---
sidebar_position: 4
title: Figures & Captions
---

# Figures & Captions

## The problem

You have images in documents with no captions, no numbering, and no way to reference "Figure 3" from the text. Images float wherever they land — there's no structure.

## The solution

`figure:` creates numbered, captioned, referenceable figures. Use `image:` for inline images that flow with text. Use `figure:` when you need a formal figure.

### `image:` vs `figure:`

|                   | `image:`                    | `figure:`                             |
| ----------------- | --------------------------- | ------------------------------------- |
| **Numbered**      | No                          | Yes — Figure 1, Figure 2, etc.        |
| **Captioned**     | No                          | Yes — `caption:` property             |
| **Referenceable** | No                          | Yes — by figure number                |
| **Layout**        | Flows inline with text      | Floats in print, standalone in HTML   |
| **Use when**      | Decorative or inline images | Charts, diagrams, data visualizations |

### Using `image:`

```intenttext
text: Our office is located in downtown San Francisco.
image: Office building | at: /images/office.jpg
text: We've been at this location since 2015.
```

Simple. Inline. No number or caption.

### Using `figure:`

```intenttext
figure: Monthly revenue trend | at: /images/revenue-chart.png | caption: Revenue grew 22% YoY with strongest growth in Q4 | source: Internal analytics | width: 80%

figure: Architecture diagram | at: /images/architecture.svg | caption: High-level system architecture showing the three-tier design | source: Engineering team

figure: Customer satisfaction scores | at: /images/csat-chart.png | caption: CSAT improved from 3.8 to 4.5 after the support redesign | source: Zendesk analytics | number: 3
```

Each figure gets an auto-incremented number: Figure 1, Figure 2, Figure 3.

### Properties

| Property   | Description                                 |
| ---------- | ------------------------------------------- |
| `at:`      | File path or URL to the image               |
| `caption:` | Description text displayed below the figure |
| `source:`  | Data source attribution                     |
| `width:`   | Display width (CSS value)                   |
| `number:`  | Override auto-numbering                     |
| `alt:`     | Alternative text for accessibility          |

## Research report with figures

```intenttext
title: Q1 2026 Cloud Services Market Report
summary: Market analysis with data visualizations
meta: | type: report | domain: research

section: Market Overview

text: The global cloud services market reached $540B in Q1 2026, representing 22% year-over-year growth. Three providers — AWS, Azure, and GCP — continue to hold 67% combined market share.

figure: Cloud market size 2022–2026 | at: /images/market-size.png | caption: Cloud services market grew from $380B to $540B over four years | source: Gartner Cloud Infrastructure Report 2026

section: Competitive Landscape

text: AWS maintained its lead at 31% market share, though Azure narrowed the gap to 7 percentage points — the smallest ever.

figure: Market share by provider | at: /images/market-share.png | caption: AWS 31%, Azure 24%, GCP 12%, Others 33% | source: Synergy Research Group

section: Growth Segments

figure: Growth rate by segment | at: /images/segment-growth.png | caption: AI/ML services grew fastest at 47% YoY, followed by edge computing at 35% | source: IDC Cloud Tracker

text: AI/ML cloud services were the fastest-growing segment for the third consecutive quarter.

figure: Regional growth comparison | at: /images/regional-growth.png | caption: APAC led growth at 28% YoY, compared to 20% in North America and 18% in EMEA | source: IDC Cloud Tracker
```

This renders with:

- **Figure 1**: Cloud market size 2022–2026
- **Figure 2**: Market share by provider
- **Figure 3**: Growth rate by segment
- **Figure 4**: Regional growth comparison

## Print layout

In print/PDF output, figures are treated as floating elements:

- Small figures (< 50% width) float to the right with text wrapping
- Full-width figures get their own line
- Captions appear below the figure, left-aligned
- Figure numbers are bold: **Figure 1:** followed by the caption

## Querying figures

```bash
# All figures across reports
intenttext query ./reports --type figure --format table

# Figures from a specific source
intenttext query ./reports --type figure --content "Gartner" --format json
```

## Next steps

- [Report](../documents/report) — full report with figures and metrics
- [Newsletter](../documents/newsletter) — newsletter with editorial images
- [Print-Ready Documents](../print/print-ready-documents) — controlling print layout
