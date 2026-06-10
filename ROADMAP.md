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

## Tomorrow — TWO confirmed real bugs (not staleness; incognito reproduced both)

The `renderPrint` OUTPUT is verified styled — headless Chrome of the exact editor
output → `/tmp/actual.pdf` is a fully-styled invoice. So core is correct; the bugs are
in the editor's print mechanism + the visual editor.

**BUG 1 — PDF button prints unstyled.** There are TWO PDF buttons:
- `apps/editor/src/panels/PrintBar.tsx` exportPDF — uses `renderPrint` (correct CSS),
  BUT prints via a **zero-size iframe** (`width:0;height:0`). Chrome can print a
  zero-dimension iframe blank/unstyled — suspect #1.
- `apps/editor/src/toolbar/ExportMenu.tsx` exportPDF (lines 80-86, the toolbar
  "Export ▾ → Export as PDF") — does NOT render anything; it just calls
  `document.querySelector('.panel-preview iframe').contentWindow.print()`. The editor
  shows the **TipTap VisualEditor, not a `.panel-preview iframe`**, so this prints the
  wrong/none element → unstyled. **This is very likely the button being clicked.**
  FIX: make ExportMenu.exportPDF build a `renderPrint(doc,{theme})` document and print
  it in a properly-sized hidden iframe (or `window.open` + print), exactly like a fixed
  PrintBar. Give BOTH a robust print helper (real iframe dimensions, wait for load).

**BUG 2 — divider hides rows in the visual editor.** In the TipTap editor, typing after
a divider: you can't see what you're typing until ~6 Enters. Real visual-editor bug:
the `itDivider` node (see `apps/editor/src/visual/extensions.ts` + `keyword-styles.ts`)
likely has CSS/positioning that overlays following content, or the editor doesn't
scroll the caret into view. Investigate the itDivider node + editor caret/scroll.

## Tomorrow — PDF / print visual polish (started in 4.1.2)

4.1.2 made print share the full element CSS (no longer "primitive") and fixed table
rows being clipped at page breaks. Remaining visual work, needs iteration with the
rendered output open:

- [ ] `.intent-metric` (and any other elements) not yet styled in print — audit the
  full `DOCUMENT_CSS` element list against a real invoice/contract PDF.
- [ ] Page margins & header/footer spacing — make sure body content never collides
  with running header/footer; tune `@page` margins per page size.
- [ ] Enterprise invoice/contract layout polish (totals block alignment, table
  zebra/borders, signature block, spacing) — the "enterprise visuals" deliverable.
- [ ] Consider a dedicated print theme per document class (invoice/contract/letter).
- [ ] `.vsix` built: `packages/vscode/intenttext-1.4.8.vsix` (bundles core 4.1.2) —
  ready to upload to the VSCode Marketplace.

## Still open (next session)

- [ ] **WYSIWYG: make the PDF match the visual editor.** Two render paths (TipTap CSS
  vs core `renderPrint`/`DOCUMENT_CSS`). Align them so the editor view = the PDF. The
  one genuinely-unfinished editor item.
- [ ] **PDF / print visual polish** — `.intent-metric` in print, page-margin/header-
  footer spacing, enterprise invoice/contract layout.
- [ ] **Enterprise-grade visuals showcase** — "same `.it`, three themes" (ties to the
  styling plan: themes as document classes + scoped `style:` block).
- [ ] SPEC §4 **canonicalization** subsection (reproducible sealing/verifying).
- [ ] Public **"how sign/seal works"** doc (tamper-evidence today; notary = paid path).
- [ ] On-save index update in the editor (optimization on lazy self-heal).
- [ ] Cosmetic: version-label sweep across the experimental docs site (still says v2.x).

## Done (this engagement)

- [x] **v4.1 finalization** — one TS parser, tiered format, parity gates, focused
  surface. Published `@intenttext/core` 4.1.0 → 4.1.2 to npm; tags v4.1.0–v4.1.2.
- [x] **Demo 1** — template+merge+sign+query (`pnpm demo:invoice`).
- [x] **Demo 2** — folder query-by-parameter (`pnpm demo:search`).
- [x] **Incremental, self-healing indexing** — CLI `index`/`query`, no init step.
- [x] **Editor: round-trip fidelity** (7/7), **trust sidebar** (now wired + visible),
  **embedded Demo 1** sample, **native PDF** (renderPrint), **table rendering**,
  **metadata hidden**, **native page breaks** (spacer plugin, no hidden content).
- [x] **Template-variable warning fixed (4.1.1)**, **styled PDF + page-break-safe
  tables (4.1.2)**.
- [x] **VSCode**: grammar parity gate; example files fixed + `check:examples` CI guard;
  `.vsix` at `packages/vscode/intenttext-1.4.8.vsix`.
- [x] **Docs refresh** — Python doc corrected, tiers documented, obsolete removed,
  stale package names fixed.

## Done (earlier)

- v4.1.0 finalization: one TS parser, tiered format (core 13 + profiles), parity gates,
  focused supported surface (core/mcp/vscode/editor). See FINALIZATION.md.
- Fixed serializer round-trip (list/step bullets, custom keywords).
- Fixed the editor history view (was always empty) + verified parser history handling.

## Background context

- Product vision & use-cases: see memory `intenttext-product-vision`.
- Supported surface = core, mcp, vscode, editor. Experimental = hub, desktop, docs,
  builder, python.
