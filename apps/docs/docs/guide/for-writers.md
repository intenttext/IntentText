---
sidebar_position: 8
title: For Writers
---

# IntentText for Writers

You want to write, not fight formatting. IntentText gives you plain text in → professional documents out.

## Markdown vs `.it`

If you write in Markdown today, `.it` will feel familiar — same plain-text comfort, same
inline `*bold*`/`_italic_`. The difference is everything Markdown *can't* do once a piece
matters: number your figures, build a real bibliography, lay out for print, write
right-to-left, and seal the final version so it can be verified later.

| You want…                    | Markdown                         | IntentText                                  |
| ---------------------------- | -------------------------------- | ------------------------------------------- |
| Headings & prose             | `#`, `##`, bare text             | `section:` / `sub:`, bare text (`text:` is optional) |
| Bold / italic / code         | Yes                              | Yes — same inline syntax                    |
| Numbered, captioned figures  | No (raw `![]()` only)            | `figure:` — numbered, captioned, referenceable |
| Citations / bibliography     | No                               | `cite:` builds a bibliography               |
| Footnotes, epigraphs, byline | Extension-dependent              | `x-writer:` (`footnote`, `epigraph`, `byline`, `dedication`) |
| Print / PDF layout           | No                               | `page:` / `font:` / `header:` / `footer:` → real PDF |
| Themes                       | Depends on the renderer          | 8 built-in (editorial, warm, minimal, …)    |
| Right-to-left / Arabic       | Awkward                          | First-class — write keywords in Arabic, RTL flips automatically |
| Seal the final version       | No                               | `sign:` / `freeze:` — tamper-evident, verifiable offline |

You don't give up the Markdown feel — you gain everything publishing-grade on top of it.

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

All aliases are listed in the [Aliases Reference](../reference/keywords/aliases) — including **33 Arabic aliases** (`عنوان:` for `title:`, `نص:` for `text:`, `اقتباس:` for `quote:`, …) that are re-emitted exactly as you wrote them, so an Arabic manuscript stays Arabic. Write what’s natural — the parser maps it to the canonical keyword.

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
quote: The best format is the one you can still read in 50 years. | by: Knuth, 1984

section: Sources
cite: Structured Documents and the Future of Computing | url: https://arxiv.org/example | author: Chen, Wei | date: 2025
cite: Open Formats in Enterprise | url: https://openstandards.org/example | author: Thompson, Ada | date: 2024
```

## Write in Arabic — a first-class manuscript story

IntentText isn't English-with-a-translation-layer. The canonical keywords have **33 Arabic
aliases**, and they **round-trip as written** — an Arabic manuscript stays Arabic through
parse, edit, and save (and a sealed Arabic document keeps its hash). Direction handles
itself: set `dir: rtl` (or just use Arabic) and headers, two-sided rows, and lists flip.

```intenttext
عنوان: مقدمة في الوثائق المنظمة
ملخص: لماذا يعود النص العادي إلى الواجهة
بيانات: | dir: rtl | theme: editorial

قسم: المشكلة
نص: تُخزَّن المعلومات الحساسة في صيغ لا يمكن البحث فيها ولا التحقق منها.
اقتباس: أفضل صيغة هي التي ما زلت تستطيع قراءتها بعد خمسين عاما. | by: كنوث، 1984
```

Mixed Arabic/English (a quote, a code block, a Latin term) renders correctly in the same
document — bidi is handled per run, not per file. See the
[full Arabic alias table](../reference/keywords/aliases#arabic-aliases).

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
def: Sealed | meaning: A document whose content hash has been locked with a SHA-256 seal. Any content modification breaks the seal; restyling and comments do not.
```

**Grouped (formal glossary):**

```intenttext
section: Definitions
def: Sealed | meaning: A document whose content hash has been locked with a SHA-256 seal.
def: Amendment | meaning: A formal, additive change to a frozen document that preserves the original seal.
def: Shallow Index | meaning: A per-folder index that only catalogs files in its own directory.
```

## Apply themes

8 built-in themes transform your document instantly:

```bash
dotit article.it --html --theme editorial
dotit article.it --html --theme warm
dotit article.it --print --theme minimal
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

One command (writes `article.pdf` next to the source; requires puppeteer):

```bash
dotit article.it --theme editorial --pdf
```

The print renderer reads `font:` and `page:` blocks for typography and layout:

```intenttext
font: | family: Georgia | size: 12pt | leading: 1.8
page: | size: A4 | margin: 25mm
header: | right: The Future of Structured Documents
footer: | center: Page {{page}} of {{pages}}
```

The `font:` block sets the body `family`, `size`, and `leading`; `page:` sets the sheet
`size` and `margin`; `header:`/`footer:` fill the `left`/`center`/`right` print zones.

## Citations and sources

`cite:` blocks create a bibliography:

```intenttext
cite: The Pragmatic Programmer | author: Hunt, Thomas | date: 2019 | url: https://pragprog.com/titles/tpp20/
```

## Long-form & editorial extras (`x-writer:`)

For manuscript furniture beyond the core set, the **`x-writer:`** namespace adds stable
publishing keywords — they round-trip and render, without enlarging the canonical contract:

```intenttext
x-writer: byline | author: Elena Vasquez | date: 2026-03-15
x-writer: epigraph | text: All happy families are alike. | by: Tolstoy
x-writer: footnote | id: 1 | text: See appendix B for the full dataset.
x-writer: dedication | text: For the open-format faithful.
```

Available: `byline`, `figure`, `caption`, `footnote`, `epigraph`, `dedication`. See
[Extension keywords](../reference/keywords/#extension-keywords).

## Inline formatting

Within any block, use:

| Syntax           | Result             |
| ---------------- | ------------------ |
| `*text*`         | **bold**           |
| `_text_`         | _italic_           |
| `~text~`         | ~~strikethrough~~  |
| ` ```text``` `   | `inline code`      |
| `` `text` ``     | label / badge pill |
| `{text}`         | label / badge pill |
| `^text^`         | highlighted        |
| `[[text]]`       | inline note        |
| `@person`        | mention            |
| `#topic`         | tag                |

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
2. Preview with `dotit article.it --html --theme editorial`
3. Get feedback, revise
4. `track:` to activate history
5. `approve:` for editorial sign-off
6. `sign:` / `freeze:` to seal the published version — tamper-evident and verifiable offline (restyling a sealed piece is still free; only a content edit breaks the seal)
7. Export with `--pdf` (or PAdES / PDF/A for an archival, signed copy)
8. Commit the `.it` source to version control — it stays a plain, readable file

---

**Related:**

- [Themes →](../ecosystem/themes)
- [Figures and Captions →](../cookbook/data/figures-and-captions)
- [Definitions and Glossaries →](../cookbook/data/definitions-and-glossaries)
- [PDF Export →](../cookbook/print/pdf-export)
