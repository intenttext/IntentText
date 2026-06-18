# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Changed — SEAL_SPEC v3: sign content, not styling; cover the whole trust record (`@dotit/core` 1.21.0, `@dotit/editor` 1.15.0)

The trust ruleset advances to **`SEAL_SPEC = 3`** — the seal now covers exactly the right
things, and signatures are tamper-evident for **who** signed (not just what). Old seals keep
verifying under their recorded spec forever.

- **Styling is excluded.** Presentation lines (`page:`/`font:`/`style:`) and presentation
  properties (`align`, `color`, `size`, `bg`, `margin`, …) no longer affect the hash —
  restyling a sealed document never breaks it ("sign content, not presentation"). Comments
  (`//`) remain excluded.
- **The seal covers its own metadata.** Editing a `freeze:` line's `at:`/`status:` (back-dating,
  re-statusing) now breaks the seal — only its self-referential `hash:` is exempt.
- **Signatures bind the signer identity.** A `sign:` hash now covers content **+ signer
  name/role/date**, so editing the signer on a signed (not yet sealed) document breaks *that*
  signature. New `computeSignatureHash` / `signatureIdentity` / `signatureMatchesContent`.
- **Per-signer verification.** `verifyDocument()` reports each signer's
  `signedCurrentVersion` and exposes `spec` + `specOutdated`; the editor banner shows
  "Signed · N/M" — a signer who signed an earlier version is shown as such, not a blanket
  "broken" (multi-sign / sign → edit → sign now reads correctly).
- New trust tiers: **`sealed`** (indigo, distinct from a bare signature) and **`broken`** (red).
- **Editor:** prose now serializes **bare** (no spurious `text:` keyword; blank-separated,
  empty paragraphs dropped); a fresh document stays clean.

### Fixed — print/PDF/views can never show a tampered document as certified (`@dotit/core` 1.20.2)

The trust band now has an **integrity gate**: before drawing the certification stamp it
verifies the document. A sealed/signed doc whose content no longer matches its hash renders
a loud **RED "SEAL BROKEN" / "SIGNATURE BROKEN"** stamp instead of the clean seal — on
**every** surface (screen, print, PDF, `renderHTML`), since they all build on `renderTrustBand`.
Previously a modified document printed a valid-looking seal (a forgery). New `broken` trust
tier (red). Verified by conformance cases (tampered content, tampered signature line).

### Fixed — merge resolves multi-line prose paragraphs (`@dotit/core` 1.20.2)

`mergeData` now resolves `{{vars}}` in the byte-faithful record of merged paragraphs
(`_merged`), not just `content`/metadata/`_liftedLines`. A template with consecutive `text:`
lines now serializes back fully merged — so the result is no longer `isTemplate()` and **can
be sealed** (before, the tokens survived in `documentToSource` output and blocked sealing).

### Changed — seal-break hardening: the seal covers signatures (`@dotit/core` 1.20.0)

`SEAL_SPEC` is now **2**, introducing a **two-scope hash** so a seal breaks on exactly
the right changes — once and for all:

- **The seal hash covers content *and* signatures.** Tampering the document body OR any
  `sign:` line (a signer's name, role, or stored hash) now breaks the seal. Previously a
  signature change left the seal intact.
- **Each signature hash covers content only**, so multiple parties still co-sign the same
  body (signatures don't perturb each other's hashes).
- **Comments (`//`) never affect any hash** — editing/adding/removing an annotation is
  trust-neutral. And freeze metadata other than the hash (e.g. `status:`) is inert.
- Versioned and backward-compatible: v0/v1 seals verify under their original (content-only)
  rules forever; only **new** seals use v2. A broken (tampered) seal no longer vouches for
  any signer (`signers[].valid` is conservative). New conformance cases pin all of this.

### Changed — unified trust band: one certification stamp, every page (`@dotit/core` 1.20.0)

`sign:`/`freeze:` no longer render as inline body blocks. The signer + seal now appear in a
single **trust band** — a quiet, presentation-grade stamp pinned to the **bottom-right**
corner, out of content flow, repeating on every printed page.

- Bigger, visible hash seal (the Linear-Wave ambient seal) with the signed/sealed caption
  beside it; subtle card, light opacity.
- `TRUST_BAND_CSS` + `trustBandPositionCss()` exported from core as the **single source of
  truth** — `renderHTML`, `renderPrint`, the editor page view, and the WYSIWYG print path
  all share one visual, so it can never drift. `renderHTML` now shows the band for a trusted
  doc (opt out with `seal: false`).

### Added — versioned seals: the forever-stable trust guarantee (`@dotit/core` 1.17.0)

Every seal/signature/certification now records the **canonicalization spec version**
(`spec: 1`) that produced its hash, and verification applies **exactly that version
forever** — so a future change to the byte rules can never silently break a historical
seal. This is the critical property for long-term (30–100yr) records, to be in place
*before* production documents accumulate.

- **`SEAL_SPEC`** (currently `1`) + a frozen, versioned canonicalizer registry. v1 = NFC;
  v0 = legacy (pre-NFC). Each version is immutable once shipped.
- `freeze:` / `sign:` / `certify:` lines stamp `| spec: 1`. `computeDocumentHash(source,
  spec?)` and `hashMatches(source, expected, spec?)` are version-aware.
- `verifyDocument` (and `@dotit/sign` `verifyCryptoSignatures` / `verifyCertifications`)
  verify against the **recorded** spec; a pre-versioning seal (no `spec:`) falls back to
  trying all known versions — fully backward-compatible, retiring the ad-hoc legacy
  try-both into the registry.
- The **audit chain** (`prev:` links) is versioned the same way; `verifyAuditChain` accepts
  a link valid under any known spec.
- **Conformance pin:** `tests/seal-versioning.test.ts` freezes the v1 golden hash (a change
  to v1 fails the test on purpose — add a v2, never mutate v1) and is part of the CI
  byte/trust release-blocker gate.

### Changed — byte preservation hardened + faithful-recorder parser (`@dotit/core` 1.16.0)

The trust moat made real: a parsed document now round-trips **byte-for-byte** for the
whole authored surface, proven by a property-based gate over thousands of random docs.

- **Property order is preserved.** The serializer no longer reorders a line's properties
  to a canonical/alphabetical schema — `metric: x | value: 1 | unit: kg` round-trips as
  written. Author order is sacred, so a sealed `.it` with any typed block keeps its hash
  through a parse → serialize cycle (and through `reconcileEdit`).
- **`toc:` serializes pipe-first** (`toc: | depth: 2 | title: Contents`) so its first
  property is not swallowed as content on re-parse (was non-idempotent).
- **Faithful-recorder parser.** The parser now records ONLY what the author wrote — it no
  longer injects block-type defaults (`step:`/`call:` `status: pending`, `done:`
  `status: done`, `wait:`/`result:`/`gate:` statuses, `parallel:` `join`, `signal:`
  `level`, bare `toc:` `depth`/`title`) into the model, and no longer rewrites a
  deprecated image `at:` to `src:`. Defaults are applied at **read time**.
- **New exports:** `effectiveProperties(block)`, `effectiveField(block, field)`,
  `defaultFor(type, field)` — a block's interpreted values (authored + type defaults),
  used internally by the renderer, query, and index so their behavior is unchanged.
- **Property-based byte-preservation gate** (`tests/byte-preservation.test.ts`) — generates
  thousands of documents (arbitrary property order, bare and explicit injected-default
  keywords, sealed docs, surgical edits) and asserts `documentToSource(parse(x)) === x`,
  `reconcileEdit` no-op identity, and seal-survives-save for every one. The release gate
  for the moat.

> **BREAKING (read-path):** `block.properties` no longer contains parser-injected defaults.
> Code that read e.g. `step.properties.status` expecting `"pending"` should call
> `effectiveField(step, "status")` (or `effectiveProperties(step)`). Rendering, query
> (`status=done` still matches `done:` blocks), and CLI behavior are unchanged.

### Added — VS Code extension 1.6.0

- Completion, hover docs, and snippets for the in-file approval workflow (`route:` /
  `require:`), plus `math:` and inline `redact:` spans.

### Added — accessible PDF + change-aware editor

- **Tagged (accessible) PDF (`@dotit/pdf` 1.2.0).** `renderPDF` now emits a TAGGED
  PDF (`/MarkInfo Marked true` + a `/StructTreeRoot`), with the structure tree
  derived from the semantic HTML (headings, lists, tables with `<th scope>`,
  lang/dir, alt text) — the basis for PDF/UA / Section 508. Override via `opts.pdf`.
- **Change-aware editor (`@dotit/editor` 1.11.0).** A clean, ambient indicator:
  invisible with no changes; a subtle dot + edit count + undo/redo when there are;
  and a **Review changes** panel (a real redline of exactly what changed, via core's
  `compareVersions` + `<Redline>`) on demand — so a signer knows precisely what
  they're about to save or seal. Builds on the byte-faithful save.

### Added — source-preserving edits + accessibility (`@dotit/core` 1.15.0)

- **`reconcileEdit(original, edited)`** — the foundation of byte-faithful editing.
  It keeps each unchanged block's EXACT original bytes (matched by a deep
  type+content+properties+children signature, re-emitted verbatim via the lossless
  serializer) and only re-serializes genuinely changed/new blocks. So a no-op edit
  round-trips byte-for-byte (a sealed body keeps its hash) and a real edit touches
  only the edited block — comments, blank lines, spacing, and bare prose survive.
  The visual editor (`@dotit/editor` ≥ 1.10.0) calls it on every keystroke.
