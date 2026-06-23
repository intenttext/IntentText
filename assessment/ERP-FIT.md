# ERP-FIT.md — Embedding IntentText as the Document Layer in Jadwal

*Decision memo for the technical founder. Date: 2026-06-19. Scope: using `@dotit/core` and siblings as the internal document/print/seal engine inside your ERP. This is deliberately narrow — it does **not** evaluate selling `.it` as a standalone format or pursuing government adoption, both of which fail for unrelated strategic reasons.*

> **⚠️ Dated 2026-06-19 — pre-freeze memo.** As of 2026-06-23 the four P0 gates this memo treats as open are **resolved** in code: G-01 (appearance hash + bare-by-default render), G-02 (SEAL_SPEC 4 CRLF/whitespace normalization), G-03 (authority verified, not presence-painted), G-04 (ERP handlers rewritten). EN 16931/UBL export shipped (1.24.0). See [`FORMAT-REVIEW.md`](./FORMAT-REVIEW.md).

---

## 1. Bottom line

**Verdict: ADOPT WITH CAVEATS.** This is the single most defensible use of IntentText, and it is the one path that dissolves every strategic kill-shot facing the project. But two confirmed integrity bugs sit directly on the seal — the feature that is your entire reason for using `.it` over a templating library — and they must be fixed before you rely on a seal in production.

**Why proceed:** The canonical pipeline you actually need — template + JSON → merge → render → seal → verify — is real and code-verified working end to end. It ran in audit at ~475 merge+seal+renderHTML documents/sec single-threaded; a 1000-line-item invoice merges in 5ms (`/tmp/erp_perf.mjs`). The core engine is genuinely production-grade: 1161 passing tests including a 6000-seed property-based byte-preservation gate that is a hard CI release-blocker, zero `TODO/HACK` markers, ~0 real `as any` in published source, and a from-scratch SHA-256 that is byte-identical to Node. The seal-versioning design (every seal stamps `spec:`, verification dispatches on the *recorded* spec forever via a frozen canonicalizer registry) is exactly right for audit/retention. Storage is clean byte-faithful text in any DB column, with a drift-detecting integrity tag. None of this is marketing — it survives code review.

**Why "with caveats" and not "adopt now":** Treat this as *"adopt the MIT core library, vendor and pin the source, and build the productization yourself"* — **not** *"buy the stack."* Four things gate any production reliance on the seal:

| Gate | Issue | Reference |
|---|---|---|
| **P0** | Styling-exclusion forgery: a sealed doc can have material clauses rendered **invisible** while `verifyDocument()` returns `intact:true` and the official verify portal shows a clean green preview | G-01 |
| **P0** | CRLF / trailing-whitespace silently break otherwise-untampered seals — an ERP storing `.it` under git/Windows **will** hit this | G-02 |
| **P0** | Trust tier is **presence-based**, not crypto-verified — a forged `certify:` line can render a gold "CERTIFIED" badge in the UI | G-03 |
| **P0** | Do **not** copy the shipped Express/Fastify handlers — they import a non-existent `@dotit/pdf-runtime` and throw on startup | G-04 |

The good news: in the embedded path you control the renderer and the verifier, so you can fix or work around all four yourself. The first three are in MIT-licensed code you can patch (or upstream); the fourth is just choosing the right entry point. None is architectural.

---

## 2. Why embedding is the strongest wedge

Every viability concern that sinks `.it` as a *product* evaporates when it is consumed as a *library inside a system you already control.* From the red-team analysis (probability framing for each play):

- `.it` as a general go-to format: **~2-5%** (file-format network effects + bus-factor-1 are near-insurmountable)
- `.it` as an enterprise doc layer sold to third parties: **~10-15%**
- `.it` for government: **~1-3%**
- **`.it` embedded in the author's own ERP: ~60-75%** — *"genuinely strong — real code, real tests, real differentiation for in-document approval workflows, no adoption tax."*

The mechanism, quoting the red-team directly: *"consumed as LIBRARIES inside a system the same author controls… all four kill shots dissolve. No network effect (the ERP IS the renderer/verifier). No third-party procurement of a bespoke format (it's an internal implementation detail like any templating engine). Bus factor irrelevant (the .it maintainer is the ERP vendor). No external trust-authority recognition needed for INTERNAL approval workflows (intra-tenant trust suffices)."*

Two specific de-risking facts:

