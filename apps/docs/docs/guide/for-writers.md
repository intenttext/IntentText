---
sidebar_position: 8
title: For Writers
---

# IntentText for Writers

You want to write, not fight formatting. IntentText gives you plain text in → professional documents out.

## Writer-friendly keywords

You don't need to memorize the full language. Writers use these first:

| You write                   | It means           | Canonical  |
| --------------------------- | ------------------ | ---------- |
| `note:` or `body:`          | A paragraph        | `text:`    |
| `h2:` or `heading:`         | Section heading    | `section:` |
| `h3:` or `subheading:`      | Subsection heading | `sub:`     |
| `blockquote:` or `excerpt:` | Quotation          | `quote:`   |
| `citation:` or `source:`    | Citation           | `cite:`    |
| `todo:` or `check:`         | Task item          | `task:`    |

All aliases are listed in the [Aliases Reference](../reference/keywords/aliases). Write what’s natural — the parser maps it to the canonical keyword.

## Write an article

```intenttext
title: The Future of Structured Documents
summary: Why plain text formats are making a comeback
meta: | author: Elena Vasquez | date: 2026-03-15 | tags: opinion, technology

section: The Problem
text: Every organization stores critical information in formats that can’t be searched, can’t be queried, and can’t be verified.
text: A contract in Word is just a blob of styled text. The deadline on page 12? Good luck finding it.

section: The Solution
text: Structured plain text — where every line declares its intent — is the answer that’s been hiding in plain sight.
quote: The best format is the one you can still read in 50 years. | citation: Knuth, 1984

section: Sources
cite: Structured Documents and the Future of Computing | url: https://arxiv.org/example | author: Chen, Wei | date: 2025
cite: Open Formats in Enterprise | url: https://openstandards.org/example | author: Thompson, Ada | date: 2024
```

## Add figures with captions

`figure:` gives you numbered, captioned images — unlike `image:` which is inline and unnumbered:

```intenttext
figure: The IntentText document lifecycle | src: ./images/lifecycle.png | num: 1 | caption: Documents progress from draft to sealed, with optional formal amendments.
figure: Query architecture | src: ./images/query-arch.png | num: 2 | caption: Shallow indexes compose automatically across nested folders.
```

| Keyword   | What it does                                         |
| --------- | ---------------------------------------------------- |
| `image:`  | Inline image, no number, no caption, flows with text |
| `figure:` | Numbered, captioned, referenceable, floats in print  |

## Define terms

Use `def:` near the first use of a term, or gather definitions in a glossary section:

**Inline (near first use):**

```intenttext
text: The document enters the sealed state after freeze.
def: Sealed | meaning: A document whose content hash has been cryptographically locked. Any modification breaks the seal.
```

**Grouped (formal glossary):**

```intenttext
section: Definitions
def: Sealed | meaning: A document whose content hash has been cryptographically locked.
def: Amendment | meaning: A formal, additive change to a frozen document that preserves the original seal.
def: Shallow Index | meaning: A per-folder index that only catalogs files in its own directory.
```

## Apply themes

8 built-in themes transform your document instantly:

```bash
intenttext article.it --html --theme editorial
intenttext article.it --html --theme warm
intenttext article.it --print --theme minimal
```

| Theme         | Best for                                   |
| ------------- | ------------------------------------------ |
| **corporate** | Business documents, quarterly reports      |
| **minimal**   | Clean, distraction-free reading            |
| **warm**      | Articles, newsletters, personal documents  |
| **technical** | API docs, specs, engineering reports       |
| **print**     | Optimized for paper output                 |
| **legal**     | Contracts, policies, formal agreements     |
| **editorial** | Magazine-style articles, long-form content |
| **dark**      | Screen-optimized dark mode                 |

## Export to PDF

One command:

```bash
intenttext article.it --print --theme editorial --pdf article.pdf
```

The print renderer reads `font:` and `page:` blocks for typography and layout:

```intenttext
font: | family: Georgia | size: 12pt | leading: 1.8 | heading: Playfair Display
page: | size: A4 | margins: 25mm
header: | right: Elena Vasquez — The Future of Structured Documents
footer: | center: Page {{page}} of {{pages}}
```

## Citations and sources

`cite:` blocks create a bibliography:

```intenttext
cite: The Pragmatic Programmer | author: Hunt, Thomas | date: 2019 | url: https://pragprog.com/titles/tpp20/
```

## Inline formatting

Within any block, use:

| Syntax         | Result            |
| -------------- | ----------------- |
| `*text*`       | **bold**          |
| `_text_`       | _italic_          |
| `~text~`       | ~~strikethrough~~ |
| ` ```text``` ` | `inline code`     |
| `` `text` ``   | label / badge     |
| `{text}`       | label / badge     |
| `^text^`       | highlighted       |
| `[[text]]`     | inline note       |
| `@person`      | mention           |
| `#topic`       | tag               |

## Code blocks

`code:` works like any other keyword — triple backticks delimit the code value:

**Single-line:**

````intenttext
code: ```console.log("Hello, World!")``` | lang: javascript
````

**Multi-line:**

````intenttext
code: ```
def greet(name):
    print(f"Hello, {name}")
``` | lang: python
````

**Inline code** — use triple backticks within any text block:

````intenttext
text: Run ```npm install``` to set up the project.
````

## The editorial workflow

1. Write in `.it` — plain text, any editor
2. Preview with `intenttext article.it --html --theme editorial`
3. Get feedback, revise
4. `track:` to activate history
5. `approve:` for editorial sign-off
6. Export with `--pdf`
7. Publish the template to the Hub for others to use

---

**Related:**

- [Themes →](../ecosystem/themes)
- [Figures and Captions →](../cookbook/data/figures-and-captions)
- [Definitions and Glossaries →](../cookbook/data/definitions-and-glossaries)
- [PDF Export →](../cookbook/print/pdf-export)