- **Accessibility:** rendered table column headers now emit `<th scope="col">`
  (WCAG 2.1 H63 / Section 508 / EN 301 549).

### Added — in-file approval routing, DERIVED (`@dotit/core` 1.14.0)

- **The document carries its own approval workflow; its state is derived, never
  stored.** A document declares its route with `route: sequential` (or `parallel`)
  + `require:` lines (e.g. `require: finance | when: amount > 100000`), and fulfills
  it with ordinary `approve:` lines. `workflowState(source)` then **derives**
  `{ pending, next, complete, active, fulfilled }` purely from the file — so the
  `.it` document is the single source of truth and can never drift from a separate
  database. Conditional (`when:`) requirements evaluate against the document's own
  metric:/meta values on the safe no-`eval` evaluator; `optional:` requirements
  never block completion. `route:`/`require:` are preserved verbatim (custom
  blocks), so a routed document round-trips byte-for-byte and keeps its seal.
  Example: `examples/routed-approval.it`.
- **Hash-chained audit trail.** `appendApproval(source, …)` chains each approval to
  the previous audit event via `prev: sha256:…` (anchored to the content), so the
  approval SEQUENCE is tamper-evident — `verifyAuditChain(source)` detects any
  inserted, deleted, reordered, or edited approval (closing the gap that the
  history/approval log itself was not chained). Additive and safe: it does not
  touch signDocument/sealDocument; a plain `approve:` line is just an un-chained
  link, never reported as tampered. A chained, then sealed document both verifies
  and keeps a valid chain.

### Changed — bare prose, `text:` now optional (`@dotit/core` 1.14.0)

- **`text:` is optional — write natural prose.** A line with no keyword is an
  implicit text paragraph (it already parsed that way; now it also **round-trips
  bare**). `documentToSource` re-emits bare prose without re-adding `text:`, so a
  hand-written document stays byte-for-byte identical and **keeps its seal** (a
  re-save can no longer silently break trust). Explicit `text:` is preserved when
  written; content that could be misread as another construct (a keyword, list,
  fence, divider, comment, or pipe row) keeps the `text:` prefix automatically.
  Blank line = new paragraph; consecutive lines = one paragraph (the universal
  plain-text convention).
- **Byte-fidelity gate.** Locks the trust moat on the exchange path: sealed
  documents round-trip byte-for-byte through the storage record and stay verified;
  a storage layer that mutates even one byte is caught loudly (never silent).

### Added — PDF/Word parity wave (2026-06-16)

Published: `@dotit/core` **1.13.0**, `@dotit/editor` **1.8.0**, `@dotit/pdf` **1.1.0**,
`@dotit/pades` **1.0.0**, `@dotit/math` **0.1.0**. Closes PDF/Word gaps 1–7.

- **Async co-authoring (`@dotit/core` 1.13.0).** `mergeThreeWay(base, mine, theirs)`
  merges two independent edits into one redline — non-overlapping edits apply,
  matching edits apply once, divergent edits become a conflict offering both variants
  (closes gap 5, Tier 1; realtime/Yjs is a later Tier 2). Plus enterprise-hardening
  wave 2: the new feature surface is fuzzed (never throws), a perf budget, and a
  serialization-fixpoint property.

- **Forms V2 (`@dotit/core`).** `meta: type: form` documents gained: the **attachment**
  field + an `attach:` container block (embed base64 ≤1 MiB, or `href:` reference — the
  seal covers attachments); **two-party trust** (`sealFormStructure`/`verifyFormStructure`
  — the author seals the blank form's STRUCTURE, a hash that ignores answers so it
  survives filling; the filler seals the completed record); **conditional** (`show-if:`)
  and **computed** (`compute:`) fields on a safe no-`eval` evaluator. `isFormComplete`
  skips hidden/computed fields and requires real bytes for attachment fields.
- **Redline & version compare (`@dotit/core` + `@dotit/editor`).** Word-style tracked
  changes + comments (`acceptChanges`/`rejectChanges`/`<Redline>`); `compareVersions(a,b)`
  diffs two versions into a tracked-changes `.it` (line + inline word LCS). A "Compare
  versions" action in the web + desktop editors.
- **Redaction (`@dotit/core`).** `[text]{redact: reason}` → `applyRedactions()` removes the
  bytes and leaves a black-bar marker with a salted commitment; `verifyRedaction()` proves
  coverage from a private receipt. Seal as usual → tamper-evident.
- **PDF/A archival (`@dotit/pdf` 1.1.0).** `toPdfA()` / `pdfA` render option adds the PDF/A
  identification XMP + sRGB OutputIntent + document ID; compliance validated in CI with
  **veraPDF** (`.github/workflows/pdfa-verify.yml`).
- **PAdES signatures (`@dotit/pades` 1.0.0, first release).** Export a sealed `.it` as an
  Adobe/court-recognized PDF signature (ECDSA P-256 + X.509 + CMS); CSR/CA issuance,
  RFC-3161 timestamps (PAdES-T), CLI. Wired into `@dotit/pdf renderSignedPDF` + the desktop
  "Export Signed PDF". The **UTS X.509 CA** (`services/uts-certify`) issues leaf signing
  certs from a CSR (`POST /certify/x509`, KYC-gated, customer keeps the key).
- **Math (`@dotit/math` 0.1.0, first release).** Dependency-free lite LaTeX→MathML +
  optional KaTeX; core marks `math:` / `[tex]{math}` placeholders. **Complex tables**:
  merged cells (`<` colspan, `^` rowspan).
- **Editor embedding (`@dotit/editor` 1.8.0).** `<IntentTextWorkbench mode="edit|fill|view|review|auto">`
  — one component, every mode — plus intent-named exports (`TemplateEditor`, `FormDesigner`,
  `FormFiller`, `DocViewer`), the attachment fill UI, and `EMBEDDING.md` + a runnable
  Jadwal example.
- **Hub submit (`@dotit/core` + `apps/hub`).** `submitForm(source, {endpoint})` client +
  the `/api/responses` receiver that verifies both seals before accepting.
- **Ambient Seal redesigned to a guilloché rosette (`@dotit/core`).** The notary stamp is
  now banknote-style security engraving (hash-derived hypotrochoid), replacing the dot
  bloom — still deterministic and tamper-evident.
- **Jadwal merge fix (`@dotit/core` 1.10.1).** `parseAndMerge` now resolves `{{…}}` inside
  `meta:` property-bag values, so a merged invoice with `meta: | date: {{…}}` is sealable.

### Security

- **Content-Security-Policy on the web trust surfaces (verify + editor).** Added a strict
  CSP via `vercel.json` to `verify.uts.qa` (the public surface that renders untrusted `.it`)
  and `editor.uts.qa`: `script-src 'self'`, `object-src`/`frame-src` locked down,
  `base-uri 'self'`, `connect-src` limited to self + the UTS pubkey host (editor also
  allows the Google Fonts hosts it uses). Each was **verified in a real browser**
  (headless Chrome): the app mounts, no CSP violations, and the verify portal's sandboxed
  `srcdoc` preview still renders. (docs/hub use framework inline scripts and need a
  nonce-based CSP — tracked separately.)

- **Governance & supply-chain — Wave 5/6 of the hardening plan.**
  - **SBOM** (CycloneDX, via Syft) is now generated and attached to every npm release.
  - **`PRIVACY.md`** documents the privacy-by-design posture accurately (client-side
    verification, hash-only to the UTS service, zero telemetry, self-hostable).
  - **Web security headers** added to all deployed web apps (docs/editor/verify/hub) via
    `vercel.json`: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy,
    Permissions-Policy. (A tuned CSP per app is a tracked follow-up.)
  - Internal operations + incident-response runbooks added (private) covering key
    rotation, backup/DR, and the key-compromise → revoke → rotate playbook.

- **UTS certificate service hardening — Wave 3 (`uts-certify` 0.2.0).** Brought the
  certification authority closer to production-ready:
  - **Certificate revocation** — a new revocation list (by certified content hash, or
    by an entire compromised signing key), an admin `POST /admin/revoke` endpoint, a
    public `GET /revocations` feed, and `/verify` now marks revoked certifications
    `valid:false`. Certifications also record the issuing key so a key's whole output
    can be revoked at once.
  - **Rate limiting** on `/certify` (per key), `/verify` + `/revocations` + pubkey (per
    IP), and `/admin/*` (per token), with `429` + `Retry-After`.
  - **Admin input validation** — legal-entity / CR fields are length-capped and
    charset-restricted (no control chars, no `|` field-separator smuggling).
  - **Append-only audit log** of every privileged action (account create, KYC verify,
    key mint/revoke, ICA provisioning, certification, revocation) with actor + IP.
  - **Security headers** on every response; **HTTPS enforced** in production (behind a
    trusted proxy); **boot-time guards** warn on weak admin token / plaintext key in
    env / disabled HTTPS. +10 tests incl. a full revocation E2E.