1. **You never expose the format.** Your tenants see better invoices, contracts, and audit trails — not a new file extension. Every "fall back to a format people already have" surface (`apps/verify` portal, render-to-PDF, render-to-HTML) is *yours*, internal, and optional.
2. **The bus-factor-1 risk — disqualifying for any procured/gov system — is irrelevant to you,** because the maintainer is effectively the same party as the consumer. The 326/326-single-author reality that would fail a vendor-risk review becomes a non-issue. Standard hygiene applies: MIT-license the dependency, vendor and pin the exact source you ship, and keep a build you can patch.

What `.it` genuinely adds over "Markdown + sign the rendered PDF" is narrow but real, and it is exactly what an ERP document/approval feature wants:
- **Restyle-without-breaking-the-seal** — the v3 hash excludes presentation, so re-theming a sealed doc per-tenant still verifies (a PDF byte-hash cannot do this). *(This is also the source of the G-01 forgery hole — see §5/§6.)*
- **In-file approval routing + hash-chained audit** (`workflow.ts`, `audit-chain.ts`) — workflow state and ordering live *inside* the document, tamper-evident.
- **One source → web + print/PDF + signable form** with no separate viewer.

If your document features are static "sign once and archive," the differentiator thins and plain PDF tooling competes hard. If they involve multi-party in-document approval on living, restyleable records, `.it` is differentiated.

---

## 3. Reference integration architecture

### 3.1 The pipeline mapped to ERP concepts

```
 ERP concept          .it / @dotit API                     Where it lives
 ───────────────────  ──────────────────────────────────  ────────────────────────
 Document template    parseIntentText(templateSrc)          stored as .it text
 + {{merge fields}}   {{dot.path}} + each: loops            (your template store)
 Tenant business data merge(template, jsonData)              from your RDBMS
   (JSON)               -> expandEachRows for line items
 Render for screen    renderHTML(doc)                        web preview
 Render for print     renderPrint(doc, {bare:true})          PDF source (see §6)
 Issue (print-ready)  issueDocument(...) / issuePDF(...)     @dotit/pdf
 Seal (tamper-evid.)  sealDocument(src, {signer, role})      trust.ts
 Sign (Ed25519)       signDocumentCrypto(src,{...,key})       @dotit/sign
 Verify               verifyDocument(src)                     offline, no network
 Store                toStorageRecord(src)                    any TEXT/string column
 Approvals/audit      workflow.ts + verifyAuditChain         in-file, hash-chained
 Query (single doc)   queryDocument(doc, filter)             intra-document only
```

### 3.2 Realistic data flow (one invoice)

1. **Precompute everything numeric in the ERP.** The merge engine does substitution and `each:` row expansion only — **no arithmetic, no conditionals, no currency formatting** (G-15). Compute line totals, tax, subtotals, grand totals, and format currency strings *before* merge. The demo data hard-codes `"12,000 QAR"` and a precomputed `totals` block precisely because of this. `{{a*b}}` is left literally unresolved in the output.
2. **Merge:** `merge(template, invoiceJson)` → `expandEachRows` builds the line-item table. Merge guards against prototype pollution and caps path depth/length, so it is safe to feed tenant data directly. Merged values are HTML-escaped, including inside style attributes.
3. **Seal/sign:** `sealDocument(merged, {signer, role})` for integrity, or `signDocumentCrypto(merged, {signer, role, privateKey})` for Ed25519 identity binding. The signature binds `(hash | signer | role | at)` so it cannot be lifted onto another document.
4. **Render:** for PDF, render via `@dotit/pdf` `issuePDF` / `createPdfRenderer`. **Render the trusted/archival view with `{bare:true}`** (see §6, G-01).
5. **Store:** persist the sealed `.it` source via `toStorageRecord()` on the invoice row, and archive the PDF. `fromStorageRecord()` throws loudly if storage mutated a byte, protecting the seal. Index issue-time metadata (number, status, amount, hash) into your own ERP tables — **do not** rely on `.it` for cross-document reporting (§5).
6. **Verify:** `verifyDocument(src)` is fully offline (hash + public key + signature all inside the file) — expose it as an ERP endpoint.

### 3.3 The Chrome/PDF dependency — operating it at scale

The `.it` engine itself is **not** the bottleneck (~475 docs/sec CPU-side). The only heavy cost is PDF: every PDF needs a headless-Chrome page via puppeteer. To operate at invoice volume:

