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

## Demo 3 — the editor (in progress)

The editor already has Monaco + a TipTap visual editor + bridge, trust panel & modals,
preview, print bar, theme picker, and a showcase system. Demo 3 is assess-and-polish,
phased:

- [~] **A. Round-trip fidelity** _(in progress — wedge proven, one gap left)_
  - Removed a dead second serializer (flat VisualBlock model — no callers).
  - core now exports `blockToSource` (canonical per-block serializer).
  - Fixed list serialization (`text: •` → `- ` / `N.`).
  - Added a fidelity harness (`pnpm --filter intenttext-editor roundtrip:check`):
    **all 5 business documents round-trip losslessly.**
  - **Remaining gap (precise):** in `visual/bridge.ts`, `sourceToDoc`'s line-walker
    processes lines one at a time and never groups consecutive `- ` / `N.` lines into
    TipTap `bulletList` / `orderedList` nodes; `blockToNode` has no `list-item` /
    `step-item` case, so list lines fall through to `itGenericBlock` and get mangled.
    Fix: group runs of bullet/ordered lines into list nodes on the source→doc side
    (docToSource already emits `- `/`N.` correctly). Verify with `roundtrip:check`
    (target: simple.it + meeting-notes.it pass → 7/7).
- [ ] **B. Trust sidebar** — polish TrustPanel into a simple seal/sign/freeze/history
  view + one-click Verify.
- [ ] **C. Embed Demo 1** — plug the invoice template→merge→sign→query flow into the
  existing showcase system. Makes Demo 1 "perfect."
- [ ] **D. Native PDF** — assess the print-bar PDF path, minimize dependencies.
- [ ] On-save index update inside the editor (optimization on top of lazy self-heal).

## Other saved items (do not lose)

- [ ] **Publish `@intenttext/core` to npm** — publish-ready (see status above). Process:
  merge branch → tag `v4.1.0` → `NPM_TOKEN`. Owner triggers; not done unilaterally.
- [ ] **VSCode extension: stop flagging template variables as errors.** Template files
  (pre-merge) legitimately contain unresolved `{{invoice.number}}` — the extension
  currently surfaces "Unresolved variable …" as a warning. Suppress for templates
  (e.g. files with unresolved vars, or a `template`/`type:` hint), or downgrade to a
  hint. Don't warn on intentional template placeholders.
- [ ] **Enterprise-grade visuals — show it.** Demonstrate that `.it` can render
  documents an enterprise would actually use (contract, invoice, letter). Builds on
  the styling plan (themes as document classes + scoped `style:` block). Deliverable:
  enrich a couple of themes to enterprise quality + a side-by-side "same `.it`, three
  themes" showcase. (See "Styling & visual fidelity" above.)

## Done (this engagement)

- [x] **Cleanup pass.**
- [x] **Demo 1** — template+merge+sign+query (`pnpm demo:invoice`).
- [x] **Demo 2** — folder query-by-parameter (`pnpm demo:search`).
- [x] **Incremental, self-healing indexing** — CLI `index`/`query`, no init step.
  See [packages/core/INDEXING.md](packages/core/INDEXING.md).
- [ ] SPEC §4: precise **canonicalization** subsection so sealing/verifying is
  reproducible by anyone. _(pending)_
- [ ] Public "how sign/seal works" doc (tamper-evidence today; notary = paid path). _(pending)_

## Done (this engagement)

- v4.1.0 finalization: one TS parser, tiered format (core 13 + profiles), parity gates,
  focused supported surface (core/mcp/vscode/editor). See FINALIZATION.md.
- Fixed serializer round-trip (list/step bullets, custom keywords).
- Fixed the editor history view (was always empty) + verified parser history handling.

## Background context

- Product vision & use-cases: see memory `intenttext-product-vision`.
- Supported surface = core, mcp, vscode, editor. Experimental = hub, desktop, docs,
  builder, python.
