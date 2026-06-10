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

**`@intenttext/core@4.1.0` is PUBLISHED** to npm (2026-06-10, tag `latest`, public,
56 files / 71 kB) — published directly from the authenticated account after the
release gate passed (build + 872 tests + keyword + parity + pack). Was 3.5.0.

Editor + vscode reference `workspace:*` and bundle core at build time, so they use the
local 4.1.0 directly — both rebuilt against it for testing.

Remaining git hygiene (owner's call): merge `chore/v4.1.0-finalization` → `main` and
push a `v4.1.0` tag so the GitHub release + provenance match the npm release. (npm is
already published; this is just to keep git/GitHub in sync.)

## Demo 3 — the editor (in progress)

The editor already has Monaco + a TipTap visual editor + bridge, trust panel & modals,
preview, print bar, theme picker, and a showcase system. Demo 3 is assess-and-polish,
phased:

- [x] **A. Round-trip fidelity — DONE (7/7).** The visual editor produces canonical
  `.it` losslessly (faithful to core, the source of truth).
  - Removed a dead second serializer (flat VisualBlock model — no callers).
  - core now exports `blockToSource` (canonical per-block serializer).
  - `docToSource` emits canonical bullets (`- ` / `N.`); `sourceToDoc` groups runs of
    list lines into TipTap `bulletList`/`orderedList` nodes.
  - Fixed a core serializer bug: custom blocks used `originalContent` (which includes
    the `keyword:` prefix) → duplicated keyword (`- ahmed: Ahmed: …`). Now uses
    `content`.
  - Fidelity harness `pnpm --filter intenttext-editor roundtrip:check` (no deps; Node
    type-stripping) compares the visual round-trip to core's canonical round-trip:
    **7/7 documents pass.** Wired into CI (Node bumped 20→22).
- [x] **B. Trust sidebar — DONE.** The TrustPanel already had the full lifecycle
  (Tracked→Approved→Signed→Sealed), seal card, one-click Verify, and all actions.
  - Fixed a real bug: `sealedBy` read from `freeze.by` (freeze blocks carry only
    at/hash/status), so the sealed card showed a blank sealer. Now derived from the
    `sign:` block added during sealing.
  - Verify result now lists per-signer validity (signed-this-version vs an earlier
    version) from `VerifyResult.signers` — the "show seal/sign clearly" ask.
- [~] **C. Embed Demo 1 — partly done.** Added the signed invoice (Demo 1's finished
  output) as a loadable sample and made it the **default document**, so the editor
  opens on a clean enterprise invoice that renders nicely, lights up the Trust panel
  (seal + signature), and stays queryable. Wired a **Samples** dropdown into the live
  Toolbar (the demo-doc machinery existed but was dead/unwired).
  - Follow-up: an interactive **merge-from-data** UI (template + JSON → filled doc) to
    show the full pipeline live, not just the output. (core already has `parseAndMerge`.)
  - Note: 4 showcase panels (Search/Trust/Workflow/FirstRun, ~970 LOC) are dead/unwired
    — decide revive vs delete.
- [x] **D. Native PDF — DONE.** Export is browser print-to-PDF via an iframe — **zero
  PDF dependencies** (the goal). Fixed a real gap: `exportPDF`/`exportHTML` used
  `renderHTML` + a hardcoded `@page { size: A4 }` that ignored the document's print
  layout. Now they use core's `renderPrint`, which honors `font:`/`page:`/`header:`/
  `footer:` blocks — page size, margins, running headers/footers **with page numbers**,
  watermarks, page breaks. Removed the divergent `buildPrintCss`.
- [ ] On-save index update inside the editor (optimization on top of lazy self-heal).

## Other saved items (do not lose)

- [ ] **Publish `@intenttext/core` to npm** — publish-ready (see status above). Process:
  merge branch → tag `v4.1.0` → `NPM_TOKEN`. Owner triggers; not done unilaterally.
- [x] **Template-variable warning fixed (4.1.1).** The "Unresolved variable {{…}}"
  warning originated in core's `validate.ts` (surfaced by both editor and VSCode). A
  document with `{{…}}` placeholders but no declared context is now treated as a
  template (placeholders resolve at merge); undeclared vars still warn when a context
  IS declared. Published `@intenttext/core@4.1.1`; editor + vscode rebuilt against it.
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