- Use `createPdfRenderer()` (`packages/pdf/src/index.ts:318-350`) — it holds **one** browser instance and exposes `issuePDF`/`renderPDF`/`close`, designed for month-end batch runs. Do **not** launch Chrome per request.
- For horizontal scale, run a dedicated Chrome/PDF worker pool (or a Gotenberg sidecar fed by `issueDocument().html`) separate from your API process, so a Chrome crash or memory leak never takes down request handling.
- Treat PDF generation as async/queued for bulk runs; render HTML synchronously (cheap), defer PDF.

> **Entry-point warning (G-04):** Use `erp-service.mjs` / `@dotit/pdf` `issuePDF`/`issueDocument`/`createPdfRenderer` as your template. The shipped `demo/erp-integration/erp-express-handlers.mjs` and `erp-fastify-handlers.mjs` import `@dotit/pdf-runtime` (which exists nowhere in the repo or any package.json) and call `runtime.createPdf` (wrong API) — they **throw on startup**. They are the most copy-pasted entry point and currently mislead.

---

## 4. Multi-tenant signing identities

The revenue/trust model rule (`REVENUE-MODEL.md:17-40`) is: **one signing identity per company, never shared.** For an ERP reseller serving many client companies, this is architecturally correct — but **entirely your responsibility to enforce.** There is **zero** multi-tenant code anywhere in the packages (grep for `tenant`/`multi-tenant` returns nothing), and `.it` carries no tenant boundary by design. `INTEGRATION.md` explicitly labels this "Level 0 — the rung Jadwal should implement."

The signing API takes a single `privateKey` per call: `signDocumentCrypto(source, {signer, role, privateKey})`. Everything tenant-aware is host-side. Build, in Jadwal:

1. **A per-tenant key vault** backed by an HSM or cloud KMS — never store raw private keys in a DB column. One key per client company.
2. **Authenticate-then-lookup:** authenticated session → resolve tenant → fetch that tenant's signing key. `signer` and `role` come from the **session**, never from a user-editable text box (this closes the "type someone else's name and click sign" gap).
3. **Hard isolation tests:** assert that a request authenticated as Tenant A can never load Tenant B's key, and that one tenant's data is never merged into another's document.
4. **Data isolation** (which `.it` belongs to which tenant) is ERP-side, in your existing row-level tenant scoping — the `.it` file does not help here.

Get this wrong and one client company can forge another's signatures. This is the single most important piece of work the integrator owns, and there is no library shortcut.

> **Reference pattern shipped (G-05).** `packages/sign/tests/multi-tenant-custody.test.ts` is the executable reference: a `TenantKeyVault` whose **only** signing entry point is `signFor(session, source)` — the private key is selected by the session's tenant and never exposed (no `getPrivateKey()`), and `signer`/`role` come from the authenticated **session**, never a request body. The five PoC tests now prove the isolation contract with real Ed25519 crypto: each tenant gets a distinct identity; a signature verifies only under its own published key; the signer is session-derived; an unknown tenant cannot sign; and **the cross-tenant forgery IS demonstrated** — re-stamping tenant A's signature with tenant B's key makes `verifyDocumentSignatures` fail (impersonation is caught). Port this shape into Jadwal, swapping the in-memory `#keys` map for your KMS/HSM (the vault holds a key *handle* and signs via the HSM — raw key bytes never enter app memory).

---

## 5. What fits today vs. what's missing for ERP-grade use

### Fits today (verified)
- **The canonical merge→seal→verify flow**, end to end, with tamper detection — *confirmed by running it.*
- **Line-item tables** via `each:` loops (dot-paths + array indices, singularized loop vars).
- **Byte-faithful, DB-agnostic storage** with a drift-detecting integrity tag.
- **Offline, in-file verification** — strong for an audit/compliance layer.
- **Versioned seal spec** — historical seals never silently break when rules change.
- **Arabic/RTL** at the renderer level (per-document and per-paragraph `dir`), with merged data HTML-escaped.
- **Batch PDF** via a shared-Chrome renderer.

### Missing / weak — with the workaround or required build

