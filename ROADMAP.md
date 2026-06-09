# IntentText — Product Roadmap

_Last updated: 2026-06-10. Forward plan. For the completed cleanup, see
[FINALIZATION.md](FINALIZATION.md); for architecture, [ARCHITECTURE.md](ARCHITECTURE.md);
for the format, [packages/core/SPEC.md](packages/core/SPEC.md)._

## Thesis & wedge

`.it` is the only plain-text file that is simultaneously a **readable document**, a
**queryable/typed database**, and a **signable artifact**. The convergence is the moat
(each property exists elsewhere — Markdown, YAML, docx, Notion — but no one file does
all at once).

**Beachhead wedge:** the **template → merge → render → sign → query** pipeline for
business documents (invoices, contracts, reports). It's the only use case that exercises
every unique property at once, and it has buyers today. Win it before expanding.

## Strategic decisions (settled 2026-06-10)

| Question | Decision |
| --- | --- |
| Open source | Stay MIT. The format must be open for adoption + trust. Monetize **around** it: hosted Hub, a **trust/notary authority**, team/cloud features. Don't close the core. |
| Discarded apps | Keep as experimental, don't delete. Hub is "later," not gone (it's the monetization surface). Archive Desktop to a branch only if it bitrots. |
| Project cleanup | Yes — careful dead-file/code sweep with sign-off. (In progress.) |
| Editor quality target | **Notion-quality block editor that round-trips losslessly to clean `.it`** — NOT Google Docs parity. TipTap is the right foundation. |
| Trust UI | Build a simple trust sidebar: seal status, signers, freeze/lock, one-click Verify. |
| "Arbitrary CSS per line" idea | **Rejected.** It re-presentationalizes the format and kills the queryable-by-meaning moat. Styling belongs in **themes** + a small validated style vocabulary, or in the rendered HTML — never raw CSS in the `.it` body. |
| Sign/seal model | Today = SHA-256 **tamper-evidence** (not PKI identity). Keep the canonicalization **open & spec'd** so anyone can verify. The paid moat is a **notary/timestamp authority** (open algorithm, paid trust). Optional v2: real Web Crypto keypair signatures for identity. |

## Styling & visual fidelity (reconciled 2026-06-10)

Documents must look enterprise-grade (contracts, invoices, letters, quotations,
drafts). The way to get that **without** poisoning the query moat is to keep style
**separate from content** — exactly how HTML+CSS works (CSS lives in a stylesheet,
not inline on every tag). Three layers, none of which put presentation in the
semantic body:

1. **Themes = document classes (primary).** `theme: legal | corporate | letter`.
   Owns typography, margins, table styling, section headers, signature-block layout.
   8 themes exist today → enrich them to enterprise quality.
2. **Scoped `style:` block ("CSS done right").** A designated style region mapping
   block types / named classes to CSS-like rules, kept OUT of the content body. Full
   visual control; content stays clean and queryable. _(to design/build)_
3. **Small semantic inline vocabulary (exists).** `| align: right`, `| variant: …` —
   constrained, validated, not arbitrary CSS.

Rejected: arbitrary CSS inline on content lines (re-presentationalizes the format,
kills queryable-by-meaning). The body says *what*; the style layer says *how*.
We are not competing with HTML/docx — visuals just need to be decent and enterprise-
credible. (Deep theme/style work is scheduled after the demos.)

## Demo sequence (the path to "undeniable")

1. **Demo 1 — template + merge + sign + query.** A runnable demo: a template (as if
   from a DB) + a data row → rendered, **signed** business document, in ~10 lines, zero
   extra deps, then **queried** by parameter. This is the pitch. Needs core + a great
   script (+ optionally Hub). Almost no editor work.
2. **Demo 2 — desktop/folder search.** Point at a folder of `.it` files, query by
   parameter (not just full text). Built on `index-builder` + `query`. (Note: "query a
   folder" is the strong version; OS desktop-search integration is the weak one.)
3. **Demo 3 — document editor.** `.it` does what a regular person needs from a word
   processor: rich editing, native PDF generation, minimal dependencies, and lossless
   round-trip to clean `.it`.

## npm publish status

`@intenttext/core` is **publish-ready** (v4.1.0): release gate green (build + 869
tests + keyword + parity + pack), README fixed, tarball healthy (56 files, 70.9 kB),
major bump correctly reflects the breaking Rust-API removal. Remaining is **process**,
owner's call: merge this branch to `main`, push a `v4.1.0` tag, with `NPM_TOKEN`
configured. `release.yml` then publishes core via pnpm. (Publishing is irreversible —
not done without explicit go-ahead.)

## Active work queue

- [x] **Cleanup pass** — done.
- [x] **Demo 1** — template+merge+sign+query, runnable (`pnpm demo:invoice`).
- [x] **Demo 2** — folder query-by-parameter, runnable (`pnpm demo:search`).
- [ ] **Demo 3** — word-processor-grade editor: rich editing, native PDF, lossless
  round-trip. _(next major effort; see editor items below)_
- [ ] **Show Demo 1 inside the editor** — a built-in way to load/run the
  template→merge→sign→query invoice demo from the web editor. Pairs with editor
  readiness + npm publish; this is what makes Demo 1 "perfect." _(feeds Demo 3)_
- [ ] Trust sidebar in the editor (seal/sign/freeze/history + Verify). _(feeds Demo 3)_
- [ ] Lossless visual ↔ `.it` round-trip in the editor. _(feeds Demo 3)_
- [ ] SPEC §4: precise **canonicalization** subsection so sealing/verifying is
  reproducible by anyone.
- [ ] Public "how sign/seal works" doc (tamper-evidence today; notary service = the
  paid path).
- [ ] Native PDF generation path with minimal dependencies. _(feeds Demo 3)_
- [x] **Wire incremental indexing** — CLI `index` refreshes only changed entries;
  `query` self-heals each folder index before composing. Shallow per-folder
  `.it-index` cache, lazy self-healing, no init step. See
  [packages/core/INDEXING.md](packages/core/INDEXING.md).
- [ ] On-save index update inside the editor (optimization on top of lazy). _(feeds Demo 3)_

## Done (this engagement)

- v4.1.0 finalization: one TS parser, tiered format (core 13 + profiles), parity gates,
  focused supported surface (core/mcp/vscode/editor). See FINALIZATION.md.
- Fixed serializer round-trip (list/step bullets, custom keywords).
- Fixed the editor history view (was always empty) + verified parser history handling.

## Background context

- Product vision & use-cases: see memory `intenttext-product-vision`.
- Supported surface = core, mcp, vscode, editor. Experimental = hub, desktop, docs,
  builder, python.
