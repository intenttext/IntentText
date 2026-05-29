---
slug: v210-themes-hub-ecosystem
title: "v2.10: Themes, the Hub, and the Ecosystem"
authors: [intenttext]
tags: [release, themes, hub]
---

v2.10 is the ecosystem release. Eight built-in themes. The Hub — a platform for sharing templates and themes. Shallow indexes for folder-level querying. And 76 seeded templates across 8 domains.

<!-- truncate -->

## Themes without npm

Every theme is a JSON file with four sections: fonts, colors, spacing, and optional block overrides. No CSS to write. No build step. No npm package.

```json
{
  "name": "corporate",
  "fonts": {
    "body": "Inter",
    "heading": "Inter",
    "mono": "JetBrains Mono",
    "size": "10pt",
    "leading": "1.5"
  },
  "colors": { "text": "#1a1a1a", "heading": "#111", "accent": "#2563eb" },
  "spacing": { "page-margin": "1in", "section-gap": "2rem" }
}
```

Apply it:

```bash
intenttext document.it --html --theme corporate
```

Eight themes ship built-in: **corporate**, **minimal**, **warm**, **technical**, **print**, **legal**, **editorial**, **dark**. Each is designed for a specific use case — legal themes use serif fonts, technical themes use monospace headers, editorial themes have generous whitespace.

## The Hub

The IntentText Hub at [intenttext-hub.vercel.app](https://intenttext-hub.vercel.app) is a two-tier platform:

1. **Templates** — Complete `.it` files with `{{variable}}` placeholders. Pull them, merge your data, render.
2. **Themes** — JSON theme files. Pull them, apply to any document.

We've seeded the Hub with 76 templates across 8 domains: business, legal, finance, HR, technical, education, healthcare, and government. Every template works with every theme.

### Publishing

Anyone with a GitHub account can publish:

```bash
intenttext hub login
intenttext hub publish invoice-premium.it --domain finance --description "Premium invoice with line items"
```

Templates are validated before publishing. They must parse cleanly, include at least one variable, and match their declared domain.

## Shallow indexes

v2.10 introduces `.it-index` files — shallow indexes that summarize a folder of `.it` documents:

```bash
intenttext index ./contracts
```

This produces a JSON file with metadata and block summaries for every `.it` file in the folder. Queries then run against the index instead of re-parsing every file:

```bash
intenttext query ./contracts --type deadline --format table
```

The architecture is deliberately shallow — each index covers one folder, no recursion. Compose indexes across folders for cross-cutting queries.

## 76 templates

The seeded templates cover real document types:

| Domain     | Templates | Examples                                     |
| ---------- | --------- | -------------------------------------------- |
| Business   | 12        | invoice, proposal, meeting minutes           |
| Legal      | 10        | NDA, service agreement, terms of service     |
| Finance    | 8         | budget, expense report, financial statement  |
| HR         | 10        | offer letter, performance review, onboarding |
| Technical  | 12        | API spec, incident report, runbook           |
| Education  | 8         | syllabus, lesson plan, assessment            |
| Healthcare | 8         | patient intake, prescription, referral       |
| Government | 8         | permit, public notice, meeting agenda        |

Every template is a real, complete document — not a skeleton. Pull one and you have a working starting point.

[Browse templates on the Hub →](https://intenttext-hub.vercel.app)