| Gap | Severity | Reality | Workaround / required build |
|---|---|---|---|
| **No arithmetic/conditionals/currency formatting in merge** (G-15) | High | All totals/tax/formatting must be precomputed by the ERP. The `compute:`/`show-if:` logic exists in `field-logic.ts` but is wired **only** to the interactive Forms pipeline, not document merge. | Adopt **"ERP computes, `.it` formats"** as the permanent contract; ship a small `Intl`-based currency/number helper. Or build a computed-fields layer onto merge by reusing `field-logic.ts computeValue` + a conditional block directive (larger effort). |
| **No cross-corpus query/reporting DB** (G-16) ✅ *bridge shipped* | Medium | `queryDocument` filters blocks *within a single document*. The only cross-document layer is shallow, non-recursive, in-memory per-folder JSON indexes with a non-cryptographic hash. Does **not** scale to invoice volume. | **Position `.it` as a generated sealed artifact, not a system of record.** Keep business data + reporting in your RDBMS; on store/update call **`extractDocumentMetadata(source)`** (core 1.23+) — a flat record (`title/type/status/fields/metrics/sealed/signers/contentHash`) — and upsert it into your own `documents` (+ `document_metrics`) tables. Reporting stays in the database; do **not** attempt folder-query reporting at scale. |
| **DOCX import produces static docs, not templates** (G-17) | Medium | `convertDocxToIntentText` does not detect/reconstruct MERGEFIELD / content controls / `{{}}` placeholders; output is a one-off document with a fixed `type: document` header. it→docx is also lossy (drops emphasis/links, demotes `info:`/`metric:` to plain text). | For migrating existing Word invoice/PO/contract templates: import for static content only, then hand-author the `{{path}}` placeholders and `each:` loops in the editor. Or invest in MERGEFIELD→`{{path}}` mapping. Do not market it↔docx as faithful interop. |
| **Sealed bytes not reproducible after the fact** | Low | `sealDocument` bakes a wall-clock `at:` with no override, so re-running merge+seal years later yields different *sealed bytes*. The merged **content** and **content hash** are deterministic (what verification needs). | **Store the sealed `.it` as the artifact of record** (the `storage.ts` pattern already implies this). Optionally add an `at:` override to `SealOptions` (as `certifyDocument` already has) for deterministic re-issuance/testing. |
| **CRLF / trailing-whitespace break seals** (G-02) | High | `hashedBody` splits on `\n` only and keeps a trailing `\r`; the parser splits on `/\r?\n/`. Any LF→CRLF transform (Windows git autocrlf, Windows file APIs, email gateways) flips `intact:false` on an unmodified doc. | Normalize line endings to LF and strip trailing whitespace **before hashing** as a new frozen spec version (leaving v0–v3 untouched), and add CRLF/trailing-whitespace cases to the property suite. Until upstreamed, normalize `.it` to LF at your storage boundary and forbid autocrlf on the column/repo. |
| **Styling-exclusion forgery** (G-01) | Critical | After sealing, anyone (no key) can set a clause to `opacity:0` / `color:#ffffff` / `size:0px`, or inject one `style:` line, making material terms render blank while `verifyDocument` returns `intact:true`. The verify portal (`verify.ts:229`) renders non-bare, showing a green "intact" verdict beside a doctored preview. | See §6 — this is the top risk and requires a deliberate design fix, not a workaround you can ignore. |

---

## 6. Top ERP integration risks & mitigations

**R1 — Styling-exclusion content forgery (CRITICAL, P0).** This is the headline risk and it directly undermines the seal that is your whole reason for using `.it`. Two independent audits reproduced it end to end: sealed doc + excluded styling → clauses render invisible in Chrome screenshots → `verifyDocument().intact == true` with a **byte-identical** `expectedHash` → trust band still reads "Signed … · Sealed." A single injected `style: text | color:#ffffff` line wipes *every* paragraph of a settlement while the seal stays intact. The official portal renders the *non-bare* (smuggle-able) preview.

This is a genuine design tension, not a one-liner: re-including visibility props in the hash **destroys the "restyle without breaking the seal" pillar** you actually want for per-tenant theming. Resolve it deliberately:
- **Mitigation (recommended for ERP):** render **bare-by-default** on every *trusted* surface — verify portal, print, PDF export — via `renderPrint(doc, {bare:true})` (which strips `color`/`size`/`opacity`/`style:`). Keep non-bare rendering only for the editable/preview surface. Add a render-time **visibility guard** that clamps near-invisible styling (`opacity < ~0.1`, foreground ≈ background, sub-floor font size) in the trusted path.
- **Stronger:** add a separate **appearance hash** so restyling produces a visible *"appearance changed since sealing"* warning rather than silently passing — preserving the restyle-safe pillar while closing the hole.
- Fix `verify.ts:229` to pass `{bare:true}`, and add adversarial tests.
- Because you control every render surface in the embedded path, you can ship this fix without waiting on upstream.

**R2 — CRLF/whitespace seal breakage (HIGH, P0).** See §5. An ERP round-tripping `.it` through mixed-OS/git storage *will* hit this. Mitigate at the storage boundary (force LF, no autocrlf) and push for the v4 normalization spec.