- **Embed XSS closed + watermark CSS injection closed (`@dotit/core` 1.9.0).** When a
  document is rendered, `embed: | type: svg` content is now sanitized (script /
  foreignObject / SMIL-animation / `on*` handlers / `javascript:` & `data:text/html`
  refs / `expression()` styles are stripped — the vector graphic still renders), and
  `type: mermaid` content is HTML-escaped (Mermaid reads `textContent`, so this is
  safe and correct). Previously both injected their raw `content` into the page —
  arbitrary script execution when rendering an untrusted `.it` in any surface
  (verify portal, editor preview, desktop). The page watermark's `angle`/`size`/
  `color` values are now stripped of CSS metacharacters so a stray `;` can't inject
  extra declarations (e.g. an exfiltrating `background:url(...)`).

- **Signature/certificate input hardening (`@dotit/sign` 1.4.1).** `fromB64url` now
  validates its input (throws on non-base64url instead of producing garbage bytes);
  Ed25519 keys are length-checked (exactly 32 bytes) before use in both signature and
  intermediate-certificate verification; the "already-signed" check now parses the
  `key:` field instead of a substring match (so the public key merely appearing in the
  body no longer blocks signing). Crypto verification accepts both the NFC and legacy
  content hash, so signatures made before normalization still verify.

### Changed

- **Document hashes are Unicode-normalized to NFC before hashing (`@dotit/core` 1.9.0).**
  Two byte-different but visually identical documents (precomposed "é" vs decomposed
  "e"+combining-acute) now produce the **same** content hash — so re-saving a sealed
  contract in another editor can't silently invalidate the seal. Backward compatible:
  documents sealed under the previous rule still verify (new `hashMatches` /
  `computeDocumentHashLegacy` exports accept either form). `computeDocumentHash` now
  always emits the NFC hash.

### Changed

- **Ambient Seal redesigned — the "borderless bloom" (`@dotit/core` 1.8.0).** The seal's
  hash-derived crown is now an organic, BORDERLESS dot constellation (a particle swirl
  whose density/radii/sizes all come from the hash) instead of the radial-tick ring +
  circle border (a round bordered stamp read as a generic rubber stamp). The centre is
  now the **Gelasio serif `.it`** (matching the new logo), embedded as a vector path so
  core needs no font at runtime. Refined tier colours (signed #2f6fed, certified #0e9f6e,
  root-certified #c58a1a + ★). Template tier renders a faint dashed ring (no bloom) — a
  blueprint, not a record. `renderSeal` API unchanged; all surfaces (editor/desktop/
  verify/docs) get the new look automatically.


### Fixed / Added

- **Desktop 2.11.5 — page separation reliably renders, native print not clipped, no double window.**
  - **Page separation** now appears on open (not only after opening/closing the print
    dialog). In read-only view there are no edit transactions, so a premature first
    pagination measurement never self-corrected; a `ResizeObserver` (`@dotit/editor` 1.4.4)
    now recomputes whenever the content/canvas actually settles — the same relayout the
    print dialog was forcing by hand.
  - **Native print no longer clipped to the app viewport.** The shell sets
    `html,body{height:100%;overflow:hidden}`, which clipped the tall print document to one
    screen; print now resets height/overflow (and forces a reflow) so NSPrintOperation
    paginates the whole document, not the app viewport.
  - **No more double window on cold-start file-open.** Double-clicking a `.it` with the app
    closed opened an empty main window *plus* a doc window. The cold-start file is now
    routed into the main window (warm multi-window open is unchanged).

- **Desktop 2.11.4 — the real fixes for page separation + native print (root-caused).**
  - **Stale-dist trap fixed (this was the actual bug).** The desktop bundles `@dotit/editor`
    from its built `dist/`, but the desktop build never rebuilt it — so pulling source fixes
    and rebuilding kept shipping the OLD editor. `build`/`dev` now run a `build:deps` step
    that rebuilds `@dotit/core`, `@dotit/sign`, and `@dotit/editor` first. This is why the
    page-separation/pagination fixes weren't appearing in earlier rebuilds.
  - **Page separation now visible** (verified in a real browser): the page gap was painted
    `#f9fbfd` (≈ the white page) so breaks were invisible; it's now a clear grey desk
    (`#e4e6eb`) — white sheets, grey gaps, like a PDF — in both view and edit.
  - **Native print restored.** Print again uses the in-app macOS print panel
    (NSPrintOperation) on the isolated document (renderPrint `@page` output), so it prints
    the paginated DOCUMENT — not the app, not via a browser. Browser print is now only an
    automatic fallback if the native path is unavailable.

- **Desktop 2.11.1 — print + view-mode pagination fixes.**
  - **Print now reliably prints the document, not the app.** The native WKWebView print
    path (NSPrintOperation) could capture the app chrome; print now renders the document
    as a standalone page and opens it in the system browser, which auto-opens the print /
    Save-as-PDF dialog. Always prints the document, with correct page breaks.
  - **View (read-only) mode now separates into pages** like edit mode. Both modes share
    the same engine, but read-only fires no edit transactions — so if the first
    pagination pass measured before fonts/layout settled, it never self-corrected. The
    editor (`@dotit/editor` 1.4.2) now re-nudges pagination after mount and once fonts are
    ready (a no-op when already stable), so the read view paginates correctly.

- **Desktop 2.11.0 — real cryptographic signing with a keychain-backed identity.**
  Signing now produces a *verifiable* Ed25519 signature instead of a plaintext record:
  - First time you sign, the app creates your **signing identity** (an Ed25519 keypair).
    The **private key is stored in the OS keychain** (macOS Keychain / Windows Credential
    Manager) via the Rust `keyring` crate — never in a file or inside a document.
  - "Sign" then emits a real `sign: … | key: ed25519:… | sig: …` line, so the trust
    badge goes **Signed ✓** and the seal turns blue; editing afterwards invalidates it
    (honest tamper-evidence). Subsequent signs reuse the same identity.
  - New Rust commands `identity_get/set/clear` + `src/lib/identity.ts`. Outside the Tauri
    shell (plain `vite dev`) it falls back to the legacy on-record line.
  - Follow-ups: a "manage signing identity" screen (view/copy public key, reset) and a
    keychain entitlement once the app is code-signed.

- **Desktop 2.10.1 — fixes for print, sign, and page thumbnails.**
  - **Print** now prints the *document*, not the app. The native macOS print path
    (NSPrintOperation on the WKWebView) doesn't reliably switch to print media, so the
    old `@media print`-only isolation left the app chrome visible. The document is now
    isolated at the screen level for the duration of the print panel.
  - **Sign** is no longer invisible. A plain `sign:` line is a *recorded signature of
    intent* (not cryptographic), but the badge only counted cryptographic signatures, so
    signing appeared to do nothing. The badge now shows "Signed ✍ N" with a verdict that
    explains it's an on-record signature and points to Seal for tamper-evidence.
  - **Page thumbnails removed.** The rail couldn't stay faithful to the page (stale on
    file-switch; view mode isn't paginated; live edits are hard to track) — and it's not
    a feature comparable apps offer. Removed rather than ship something misleading.

- **Desktop 2.10.0 — security hardening (Wave 1 of the hardening plan).**
  - **Content-Security-Policy enabled** (was `null`): `script-src 'self'`, `object-src`/
    `frame-src 'none'`, `base-uri 'self'`, with `connect-src` limited to self + the UTS
    pubkey host — defense-in-depth against any injected markup executing in the webview.
  - **File commands are path-guarded**: `read/write/list/rename/delete/metadata` reject
    empty paths, NUL bytes, and `..` traversal components; reads are capped at 64 MB so a
    hostile/huge file can't exhaust memory on open.
  - **`open_external` locked down**: canonicalizes the path, requires a real regular file,
    and only opens print/export artifact types (`.html`/`.htm`/`.pdf`) — never arbitrary
    executables.
  - **No more lock-poison panics**: the window/pending-open mutexes recover instead of
    crashing the app.
  - First Rust unit tests (path-guard + open-external allowlist).

- **Desktop 2.9.0 — reader/editor depth + a 1:1 page rail.** A batch of shell and
  editor work that brings the app closer to "Acrobat Reader + word processor at once":
  - **Preferences** dialog (Cmd+,) with a light/dark theme toggle (`data-theme` on the
    document root, persisted), default page size, autosave, and default folder.
  - **About** and a **keyboard-shortcuts** cheat sheet (Cmd+/).
  - **Drag-and-drop** to open `.it`/`.docx` files onto the window.
  - **Open Recent** submenu under File.
  - **Find & Replace** — the find bar now also replaces (Replace / Replace All operate
    on the document source, case-insensitive, not the DOM).
  - **Page thumbnails are now a true mirror of the page** — each thumbnail copies the
    live resolved content margins and text **direction** onto its clone, so RTL (Arabic)
    and LTR documents render in the rail exactly as they do on the page (content no
    longer recentres or loses its right-to-left flow).
  - Settings on disk now **merge** top-level keys (vaults + UI prefs coexist in
    `settings.json`) instead of being overwritten.

- **Desktop 2.2.0 — true native macOS print panel.** `Cmd+P` / Print now opens the
  real macOS print dialog via AppKit's `NSPrintOperation` (driven through the
  `WKWebView` handle with `objc2` — `printOperationWithPrintInfo:`), not the browser
  and not WKWebView's unreliable JS `window.print()`. The document is isolated into
  the webview DOM (an `@media print` sheet) so only the document prints. If native
  print is unavailable/fails, it automatically falls back to the browser print path,
  so print always works. macOS-only (Windows/Linux keep the browser path).

