# IntentText — Product Roadmap

_Last updated: 2026-06-10. Forward plan. For the completed cleanup, see
[FINALIZATION.md](FINALIZATION.md); for architecture, [ARCHITECTURE.md](ARCHITECTURE.md);
for the format, [packages/core/SPEC.md](packages/core/SPEC.md)._

---

# ▶ RESUME HERE — where we are

_Snapshot: 2026-06-12. `@intenttext/core@4.2.1` live on npm; `main` tagged through
v4.2.1. **Production-ready for enterprise printing** — audited and hardened as the
embedded print/report engine for the Jadwal ERP (which is on 4.2.1 in three packages:
dash, api, desktop-core; client-side printing live via `apps/dash/src/lib/print.ts`)._

## Production-readiness audit (4.2.1, 2026-06-12)

Audited against Jadwal's real templates (A4 invoice, 80mm POS receipt, Arabic) — every
claim below was verified by rendering through core and inspecting the output, and is
locked by regression tests (888 passing, incl. 13 production-print guards in
`packages/core/tests/print-production.test.ts`):

- **Security:** merged data is HTML-escaped everywhere; style-prop values can't break out
  of `style="…"` (stored-XSS fixed); header/footer text is CSS-string-escaped. Safe for
  DB/user-entered data.
- **Editor↔core parity:** `metric:` totals print as label→value rows (Total emphasized)
  exactly like the editor; header/footer built by ONE shared `cssContentValue()`.
- **Page numbers:** `{{page}}`/`{{pages}}` compile to CSS counters in print.
- **Receipts:** `margin:` (singular) honored; narrow pages (≤120mm) default to 4mm. The
  80mm receipt fits the roll.
- **Arabic/RTL:** `meta: | dir: rtl` flows the whole document RTL (tables, totals,
  running footer) — verified visually.
- **Multi-page:** 120-row tables repeat the header per page; rows never split/clip.
- **Merge:** never crashes on missing/odd data; `{ missing: "blank" }` renders unresolved
  `{{fields}}` empty on finished documents (ERP-kit default; `"keep"` for authoring).

## What's achieved (status)