**R3 — Forgeable trust-tier UI (HIGH, P0, G-03).** `detectTrustState`/`sealForDocument` pick the visual tier purely from which trust *lines* are present — no signature verification. A forged `certify:` line with an attacker key renders a gold "CERTIFIED" seal. **Audit every surface** (verify portal, any embedded badge) to confirm it passes a crypto-**VERIFIED** tier into `renderSeal`/`renderTrustBand`, not the presence-based default. Default to a "claimed/unverified" visual unless verification passed.

**R4 — Broken shipped handlers (P0, G-04).** Covered in §3.3. Use `erp-service.mjs` / `@dotit/pdf`; ignore the `pdf-runtime` handlers.

**R5 — Multi-tenant key custody (HIGH, P1, G-05).** Covered in §4. Own it from day one.

**R6 — Self-asserted timestamps (MEDIUM).** Native `.it` seal timestamps are author-chosen and backdatable at creation; there is no external time anchor. For internal approval workflows this is usually acceptable. If you need provable time, wire an optional RFC-3161 countersignature (`pades/tsa.ts` exists) and surface "time self-asserted" vs "TSA-anchored" distinctly.

**R7 — Chrome/PDF as a scaling/failure surface.** Covered in §3.3 — isolate it in a worker pool, never per-request.

---

## 7. Staged adoption plan

### Stage 0 — Foundation (before any production seal)
**Build/fix:**
- Patch or upstream **bare-by-default trusted rendering + visibility guard** (R1) and pass `{bare:true}` at the verify surface.
- Normalize `.it` to **LF at the storage boundary**; disable git autocrlf on the relevant repo/column (R2).
- Audit trust-tier rendering to pass a **crypto-verified tier** (R3).
- Stand up **per-tenant KMS/HSM key custody** with session-bound `signer`/`role` and cross-tenant isolation tests (R5).
- Vendor and pin the exact `@dotit/*` source you ship.

**Success criteria:** an adversarial test corpus — invisible-clause smuggling, CRLF round-trip, forged `certify:` line — all produce the *correct* verdict (broken seal or "unverified" badge), and a Tenant-A session provably cannot load Tenant-B's key.

### Stage 1 — Pilot: ONE document type (invoices)
- Template (`.it`) + tenant JSON → merge (`each:` line items) → seal/sign → bare-render PDF → store sealed `.it` + archive PDF → verify endpoint.
- All numeric computation in the ERP; `.it` formats only.
- Reporting stays in the RDBMS; index issue-time metadata into ERP tables.
- Run PDF through a shared-Chrome `createPdfRenderer` in a separate worker.

**Success criteria:** Month-end batch of N invoices renders and seals without a Chrome OOM; every stored `.it` re-verifies `intact:true` after a storage round-trip; tampering any line flips `intact:false`; a tenant re-theme leaves the seal valid; the bare/trusted render of a re-themed doc shows no smuggled-invisible content.

### Stage 2 — Add approval workflow on the same doc type
- Wire in-file `route:`/`require:`/`workflowState` + `verifyAuditChain` for multi-party invoice/contract approval.
- Surface plain-language approval status to non-technical staff (no hashes/keywords) — note this approval-inbox UX is **not** built in the libraries; it is your build.

**Success criteria:** insert/reorder/delete of an approval is detected by the chain; approvers act from the ERP UI without ever seeing a hash.

### Stage 3 — Broaden to 2-3 more doc types (quotations, POs, contracts)
- Reuse the Stage-1 pipeline; migrate existing DOCX templates as **static content**, then hand-author placeholders/loops (DOCX import does not reconstruct merge fields).
- Decide explicitly on the computed-fields question (ship the `Intl` helper vs. build a merge-time compute layer).

**Success criteria:** a new doc type onboards by authoring a template + mapping ERP JSON, with no engine changes; per-tenant theming and sealing behave identically across types.

**Avoid throughout:** folder-query reporting at scale; expecting templates to compute totals; treating it↔docx as faithful interop; copying the `pdf-runtime` handlers; relying on the presence-based trust tier or the non-bare verify preview.

---

**One-line summary for the record:** Embed it — the engine is real and the wedge is right — but fix the styling-exclusion forgery (G-01) and CRLF seal-break (G-02), verify the trust tier (G-03), avoid the broken `pdf-runtime` handlers (G-04), and own per-tenant key custody (G-05) *before* you let a seal mean anything in production. The seal is your value-add; don't ship it broken.