- **Desktop 2.1.0 — native print & export (Tauri).** The browser-based exports
  didn't work inside Tauri's WKWebView; replaced with native paths:
  - **Print / Save as PDF** (Cmd/Ctrl+P and a banner button) now opens the OS print
    panel via `window.print()` on a print-styled container — works in view AND edit
    mode (the old hidden-iframe path WKWebView ignored).
  - **Export HTML** and **Export/Import Word (.docx)** via native save/open dialogs
    (new Rust `write_binary_file`/`read_binary_file` commands for the docx bytes;
    docx uses core's `convertIntentTextToDocx`/`convertDocxToIntentText`).
  - Export actions moved into the **banner**, visible in both view and edit mode
    (not template-gated — only trust actions are).
  - **Comments no longer show in view mode** (`@dotit/editor` 1.4.1: read-only hides
    `it-doc-comment` nodes; still editable in edit mode, never removed from source).
  - App **version shown in the status bar**.

- **Templates are formally OUTSIDE the trust workflow (`@dotit/core` 1.7.0,
  `@dotit/sign` 1.4.0).** A template is a blueprint, not a record — signing one is
  broken (the hash covers placeholder text, and the later merge changes the content,
  invalidating any signature). New `isTemplate(source)` (exported) returns true for
  `meta: type: template`, an `input:` block, or unresolved `{{ }}` merge variables —
  but NOT for empty values (a final document may legitimately leave a field blank and
  stays trustable). `sealDocument` / `signDocumentCrypto` / `certifyDocument` now
  refuse a template with a clear error (`assertNotTemplate`). The seal gains a distinct
  slate, dashed **`template`** tier (no hash crown — a blueprint has no meaningful
  fingerprint), and `detectTrustState` reports it. All four trust surfaces — both
  editors, the desktop badge, and the verify portal — show "Template — outside the
  trust workflow" and gate/disable Seal/Sign/Certify actions for templates. Empty
  property values now also serialise as a clean `key:` (no trailing space) for
  byte-exact round-trips.

- **Live Ambient Seal on every trust surface.** The generative seal (core 1.6.0) is
  now the trust indicator in the editor banner, the desktop badge/panel, the verify
  portal (reflecting *verified* reality — gold/green only when the chain/seal actually
  checks out, gray when it fails), and as live SVGs on the docs homepage.

- **Hash-Based Ambient Seal — a generative trust stamp (`@dotit/core` 1.6.0).**
  `renderSeal({ hash, tier })` turns a document's SHA-256 hash into a notary-style
  ring whose radial "crown" is derived deterministically from the hash — same
  document → byte-identical seal; any change → a completely different crown, so
  tamper-evidence becomes visible at a glance. Tinted by trust tier:
  gray = draft, blue = signed/sealed, green = certified, gold = root-certified
  (with a ★). `detectTrustState(source)` reads the claimed tier from the trust
  lines; `sealForDocument(source)` is the one-call detect-hash-render helper.
  `renderPrint(doc, { seal: true })` stamps it in the top-right corner of the
  first page (auto-detects tier, or pass a verified tier). Pure-string SVG, no DOM
  — usable in the renderer/print/PDF, editor banner, desktop badge, and verify
  portal. 14 tests.

- **Root → intermediate key hierarchy for UTS certification (`@dotit/sign` 1.3.0).**
  Certifications can now chain to an OFFLINE root key. `issueIntermediate()` (run
  offline on the air-gapped root machine) signs a compact intermediate certificate
  ("ICA token") vouching for an online intermediate key; `certifyDocument()` accepts
  an `intermediateCert` and embeds it as an `ica:` field in the certify line;
  `verifyCertifications()` (and the new `verifyIntermediateCert()`) validate the
  whole chain against ONLY the root public key — fully offline, the document carries
  the chain. The verifier checks the root's signature over the intermediate, that the
  signing key is the one the root vouched for, and that the cert time falls in the
  intermediate's validity window. If an intermediate leaks it is revoked and the root
  issues a new one — the root (in every trust store) never moves. Legacy single-key
  certifications (no `ica:`) still verify directly against the trusted key.
  The `uts-certify` service now holds an **intermediate** (its Mongo envelope-encrypted
  key, role-stamped), publishes the **root** as the trust anchor via `/pubkey`
  (`trustAnchor: "root"`), provisions the ICA via `GET /admin/intermediate-pubkey` +
  `POST /admin/intermediate-cert`, and ships an offline `root-ca` CLI
  (`root:init` / `root:issue` / `root:pubkey`, root key encrypted at rest with
  `UTS_ROOT_PASSPHRASE`). Provisioning runbook in the internal deployment docs.

- **XLSX and DOCX converters (both directions) in `@dotit/core`.** Four new
  pure-JS functions convert between IntentText and Office documents:
  `convertXlsxToIntentText(bytes)` (each sheet → a `section:` + table, numbers
  preserved faithfully, `meta: | type: spreadsheet`), `convertIntentTextToXlsx(src)`
  (each `.it` table → a worksheet named from its heading, numeric cells written
  as real numbers, optional KPI sheet from `metric:` rows),
  `convertDocxToIntentText(bytes)` (headings → `section:`/`sub:`/`title:`, lists →
  `- `/`N. `, tables → `.it` tables, `meta: | type: document`), and
  `convertIntentTextToDocx(src)`. Both emit minimal, spec-valid OOXML that opens
  in Excel/Word/LibreOffice without a repair prompt. XLSX/DOCX are OOXML (a ZIP of
  XML parts) — handled with the new tiny, audited, pure-JS `fflate` dependency
  (unzip + zip); no native modules. CLI: `dotit convert in.xlsx out.it`,
  `dotit convert in.it out.xlsx`, `dotit convert in.docx out.it`,
  `dotit convert in.it out.docx` (dispatch by extension pair). `@dotit/core`
  1.4.0 → 1.5.0. v1 scope preserves text/tables/headings/lists and exports
  formula cells' last cached value; cell styling, images, charts, and live
  formulas are deferred.
- **Large page sizes (A3, A2, A1) and orientation (portrait/landscape).** The
  `page:` block now supports the full ISO A-series (`A5` `A4` `A3` `A2` `A1`)
  plus `Letter`/`Legal`, and an `orientation: portrait|landscape` property
  (with the shorthand `size: A3 landscape`). Landscape swaps width/height.
  Core's print/PDF `@page { size: … }` emits the **true physical size**
  (e.g. A3 landscape → `420mm 297mm`), so big reports and wide data tables
  print/export at real size. Core `@dotit/core` 1.3.0 → 1.4.0; new
  `resolvePageSize()` export.
- **Editor page-setup controls.** The ribbon gains a **Page** group: a page
  **Size** selector (A5/A4/A3/A2/A1/Letter/Legal) and a **Portrait/Landscape**
  toggle. They write `page: | size: … | orientation: …` to the `.it` source via
  `setPageSize`/`setPageOrientation`, reflow the on-screen sheet + ruler + WYSIWYG
  print immediately, and round-trip losslessly. The editor's `getPageGeometry`
  computes correct on-screen px for all sizes and both orientations.
- **Editor page zoom (view-only).** A persistent status bar adds an easy
  zoom cluster (**−/percentage/+**) with a presets menu: **Fit to width**,
  **Fit to page**, and 50/75/100/125/150%. **Fit to width** is the key control
  for the large A2/A1 sheets — selecting A1 then Fit to width immediately shows
  the whole page width without manual zooming, and the fit re-applies on window
  resize and page-size change. Keyboard shortcuts: `Ctrl/Cmd +`, `Ctrl/Cmd −`,
  `Ctrl/Cmd 0` (reset), plus `Ctrl/Cmd`-wheel; all keep the focal point stable.
  Zoom CSS-scales the page sheet only — it is **never written to the `.it`
  source and never affects the printed/PDF output**, which always renders at
  true physical size. The ruler and caret/click mapping stay correct under zoom.

## [1.3.0] — 2026-06-13

### Added

- **Lossless text ↔ JSON interchange.** `.it` text and its JSON model
  (`IntentDocument`) are now losslessly interchangeable: `parseIntentText` and
  `documentToSource` are inverses at the information level. `documentToSource`
  is **idempotent** (one pass canonicalizes; further passes are no-ops), the
  canonical text round-trips **exactly** (`parseIntentText(documentToSource(doc))`
  deep-equals `doc`, excluding the volatile sequential `id`), and **no
  information is dropped** — every block, pipe property, block-level
  dir/align/style, table, list, trust line, and `meta:`/`track:` line survives a
  round-trip. Comments and blank-line layout are preserved verbatim. New
  `tests/lossless-roundtrip.test.ts` gates all three properties over every
  `examples/*.it` plus a 3000-document generated corpus. See SPEC §5.1.
  Byte-preservation of *arbitrary* author formatting is **not** guaranteed — the
  first serialize pass canonicalizes representation (markdown tables → keyword
  tables, bare prose → `text:`); the guarantee is canonical-form + information
  losslessness.

### Fixed

- **Adjacent prose merge no longer loses content or properties on serialize.**
  Two `text:` blocks (whether blank-separated or consecutive) round-trip as
  distinct lines with all their properties intact, instead of collapsing into
  one block. This also fixed a **seal-breaking** bug: serializing a sealed
  document dropped blank lines and merged prose, changing the bytes
  `computeDocumentHash` sees — a sealed/signed document now still verifies after
  a `documentToSource(parseIntentText(...))` round-trip.
- **`meta:` and `track:` lines lifted into document metadata are now re-emitted**
  by `documentToSource` in their original position (previously dropped).

## [1.2.4] — 2026-06-13

### Added

- **DB-safe storage helpers** (`toStorageRecord` / `fromStorageRecord` /
  `verifyStorageRecord`): tag a `.it` with a SHA-256 over its EXACT bytes on
  write, verify on read — so storing a document in a database (MongoDB, SQLite)
  can never silently alter it and break a seal/signature. Throws loudly on any
  byte mutation. Distinct from the seal hash (whole bytes vs content body).

## [1.2.3] — 2026-06-13

### Changed

- **`computeDocumentHash` now excludes `certify:` lines** (alongside
  `sign:`/`freeze:`/`amendment:`). UTS certifications are authority metadata
  *about* the content, so adding one must not change the document's own hash.
  Backward-compatible — no existing document uses `certify:`. Enables the
  `@dotit/sign` certification layer (Phase 3).

## [1.2.1] — 2026-06-13

### Changed (trust visuals + RTL)

- **Professional signature & approval blocks.** `sign:` now renders as a proper
  signature line (name, role · date, a signature rule below, a ✓ Signed badge).
  `approve:` is a single grid row with the date anchored top-right — it no longer
  wraps the date onto a second line. The printed page says "Signed", never
  "verified" (it can't run the check; the editor / verify.uts.qa do).
- **Per-paragraph direction.** A block carrying `dir: rtl|ltr|auto` renders in that
  direction independently — select some rows, turn on RTL, and only those
  paragraphs mirror (Word-style), without flipping the whole document.

## [1.2.0] — 2026-06-13

### Fixed (enterprise hardening)

- **Seal/sign/freeze no longer crash in the browser.** The trust layer used
  Node's `crypto` module, which is absent in the editor bundle — clicking Seal
  threw `createHash is not a function`. Replaced with a zero-dependency,
  synchronous SHA-256 that runs identically in Node, browsers, and workers, and
  produces byte-identical digests (documents sealed before this change still
  verify).
- **Trust operations are idempotent.** Re-sealing an already-sealed document, or
  re-signing as the same signer, is now a no-op instead of appending duplicate
  `freeze:`/`sign:` lines — fixes the repeat-click corruption. New `signDocument`
  (sign without freezing), `unsealDocument` (remove the lock, keep signatures),
  `isSealed`, `isSignedBy`.
- **Stray `| key: value` lines no longer leak into output.** A hard-wrapped
  property continuation (e.g. `| label: Date` on its own line) is merged into the
  line above instead of rendering as literal text in signature blocks. Markdown
  table rows (`| a | b |`) are never affected.
- **`info:` callouts are quiet.** Soft gray panel, italic text, an ⓘ marker, no
  loud uppercase label — "worth noting", not an alarm.

### Added

- `upsertMetaProperty` / `getMetaProperty` — idempotent editing of the `meta:`
  line from raw source; toggling a property (e.g. `dir: rtl`) can never produce
  `meta: | dir: rtl | dir: rtl | …`.

## [1.1.1] — 2026-06-12

### Changed

- **Trust blocks typeset like a legal document.** `approve:`, `sign:`, and `freeze:`
  now render as hairline entries with small-caps labels (✓ APPROVED row, signature
  rule line, SEALED DOCUMENT band) instead of colored boxes — ink-first, identical
  in HTML and PDF. Approve now shows its content; sign status is text, not emoji.
- Date-only trust dates (`at: 2026-03-10`) render without a midnight "00:00 UTC".
- llms.txt: full Arabic alias table (33) + complete Arabic quotation example.

## [1.1.0] — 2026-06-12

> **Rebrand:** packages are now published as **`@dotit/core`**, **`@dotit/pdf`**, and
> **`@dotit/mcp`**, starting at **1.0.0**. Same code, same format (`.it`), same team —
> the `@intenttext/*` packages are deprecated with pointers. History below refers to
> the old names/versions.

### Fixed

- **Content-only `header:` / `footer:` blocks now print.** `header: ACME Corp` (no
  zone properties) renders in the top-center @page zone — parity with the editor's
  print path and the llms.txt teaching. Zone properties (`left:`/`center:`/`right:`)
  still take precedence.
- **Escaped pipes now survive round-trips.** `\|` parsed correctly into a literal
  pipe, but the serializer emitted it back UNescaped — re-parsing then split it as a
  property delimiter (data corruption in editor round-trips). The serializer now
  re-escapes `\` and `|` in content and property values; escape round-trips are a
  fixpoint.

### Added

- **Bidi isolation for mixed Arabic/English/numbers (the WhatsApp fix).** Table
  cells, task owner/due/time, metric values, deadline dates, contact email/phone,
  context values, and `end:` values now carry `dir="auto"` — each value resolves
  its own direction from its first strong character, so `10,200 QAR` and
  `2026-06-20` keep their internal order inside RTL lines instead of scrambling.
- **Explicit direction override.** `meta: | dir: rtl` (or `بيانات: | dir: rtl`)
  forces document direction, beating Arabic auto-detection in either direction.

- **Two-sided rows.** `end:` property on `title:`/`section:`/`sub:`/`text:`/prose:
  `text: Customer Name | end: 2026-06-12` renders content at the line start and the
  value at the line end — the invoice/report "label left, date right" pattern.
  Flex start/end, so RTL flips it automatically.
- **Word-parity paragraph spacing.** `leading:` (line-height), `space-before:`,
  `space-after:` style properties — per block or document-wide via `style:` rules.
- **RTL is now fully native.** All built-in CSS (document, print, all 8 themes)
  converted to logical properties (`text-align: start`, `border-inline-start`,
  `padding-inline-start`, …) so Arabic documents mirror correctly everywhere:
  tables, quotes, callouts, asks, audits, deadlines, splits.

- **`dotit` CLI now ships with `@dotit/core`** (1.0.1). `npm install -g @dotit/core`
  gives you the `dotit` command (parse, render, query, seal, verify, amend, index,
  ask, themes). Previously the CLI existed only as a repo script and the documented
  `intenttext` npm package never existed.

- **Unicode (Arabic, any-language) keywords and property keys.** The keyword grammar
  is now `\p{L}` Unicode words, so Arabic domain keywords parse as typed `custom`
  blocks exactly like ASCII ones — `مصروف: كراسي | المورد: ايكيا | فئة: أثاث` is
  queryable by Arabic property (`فئة = أثاث`), by keyword, and by ISO date range.
- **Arabic keyword aliases (33).** The canonical keywords now have registered
  Arabic aliases — `عنوان`→title, `قسم`→section, `مهمة`→task, `صف`→row,
  `أعمدة`→columns, `مؤشر`→metric, `توقيع`→sign, `اعتماد`→approve,
  `تجميد`→freeze, `مهلة`→deadline, `جهة`/`تواصل`→contact, `علامة`→watermark, …
  An Arabic document gets full canonical semantics (totals rows, contact cards,
  signatures, deadline logic) and one query (`type:task`) finds tasks across
  languages.
- **Aliases now round-trip as written.** `documentToSource` re-emits the keyword
  the author used (`block.keywordAlias`) instead of normalizing to canonical —
  an Arabic document stays Arabic, `abstract:` stays `abstract:`, and sealed
  documents keep their hash through a parse→serialize cycle. Table keywords
  (`أعمدة`/`صف`, `headers`) are preserved too.
- **ISO 8601 date standard.** Date-bearing properties (`date`, `due`, `at`,
  `expires`, `issued`) are canonically `YYYY-MM-DD` (or full ISO timestamps). The
  semantic validator flags locale formats (`DATE_NOT_ISO` warning) — `09/03/2026`
  is ambiguous and breaks the query engine's date-range comparisons, which work
  out of the box with ISO values. Editor samples converted to ISO.

## [4.3.1] - 2026-06-12

Hardening release — the start of the enterprise-hardening track.

### Security

- **Parser stack-overflow DoS fixed.** A single line of repeated list markers
  (`- - - - …`, ~10KB) crashed `parseIntentText` with a stack overflow — a denial
  of service for any server parsing untrusted `.it`. The list-item shorthand
  re-parse is now depth-bounded. Found by the new fuzz suite.

### Added

- **Fuzz/property test suite** (`tests/fuzz.test.ts`): 500 random structured
  documents + 200 random byte-soup inputs + pathological edge cases (10K newlines,
  5K pipes, 100KB hash values, BOM, CRLF, deep nesting) — the full pipeline
  (parse → render → print → serialize → re-parse → hash → verify → merge) must
  never throw. Deterministic seeds so failures reproduce. 897 tests total.
- **`/llms.txt`** on the docs site — a complete machine reference that teaches any
  LLM to author valid `.it` (grammar, all 38 keywords, styling layers, templates,
  trust, generation rules). Point an agent at it and it can produce documents,
  templates, and workflows immediately.

## [4.3.0] - 2026-06-12

### Added

- **Scoped document styles — the `style:` block.** House styling declared once,
  document-wide, without per-line props and without arbitrary CSS:
  `style: section | color: #0a7 | weight: 600`. Targets are block types
  (`title summary section sub text quote callout info table table-header metric
  contact divider`); values are the same constrained style-key vocabulary used
  everywhere else. Rules are emitted after the theme (house style wins; per-line
  props and inline spans still override). `style:` lines are invisible in the body,
  round-trip byte-exact, and values are sanitized for the stylesheet context.
- **Editor support, first-class:** each rule shows as a visible 🎨 chip (target +
  declarations) and is applied **live** to the canvas — and therefore to the WYSIWYG
  print export — via the same `documentStyleCSS()` engine core uses, with an editor
  selector map. `style` appears in the editor's Insert menu (registry-driven) and the
  VSCode grammar highlights it (parity gates pass: 38 canonical keywords).
- New exports: `collectDocumentStyles()`, `documentStyleCSS(doc, selectorMap?, prefix?)`,
  `DOC_STYLE_TARGETS`, `DocumentStyleRule`.

## [@dotit/pdf 1.0.0] - 2026-06-12

New opt-in package for **server-side PDF generation** (core stays zero-dependency).
For the moments no human is at a browser: emailing invoices, compliance archiving,
batch statement runs.

- `issuePDF(template, data, { signer, role?, theme? })` — the enterprise issue flow in
  one call: merge (`missing: "blank"`) → **seal** the merged document (tamper-evident
  SHA-256) → real PDF bytes. Returns `{ source, hash, at, pdf }`: store the sealed
  `.it` source on the record (the queryable, verifiable legal artifact) and email/
  archive the bytes.
- `issueDocument()` — same flow minus Chrome (returns print-ready `html`) for
  rendering sidecars like Gotenberg; `renderPDF()` / `htmlToPDF()` primitives;
  `createPdfRenderer()` for batch runs (reuses one Chrome).
- Engine resolution: `puppeteer` (bundled Chromium) → `puppeteer-core` + system Chrome
  (`executablePath` / `$PUPPETEER_EXECUTABLE_PATH` / `$CHROME_PATH` / common paths) →
  clear install guidance. Both are optional peers.
- Tests incl. a real end-to-end (system Chrome): PDF magic bytes, seal verifies intact,
  tamper detected, missing fields blanked, sealed source stays queryable.

## [4.2.1] - 2026-06-12

Production hardening for embedding as an ERP print engine (invoices, receipts,
statements). Audited against real templates; the fixes below close correctness,
parity, and security gaps found in the `renderPrint` / merge path.

### Security

- **Stored-XSS via style-property values is fixed.** A merged value used in a style
  position (e.g. `color: {{brandColor}}`) could contain a `"` and break out of the
  `style="…"` attribute to inject an event handler. Style values are now stripped of
  `;{}` and HTML-escaped, so attribute breakout is impossible while valid CSS (including
  quoted `font-family`) is preserved. Same hardening applied to `divider`'s `style:`.

### Fixed

- **Running page numbers work in print.** `{{page}}` / `{{pages}}` in a `header:`/`footer:`
  now compile to CSS `counter(page)` / `counter(pages)` instead of printing the literal
  `{{page}}`. Header/footer text is escaped for the CSS *string* context (no more stray
  `&quot;`). The editor and core now share one `cssContentValue()` for this — single
  source of truth.
- **`metric:` totals match the editor.** A plain `metric: Subtotal | value: …` renders as
  a label→value total row (amount right-aligned; `Total`/`Balance Due` emphasized), like
  the editor — not a boxed KPI card. A metric with `target:`/`trend:`/`period:` still
  renders as a KPI card. So an invoice/receipt prints the same through core as it looks in
  the editor.
- **`margin:` (singular) is honored,** matching the editor and most authors — previously
  only `margins:` was read, so a custom margin was silently ignored. With no margin set,
  narrow pages (≤120mm, e.g. an 80mm receipt) default to a tight 4mm instead of a 20mm A4
  margin that would consume half the roll.

### Added

- **`parseAndMerge` / `mergeData` accept `{ missing: "keep" | "blank" }`.** In `"blank"`
  mode a `{{field}}` with no data renders empty, so a finished document never shows a
  literal `{{customer.phone}}`. Default stays `"keep"` for template authoring; the ERP
  kit defaults to `"blank"`.
- Exported `cssContentValue()` and the `MergeOptions` type.
- `demo/erp-integration/`: an 80mm `receipt-template.it`; the kit now merges with
  `missing: "blank"`. New ecosystem docs cover receipts, missing-data, totals, and Arabic.
- 13 production-printing regression tests (metric parity, page counters, CSS/style
  escaping, missing-field modes, multi-page header repeat, RTL) — 888 total, all passing.

## [4.2.0] - 2026-06-10

### Added

- **Inline styled spans — `[text]{ key: value; key: value }`.** Style _part_ of a line
  (one word colored, a phrase bold-and-larger, combined styles) without affecting the
  rest. Carries the same style keys as block-level props, but `;`-separated (the `|` is
  the reserved line delimiter). Parses to a `styled` inline node and renders to
  `<span style="…">` via the **same** property→CSS mapping as block props, so partial
  styling is reproduced identically by `renderHTML`, `renderPrint`, the editor, and any
  consumer. Matched after `[text](url)` links and `[[notes]]` so it never shadows them.
- **New style keys `underline:` / `strike:` / `valign:`.** Map to `text-decoration`
  (underline + line-through combine) and `vertical-align` (`sub` / `super`), so spans —
  and blocks — can carry underline, strikethrough, and sub/superscript.
- **ERP integration kit** (`demo/erp-integration/`, `pnpm demo:erp`): a portable,
  one-file pattern for using IntentText as a print/report engine inside an app — store
  a `.it` template as a string, `parseAndMerge(template, data)` →
  `renderHTML`/`renderPrint`, browser print (zero-dep) or server PDF (puppeteer).
  Documented in the **ERP Integration** ecosystem guide.

### Changed

- **Visual editor styling is now faithful end-to-end.** The editor previously flattened
  every mark in a line to whole-line properties (so partial styling was lost or smeared)
  and emitted style keys that didn't match core's (`style`/`font`/`bgcolor` vs core's
  `italic`/`family`/`bg`), so whole-line italic/font/highlight never rendered through
  core. The bridge now serializes each text run independently (semantic marks or a
  `[text]{…}` span), parses marks/spans back from core's inline AST, and is unified on
  core's canonical keys — so what you style in the editor prints identically through the
  template/print path. A fidelity guard surfaces any styling that can't be saved to
  `.it` (regression net).
- **Enterprise-themes showcase** (`pnpm demo:themes`, one `.it` → three themes) and
  **WYSIWYG editor export** (the PDF/HTML now prints the editor's own rendered DOM, so
  it matches the on-screen view exactly).

## [4.1.2] - 2026-06-10

### Fixed

- **Print/PDF was unstyled ("primitive").** `renderPrint` only carried a sparse base
  stylesheet, so the line-items table, contacts, and most elements rendered unstyled.
  The full `.intent-*`/`.it-*` element CSS is now shared between `renderHTML` (screen)
  and `renderPrint` (print) via a single `DOCUMENT_CSS` module, so PDFs are styled the
  same as the on-screen document (themes layer colors/fonts on top).
- **Table rows clipped at page breaks.** Rows that straddled a page boundary were
  hidden behind the running footer/header. Added `break-inside: avoid` on rows, repeat
  the table header per page (`thead{display:table-header-group}`), and let sections
  flow across pages while keeping headings with their content.

### Notes

- Remaining for a visual polish pass: `.intent-metric` styling in print, page margins,
  and overall enterprise invoice/contract layout refinement.

## [4.1.1] - 2026-06-10

### Fixed

- **Template placeholders no longer flagged as warnings.** A document that uses
  `{{…}}` placeholders but declares no context (`context:` block / metadata / step
  outputs) is now treated as a template — its placeholders resolve at merge time, so
  they are not "unresolved variable" warnings. When a context IS declared, undeclared
  `{{vars}}` remain warnings (typo detection). Fixes the noisy
  "Unresolved variable {{…}}" warning on template files in the editor and VSCode.

## [4.1.0] - 2026-06-10

The finalization release: one canonical implementation, a tiered format, and a
focused supported surface.

### Removed

- **Rust/WASM core deleted.** `packages/rust` and the `rust-core` compatibility
  shim are gone; the TypeScript parser is the single source of truth. Internal
  callers now import `parseIntentText` directly from `./parser`. The no-op
  `initRustCore`/`setRustCoreRuntimeMode`/fallback-telemetry API was removed from
  the public surface.
- **Python duplicate parser deleted.** The Python package no longer re-implements
  the grammar. It is now a thin client (`parse`/`parse_safe`) that delegates to the
  canonical core CLI, so Python results can never drift. Bumped to 4.0.0.
- Removed the dead `prepare:wasm` build step and stale `public/rust-wasm/` assets
  from the editor and desktop apps, and obsolete core scripts
  (`report-fallback-telemetry`, `check-no-parser-runtime-coupling`).

### Added

- **Keyword tiers.** Canonical keywords are now grouped into a small everyday
  `core` set (13) plus opt-in `agent`, `contract`, `data`, and `print` profiles.
  Exposed as `KEYWORD_TIERS`, `CORE_KEYWORDS`, `tierOf`, and `KeywordTier`.
- **Consumer parity gate** (`parity:check`) — fails the build if the VSCode grammar
  drifts from the canonical `LANGUAGE_REGISTRY`.
- Canonical [`SPEC.md`](packages/core/SPEC.md) and root
  [`ARCHITECTURE.md`](ARCHITECTURE.md).

### Changed

- Scope focused: **core, mcp, vscode, editor** are the supported surface; hub,
  desktop, docs, builder, and the Python client are marked experimental.
- CI now runs the keyword + parity gates and builds the full supported surface.

### Notes

- **No breaking grammar changes.** Documents that parsed under v3.x parse
  identically. Tiering is contract metadata; every keyword is still recognized, and
  unknown keywords still pass through as `custom`.

## [3.1.0] - 2026-03-09

### Changed

- **Rust Core Default On** - `@dotit/core` now defaults to Rust/WASM mode without requiring any environment variable.
- **Engine Override Policy** - TypeScript mode remains available only as an explicit override (`INTENTTEXT_CORE_ENGINE=ts` or `globalThis.__INTENTTEXT_CORE_ENGINE = "ts"`).
- **Safety Fallbacks Retained** - Temporary TS fallback behavior remains in place for compatibility-sensitive paths (options/theme and WASM failure scenarios) while parity hardening continues.

### Docs

- Updated engine-selection documentation to reflect Rust-default behavior and explicit TS override usage.

## [3.0.0] - 2026-03-09

### Added

- **Rust Core Engine Path** — `@dotit/core` now ships Rust/WASM artifacts generated from `intenttext-rust` under `dist/rust-wasm`.
- **Rust Engine API Bridge** — `parseIntentText`, `renderHTML`, `documentToSource`, and `validateDocumentSemantic` now flow through a Rust-core bridge module when Rust mode is enabled.

### Changed

- **Engine Selection** — Added explicit Rust engine activation via `INTENTTEXT_CORE_ENGINE=rust` (or `globalThis.__INTENTTEXT_CORE_ENGINE = "rust"`) for controlled cutover while parity hardening continues.
- **Build Output** — Core build now copies Rust WASM runtime artifacts into the published package.

## [2.14.0] - 2026-03-09

### Added

- **Workflow Executor** — `executeWorkflow(document, runtime)` runs agentic workflow documents. Handles `step:`, `decision:`, `gate:`, `trigger:`, `result:`, and `audit:` blocks. Caller provides tool implementations via `WorkflowRuntime`. Outputs flow between steps via shared `ExecutionContext`. Decision conditions evaluated with a safe recursive-descent parser (no `eval()`). Gate blocks pause execution for external approval. Dry-run mode validates flow without calling tools. Status written back to every processed block. 38 new tests.

### Changed

- **Keyword Freeze at 37 Canonical Keywords** — `CANONICAL_KEYWORDS` frozen at exactly 37 entries. Extension keywords (`signal`, `figure`, `byline`, etc.) now emit their real block type directly (e.g. `type: "signal"`) instead of wrapping in `type: "extension"` with `x-type` metadata. Eliminates `effectiveType()` indirection layer entirely.
- **Callout Consolidation** — `warning:`, `danger:`, `tip:`, `success:` are now aliases of `info:` with `properties.type` injection for variant styling. Removed dead `BlockType` union members (`"warning"`, `"tip"`, `"success"`, `"danger"`). Renderer consolidated to single `case "info":` handler.
- **Code Quality** — Removed dead `interpolateVariables()` function. Standardized `Object.create(null)` for property dictionaries (prototype pollution guard). Fixed stale type comments.

## [2.11.0] - 2026-03-08

### Added

- **8 New Keywords** — `ref:` (redesigned as cross-document reference with `file:`/`url:`/`rel:` properties), `def:` (glossary/definitions), `metric:` (measurable values with trend indicators), `amendment:` (formal changes to frozen documents), `figure:` (document figures with `<figure>`/`<figcaption>` rendering), `signline:` (physical signature placeholders for print), `contact:` (structured contact information with `mailto:`/`tel:` links), `deadline:` (temporal commitments with urgency coloring).
- **14 Validation Rules** — `REF_MISSING_TARGET`, `REF_MISSING_REL`, `DEF_MISSING_MEANING`, `DEF_DUPLICATE_TERM`, `METRIC_MISSING_VALUE`, `METRIC_INVALID_TREND`, `AMENDMENT_WITHOUT_FREEZE`, `AMENDMENT_MISSING_REF`, `AMENDMENT_MISSING_NOW`, `FIGURE_MISSING_SRC`, `FIGURE_MISSING_CAPTION`, `CONTACT_NO_REACH`, `DEADLINE_MISSING_DATE`, `DEADLINE_PAST`.
- **23 New Aliases** — `references`/`see`/`related` → `ref`, `define`/`term`/`glossary` → `def`, `kpi`/`measure`/`stat` → `metric`, `amend`/`change` → `amendment`, `fig`/`diagram`/`chart` → `figure`, `signature-line`/`sign-here`/`sig` → `signline`, `person`/`party` → `contact`, `due`/`milestone`/`due-date` → `deadline`, `citation`/`source`/`reference` → `quote`.
- **CLI `amend` Command** — `intenttext amend <file> --section --was --now --ref` to add amendment blocks to frozen documents with interactive confirmation.
- **VS Code Extension** — Syntax highlighting, hover docs, snippets, and schemas for all 8 new keywords.
- **17 New Templates** — Contract references, glossaries, executive dashboards, SLA reports, agent monitoring, contract amendments, research reports with figures, signature pages, contact directories, milestone trackers, and regulatory calendars.
- 90 new tests (718 total passing across 18 test files).

## [2.10.0] - 2026-03-07

### Added

- **Theme System** — JSON-based design value sets applied by the renderer. 8 built-in themes: `corporate`, `minimal`, `warm`, `technical`, `print`, `legal`, `editorial`, `dark`. Themes control typography, colors, spacing, and block-level styling. Applied via `meta: | theme: name` or `renderHTML(doc, { theme: "name" })`. `generateThemeCSS(theme, mode)` produces CSS custom properties. Resolution order: options → meta → none.
- **Shallow Index Builder** — `.it-index` architecture for folder-level querying. `buildShallowIndex()`, `checkStaleness()`, `updateIndex()` for incremental index maintenance. Each index covers only direct files in its folder — never recursive.
- **Index Composition and Query** — `composeIndexes()` merges multiple shallow indexes. `queryComposed()` filters by type, content, by, status, section. Three output formatters: `formatTable()`, `formatJSON()`, `formatCSV()`.
- **Natural Language Query** — `askDocuments()` uses Anthropic API to answer questions about `.it` documents. `serializeContext()` converts composed results to LLM-ready context.
- **CLI Commands** — `query <dir>`, `index <dir> [--recursive]`, `ask <dir> "question"`, `theme list`, `theme info <name>`, `--theme` flag on render commands.
- **Hub Platform** — GitHub OAuth authentication, user accounts, publish/review workflow, theme browsing, community and curated template tiers, admin review queue, user profile pages.
- **60 Templates** — 8 domains: business (14), reports (8), editorial (8), book (6), personal (6), agent (8), organization (6), developer (4). Each with paired `.data.json` example data.
- 62 new tests (628 total passing across 17 test files).

## [2.7.0] - 2026-03-06

### Added

- **`policy:` keyword** — standing behavioural rules for AI agents. Supports `if:`, `always:`, `never:`, `action:`, `requires:`, `notify:`, `priority:`, `id:`, `scope:`, `after:` properties. Rendered as styled rule cards in HTML output. Validated for missing conditions (`POLICY_NO_CONDITION`) and missing actions (`POLICY_NO_ACTION`). `documentToSource()` canonical property order. 19 new tests (445 total).

## [2.6.0] - 2026-03-05

### Added

- **`parseIntentTextSafe()`** — production-grade parser wrapper that never throws. Adds configurable unknown-keyword handling (`'note'` / `'skip'` / `'throw'`), `maxBlocks` cap, `maxLineLength` truncation, and strict mode. Returns a `SafeParseResult` with `document`, `warnings`, and `errors` arrays.
- **`documentToSource()`** — reverse of the parser. Converts a parsed `IntentDocument` (JSON) back to valid `.it` source text with round-trip guarantee. Serialises properties in canonical order per block type.
- **`validateDocumentSemantic()`** — semantic validation beyond syntax. Checks cross-block references (`STEP_REF_MISSING`, `DEPENDS_REF_MISSING`, `PARALLEL_REF_MISSING`), self-referencing calls (`CALL_LOOP`), structural rules (`RESULT_NOT_TERMINAL`, `DUPLICATE_STEP_ID`, `EMPTY_SECTION`), missing required properties (`GATE_NO_APPROVER`, `STEP_NO_TOOL`, `HANDOFF_NO_TO`, `RETRY_NO_MAX`), unresolved `{{variables}}`, and template detection.
- **`queryDocument()`** — simple, intuitive block query API. Filter by `type` (single or array), `content` (string or RegExp), `properties` (exact or RegExp), `section`, and `limit`. All conditions are ANDed; type arrays are ORed.
- **`diffDocuments()`** — semantic diff between two document versions. Matches blocks by content similarity (Levenshtein-based), detects added/removed/modified/unchanged blocks, tracks content and property changes, and produces a human-readable summary string.
- 68 new tests (426 total passing across 12 test files).

## [2.5.0] - 2026-03-06

### Added

- **Document Generation Engine** — full template-to-print pipeline.
- **Layout blocks**: `font:`, `page:`, `break:` — declare typography, page size, margins, and explicit page breaks.
- **Writer blocks**: `byline:`, `epigraph:`, `caption:`, `footnote:`, `toc:`, `dedication:` — semantic elements for book-style and professional documents.
- **`footnote-ref` inline** — `{1}` syntax renders superscript footnote references linked to `footnote:` definitions.
- **`mergeData(doc, data)`** — template merge engine resolving `{{variable}}` placeholders from JSON data. Supports dot notation, array indices, system variables (`{{date}}`, `{{year}}`), and runtime variables (`{{page}}`, `{{pages}}`).
- **`parseAndMerge(itString, data)`** — parse and merge in one step.
- **`renderPrint(doc)`** — print-optimized HTML renderer with dynamic CSS from `font:`/`page:` blocks, `@media print` rules, and `@page` sizing.
- **CLI flags**: `--data <file.json>` for template merge, `--print` for print-optimized HTML, `--pdf <output.pdf>` for PDF generation via Puppeteer.
- Seven example templates: invoice, purchase-order, contract, book-chapter, article, meeting-minutes, report — with matching `.data.json` files.
- 44 new tests (308 total passing across 10 test files).

### Changed

- **HTML renderer CSS overhauled** — minimal, professional, serif-based book-like styling. No colors, neutral grays, Georgia font stack. Designed for book writers, journalists, court writers, and general readers.
- Footnotes are collected and rendered as a numbered list at the bottom of the document.
- Section and sub-section headings now include `id` attributes for TOC anchor linking.
- Parser detects document generation blocks and sets `version: "2.5"` on the document.
- Parser handles pipe-first property syntax (e.g., `font: | family: Georgia`) correctly.

## [2.4.0] - 2026-03-05

### Added

- Native single-backtick inline label parsing (`` `label` ``) in core parser — renders as badge/pill.
- Triple-backtick inline code (` ```code``` `) for monospace code spans.
- New inline node types for writer-first flows:
  - `highlight` from `^text^`
  - `inline-quote` from `==text==`
  - `inline-note` from `[[text]]`
  - shorthand inline links from `[[label|url]]`
  - `date` from `@today`, `@tomorrow`, `@YYYY-MM-DD`
  - `mention` from `@person`
  - `tag` from `#topic`
- Paragraph-first prose behavior for plain lines:
  - consecutive no-keyword lines merge into one `body-text` paragraph
  - blank lines split paragraphs
- Optional per-block alignment via `align:` (`center`, `right`, `justify`).
- Dedicated prose render style (`.intent-prose`) for long-form readability.

### Changed

- Markdown-to-IntentText converter now converts inline code to triple backticks (` ```code``` `), since single backtick is label syntax in IntentText.
- Docs updated for writer-first syntax and prose behavior in README, SPEC, USAGE, and cheatsheet.

### Planned (Not Implemented Yet)

- Smart typing replacements (`--`, `...`, typographic quotes).
- App-level writing UX modes: `Book`, `News`, `Journal`, `Plain`; focus mode; typewriter scroll.

## [2.3.0] - 2026-03-05

### Added

- **`gate:` block** — Human approval checkpoint with `approver:`, `timeout:`, `fallback:` properties. Status defaults to `blocked`.
- **`call:` block** — Synchronous sub-workflow composition with `input:`, `output:` properties. Status defaults to `pending`.
- **`emit:` block** — Workflow signal / status event with `phase:`, `level:` properties. Default `level: info`.
- **`{{variable}}` interpolation** — Variable references in property values (e.g. `input: {{userId}}`). Preserved as strings for runtime substitution.
- **`join:` property** on `parallel:` — Barrier semantics: `all` (default), `any`, `none`.
- **`on:` property** on `wait:` — Trigger condition (e.g. `on: smoketest.complete`).
- **`approver:` property** on `gate:` — Person/role required for approval.
- New `AgenticStatus` values: `approved`, `rejected`, `waiting`.
- `VariableRef` interface exported from core.
- 35 new tests (255 total).

### Changed

- `status:` standalone block is now an alias for `emit:` (backward compatible).
- `context:` block now supports both `key = "value"` and `| key: value` pipe syntax.
- `result:` is now terminal-only — ends workflow and declares output. Use `output:` property on `step:` for step-level outputs.
- Smart defaults: `gate` → `status: blocked`, `parallel` → `join: all`, `call` → `status: pending`, `emit` → `level: info`.
- SPEC.md updated to v2.3, all keyword tables reflect final design.
- USAGE.md updated to v2.3 with gate/call/emit examples.
- README.md keyword tables updated, test count updated to 255.

### Removed

- **`schema:` block** — Runtime concern, not format concern. Removed from parser and keyword set.

## [1.4.0] - 2026-03-03

### Changed

- Parser now emits `version: "1.4"` on parsed documents
- SPEC.md section 12 rewritten — separates implemented features from roadmap
- `html-to-it.ts` JSDoc updated to clarify Node.js-only requirement
- Fixture JSON files updated to match parser version output
- `fixtures.test.ts` normalize function now strips `undefined` values

### Removed

- Removed `vscode-extension/` directory (will be a separate repo)

### Fixed

- Fixture tests were asserting `version: "1.2"` while parser emitted `"1.3"` — now aligned

## [1.3.0] - 2026-03-02

### Added

- **`convertHtmlToIntentText(html)`** — new HTML-to-IntentText converter. Maps semantic HTML elements (`<h1>` → `title:`, `<h2>` → `section:`, `<ul>` → list items, `<table>` → pipe tables, `<blockquote>` → `quote:`, etc.) with full inline formatting support
- **`convertMarkdownToIntentText`** now exported from browser bundle
- Blockquote (`>`) → `quote:` conversion in markdown converter
- Horizontal rule (`---`, `***`) → `---` divider in markdown converter
- Markdown table support in markdown converter
- `subsection:` keyword alias for `sub:`
- `version` field on parsed `IntentDocument` (emits `"1.2"`)
- `info:`, `warning:`, `tip:`, `success:` added to exported KEYWORDS array
- `//` comment syntax — lines starting with `//` are silently ignored

### Changed

- **Breaking**: Removed stub modules `ai-features`, `knowledge-graph`, `collaboration`, `export`, `templates`, `dates` — these were never production-ready
- **Breaking**: `done:` normalizes to `{type: "task", properties: {status: "done"}}` instead of `{type: "done"}`
- Checkbox `[x]` also normalizes to `type: "task"` with `status: "done"`
- Removed deprecated `InlineMark` type and `marks` field from `IntentBlock`
- `flattenBlocks()` extracted to shared `utils.ts` (internal refactor)
- KEYWORDS array is now the single source of truth in `types.ts`
- Browser bundle reduced from ~60KB to ~21KB

### Fixed

- `//` comment lines inside code blocks are now preserved (previously swallowed)
- `**multiple** bold **segments**` in markdown converter now converts correctly
- `query.ts`: `total` field now counts all blocks including nested children
- `schema.ts`: `allowUnknownProperties` now only warns when explicitly set to `false`

## [1.2.0] - 2026-03-01

### Added

- `subsection:` alias for `sub:`
- `done:` normalization to `{type: "task", status: "done"}`
- `version: "1.1"` field on IntentDocument
- `//` comment syntax

## [1.1.0] - 2026-02-28

### Added

- Polished HTML renderer with callouts, tables, tasks, RTL support
- Query engine (`queryBlocks`, `parseQuery`)
- Schema validation (`validateDocument`, `createSchema`)

## [1.0.0] - 2026-02-27

### Added

- Initial public release of the IntentText v1.0 parser and HTML renderer.
