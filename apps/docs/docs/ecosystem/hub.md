---
sidebar_position: 2
title: Hub
---

# IntentText Hub

The [IntentText Hub](https://hub.intenttext.io) is the template marketplace for `.it` files. Browse, fork, publish, and merge templates across 8 domains.

## Two-tier system

### Community tier

Anyone with a GitHub account can publish templates. Community templates are available instantly — no review required.

- Publish with `intenttext hub publish template.it --domain finance`
- Visible to all users immediately
- Author name and profile linked to GitHub account

### Curated tier

Templates reviewed by the IntentText team for quality, completeness, and best practices. Curated templates appear in the official directory.

- Submit for review after publishing
- Review checks: correct keywords used, realistic data, proper print layout, trust keywords where appropriate
- Approved templates get a "Curated" badge

## The 76 official templates

| Domain     | Count | Examples                                           |
| ---------- | ----- | -------------------------------------------------- |
| Legal      | 10    | Service agreement, NDA, terms of service           |
| Business   | 10    | Proposal, quarterly report, meeting minutes        |
| HR         | 10    | Offer letter, performance review, job description  |
| Education  | 10    | Syllabus, lesson plan, rubric                      |
| Technical  | 10    | API spec, ADR, incident report                     |
| Finance    | 8     | Invoice, budget, expense report                    |
| Healthcare | 10    | Patient consent, treatment plan, discharge summary |
| Government | 8     | Building permit, FOIA request, grant application   |

Browse all templates at [hub.intenttext.io](https://hub.intenttext.io).

## The 8 built-in themes

Themes are distributed through the Hub. All 8 built-in themes are pre-installed.

| Theme       | Style                                         |
| ----------- | --------------------------------------------- |
| `corporate` | Blue accents, Inter font, professional        |
| `minimal`   | Clean, maximum whitespace, simple typography  |
| `warm`      | Warm colors, Georgia serif, friendly          |
| `technical` | Monospace accents, compact, data-dense        |
| `print`     | Maximum readability on paper                  |
| `legal`     | Formal, serif, minimal color                  |
| `editorial` | Magazine-style, large headings, pull quotes   |
| `dark`      | Dark background, light text, screen-optimized |

See [Themes](./themes) for details.

## Authentication

Sign in with GitHub OAuth. Your GitHub username becomes your Hub identity.

```bash
# Authenticate via browser
intenttext hub login
```

## Publishing a template

```bash
# Publish to the Hub
intenttext hub publish invoice-template.it --domain finance

# With metadata
intenttext hub publish invoice-template.it --domain finance --description "Standard invoice with line items"
```

Requirements:

- File must parse without errors
- `meta: | type: template` recommended
- `title:` and `summary:` required

## Using Hub templates

### Browse online

Go to [hub.intenttext.io](https://hub.intenttext.io) and filter by domain or search by name.

### Pull via CLI

```bash
intenttext hub pull invoice-standard --domain finance
```

### Fork

Fork a template to your account, customize it, and publish your version.

## Publishing themes

Create custom themes and distribute them through the Hub:

```bash
intenttext theme publish my-theme.json
```

See [Themes](./themes) for the theme JSON format.