**Core (`@intenttext/core@4.2.1`, on npm):** one canonical TypeScript parser; 37 tiered
keywords; `parseAndMerge` (templates + `each:` loops, `MergeOptions`); `renderHTML` /
`renderPrint` (shared `DOCUMENT_CSS`, `@page` layout, running header/footer with page
counters); tamper-evidence trust (`sealDocument`/`verifyDocument`, SHA-256,
canonicalization spec'd in SPEC §4.1 and verified reproducible); folder indexing/query.
**4.2.x:** inline **styled spans** `[text]{ color: …; weight: … }` for partial-line
styling, rendered identically by every consumer; `underline`/`strike`/`valign` style
keys; the production-print hardening above.

**Editor (apps/editor):** visual (TipTap) + source (Monaco), faithful round-trip (7/7).
**WYSIWYG PDF** (prints the editor's own DOM → PDF == on-screen). Native page breaks (no
hidden content), table rendering, hidden metadata chips, **styled trust chips** + invoice
-grade **metric/totals**, **Trust** toolbar (sign/seal/verify/history). Inline styling is
faithful end-to-end (per-run marks/spans, unified on core's style keys, fidelity guard).

**Demos / integration:** `pnpm demo:invoice` (template→merge→sign→query),
`pnpm demo:search` (folder query), `pnpm demo:themes` (one `.it`, three themes),
`pnpm demo:erp` (the **ERP/app integration kit** — store `.it` as text, merge, print;
see `ecosystem/erp-integration` docs). Examples + demos guarded by `pnpm check:examples`.

**Docs:** SPEC (incl. §4.1 canonicalization), `reference/style-properties` (incl. spans),
`guide/trust-and-signing` (what sealing does/doesn't prove), `ecosystem/erp-integration`
(now incl. 80mm receipts, missing-data, totals, Arabic), CHANGELOG through 4.2.1.

## Possible next stages (pick up here)

Nothing is mid-flight — these are fresh, independent options, roughly by leverage:

1. **Jadwal server-side real PDFs** — Jadwal's backend `HtmlPdfProvider`
   (`packages/infrastructure/src/pdf/html.pdf-provider.ts`) returns HTML as a Buffer,
   not real PDF bytes; its API resolvers still use legacy HTML string templates
   (`renderPdfTemplate`). Next: feed it IntentText output and add a headless-Chrome step
   (see the puppeteer recipe in `ecosystem/erp-integration`) for emailing/archiving
   invoices. This work lives in the Jadwal repo, not here.
2. **Scoped `style:` block** ("Styling & visual fidelity" below) — a designated theme/
   style region so a document can carry house styling without per-line props. The natural
   next step after inline spans.
3. ~~**ERP kit as a package**~~ ✅ partly done (2026-06-12): **`@intenttext/pdf`**
   ships the server-side half — `issuePDF`/`issueDocument` (merge → seal → PDF),
   `renderPDF`/`htmlToPDF`, `createPdfRenderer` for batch; puppeteer or
   puppeteer-core + system Chrome, both optional peers. The browser-print helper
   remains copy-paste (`demo/erp-integration/intenttext-print.mjs`; Jadwal embedded
   its own in `apps/dash/src/lib/print.ts`). A statement/report template type would
   still round out the kit.
4. **VSCode `.vsix` refresh** — rebuild/republish the extension against core 4.2.1 if
   distributing a new build (the extension esbuild-bundles core).
5. **Editor folder-workspace + on-save indexing**; **managed trust tiers** (RFC-3161 /
   PKI over the same canonical hash) — unchanged, not ERP-blocking.

**Editor dev note:** the editor bundles core at build time — after any core change,
**restart `pnpm --filter intenttext-editor dev`** (vite won't re-bundle a workspace dep on
dist change). Several "it didn't work" moments were stale dev servers. Verify the editor by
screenshotting the *running* editor (headless Chrome + CDP), not by theorizing. New TipTap
atom nodes must be added to BOTH the import list AND the `extensions: [...]` array in
`VisualEditor.tsx`.

## History — the 5 roadmap points + 4.2.0 styling work (all ✅ done 2026-06-10)

1. ~~**WYSIWYG — make the PDF match the visual editor.**~~ ✅ **DONE** (2026-06-10).
   Instead of reconciling two stylesheets, the PDF/HTML export now **prints the editor's
   own rendered DOM with its own stylesheets** (`apps/editor/src/panels/PrintBar.tsx`
   `buildWysiwygPrint`): it clones `.docs-page .tiptap`, strips the page-break spacers,
   copies every `<style>`/`<link>` from the document, and adds `@page` (size/margins +
   running header/footer from the doc's `page:`/`header:`/`footer:` blocks) plus print
   overrides that strip on-screen chrome (sheet shadow, grey canvas). Falls back to core
   `renderPrint` in source mode. Verified: editor view and the generated PDF are pixel-
   faithful (headless Chrome + CDP). **Also fixed in passing:** sign/seal/approve/freeze/
   amendment blocks were leaking raw `| at: …` props in the visual editor (and therefore
   the PDF). Added an `ITTrust` atom node (`visual/extensions.ts`) + bridge handling that
   renders them as styled trust chips and preserves the exact source line verbatim for
   hash-safe round-trip.

2. ~~**PDF / print visual polish.**~~ ✅ **DONE** (2026-06-10). `metric:` totals were
   the real gap **in the editor** — they fell through the generic renderer, which
   dropped the `value:` prop (totals showed labels with no amounts). Added an `itMetric`
   node (`visual/extensions.ts`) rendering a label-left / value-right row, with a
   grand-total emphasis when the label reads "Total/Balance/Amount Due". `@page`
   header/footer in `buildWysiwygPrint` now also reads the `page:` block's `header:`/
   `footer:` properties (not just standalone blocks), so the running footer renders;
   20mm bottom margin keeps the body clear of it. Verified: enterprise-grade invoice PDF
   with styled totals, signature/freeze chips, and a running footer. (Core's
   `renderHTML`/`renderPrint` already style `.it-metric` as KPI cards in `DOCUMENT_CSS`
   — the earlier "unstyled in print" note was inaccurate; no core change needed.)

3. ~~**Enterprise-visuals showcase.**~~ ✅ **DONE** (2026-06-10). New `demo/enterprise-
   themes/` (`pnpm demo:themes`): one Master Services Agreement (`contract.it`) rendered
   in three themes — corporate / legal / editorial — side by side in isolated iframes
   (`showcase.mjs` → `out.themes.html`). Proves the same `.it` re-themes with zero
   content edits and renders enterprise-credible. The `check:examples` guard now also
   scans `demo/`, so showcase docs stay clean (22 `.it` files, all pass). Existing
   themes were sufficient — no new theme files needed. (The scoped `style:` block idea
   under "Styling & visual fidelity" remains a future option, not required here.)

4. ~~**Two trust docs.**~~ ✅ **DONE** (2026-06-10). (a) Added SPEC **§4.1
   Canonicalization** — the exact 4-step algorithm (cut at `history:` → drop
   sign/freeze/amendment → join with LF + trim → SHA-256), with UTF-8/LF determinism
   notes; **verified byte-accurate** by an independent reimplementation that reproduces
   the core hash. (b) Extended the public `guide/trust-and-signing.md` with "What exactly
   gets hashed" (reproducible-by-anyone) and "What sealing does — and doesn't — prove"
   (tamper-evidence vs PKI/non-repudiation, honest ❌s, and the trust-tier ladder:
   tamper-evidence free today → trusted timestamp / identity binding as managed paid
   tiers attesting the same canonical hash).

5. ~~**Minor cleanups.**~~ ✅ **DONE** (2026-06-10). (b) Version-label sweep: fixed the
   current-version labels that were stale — docs hero badge `v3.1` → `v4.1`,
   `reference/keywords/content.md` example "v2.14 format" → "v4.1", and the editor status
   bar `v3.1.0` → `v4.1`. (Historical `**Since:** v2.x` provenance markers on individual
   keywords are accurate and intentionally left as-is — bumping them would falsify when a
   keyword was introduced; likewise example-document versions like a contract's own
   "v2.1".) (a) On-save index update: **not applicable** — the web editor is single-file
   (`useFile.saveFile` writes one file via the File System Access API; `useWorkspace` has
   no folder handle, no file list, no `.it-index`). There is no folder-backed workspace to
   index, so there's nothing to optimize here. On-save/lazy indexing is correctly a
   CLI/desktop concern (core's `updateIndex`/`checkStaleness` self-heal on query). If a
   folder workspace is ever added to the editor, revisit then.

6. ~~**Inline styling + ERP integration**~~ ✅ **DONE** (2026-06-10, core **4.2.0**).
   Triggered by embedding `.it` in a host ERP (Jadwal). (a) Added the inline **styled
   span** `[text]{ color: …; weight: … }` to core (parser + renderer + `styled` node),
   `;`-separated, same keys as block props, plus `underline`/`strike`/`valign`. (b) Fixed
   the editor: it flattened partial styling to whole-line props and used non-core keys
   (`style`/`font`/`bgcolor` ≠ core's `italic`/`family`/`bg`) so whole-line styling never
   printed via core — now per-run marks/spans, built back from core's inline AST, unified
   on core's keys, with a fidelity guard. (c) Shipped the **ERP kit** (`demo/erp-
   integration/`, `pnpm demo:erp`) + the `ecosystem/erp-integration` guide. Published
   `@intenttext/core@4.2.0`, tag v4.2.0. Full notes in `CHANGELOG.md` and memory
   `intenttext-inline-styling-model`.

**Testing the editor headlessly** (how I've been verifying): start dev, then
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu
--screenshot=/tmp/x.png --window-size=1440,1000 "http://localhost:5173/"`. For PDF:
`--print-to-pdf=/tmp/x.pdf --no-pdf-header-footer`. The `?source=<urlencoded .it>` param
loads a doc (but autosave/localStorage can take precedence — use a fresh `--user-data-dir`).

---

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

_(Resolved editor bugs from earlier sessions — PDF-prints-unstyled, divider-hides-
rows, mask/shift pagination — are all FIXED and listed under "Done" below. The live
open work is the **5 open points** at the top.)_

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
