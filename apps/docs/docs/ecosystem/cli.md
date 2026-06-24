---
sidebar_position: 5
title: CLI
---

# The `dotit` CLI

The command-line tool ships with `@dotit/core` and covers the whole life of a
`.it` file: parse it, render it, merge it with data, print it, query it across a
folder, seal it, verify it, and amend it. This page is the working guide — for
the complete flag tables see the [CLI Reference](/docs/reference/cli).

## Installation

```bash
npm install -g @dotit/core
```

Or run without installing:

```bash
npx -p @dotit/core dotit <command>
```

`dotit --help` prints every command. The CLI has no configuration files — the
only environment variable it uses is `ANTHROPIC_API_KEY` (for `dotit ask`).

## Parse and render

```bash
# Parse → full JSON AST (the default with no flags)
dotit contract.it

# Render to HTML, with an optional theme
dotit contract.it --html --theme corporate
dotit contract.it --html --output          # saves contract.html next to the source

# Print-ready HTML: @page size/margins, running header/footer, page counters
dotit contract.it --print --theme legal
dotit contract.it --print --output         # saves contract-print.html

# Straight to PDF (requires puppeteer: npm install puppeteer)
dotit contract.it --pdf                    # saves contract.pdf, A4
```

`dotit theme list` shows the 8 built-in themes (`corporate`, `minimal`, `warm`,
`technical`, `print`, `legal`, `editorial`, `dark`); `dotit theme info corporate`
prints a theme's fonts and colors.

## Convert existing files

Markdown and HTML convert to `.it` — headings become `title:`/`section:`,
lists stay lists, tables become pipe tables:

```bash
dotit notes.md --to-it             # prints the converted .it to stdout
dotit notes.md --to-it --output    # saves notes.it next to the source
dotit page.html --to-it
```

For spreadsheets and Word documents — and for writing `.it` *back out* to those
formats — use `dotit convert <in> <out>`, which dispatches on the extension pair:

```bash
dotit convert report.xlsx report.it     # Spreadsheet → IntentText (one section per sheet)
dotit convert contract.docx contract.it # Word document → IntentText
dotit convert notes.md notes.it         # Markdown / HTML → IntentText
dotit convert report.it report.xlsx     # IntentText → spreadsheet (each table → a sheet)
dotit convert contract.it contract.docx # IntentText → Word document
dotit convert report.it report.md        # IntentText → Markdown
```

Supported pairs: `.md` / `.html` / `.xlsx` / `.docx` → `.it`, and `.it` → `.md` / `.xlsx` / `.docx`.
The same converters are available programmatically — see
[Core API › Conversion](./core-api#conversion).

## Templates and document generation

A template is a `.it` file with `{{placeholders}}`. Merge it with a JSON file and
render in one command:

```bash
dotit invoice-template.it --data invoice-data.json            # merged JSON
dotit invoice-template.it --data invoice-data.json --html --theme corporate
dotit invoice-template.it --data invoice-data.json --print    # print HTML
dotit invoice-template.it --data invoice-data.json --pdf      # invoice-template.pdf
```

Repeating rows (`each:` on a table header), dot paths (`{{customer.email}}`), and
print tokens (`{{page}}`/`{{pages}}` become live page counters) all resolve in the
merge — see [Templates](/docs/reference/templates).

## Validate

Five built-in schemas: `project`, `meeting`, `article`, `checklist`, `agentic`.

```bash
dotit project-plan.it --validate project
# ✓ Document is valid          → exit code 0

dotit policy.it --validate checklist
# ✗ Validation failed with 1 error(s):
#   [ERROR] text: Block type "text" is not allowed in "checklist" documents
#                              → exit code 1
```

The non-zero exit code on failure is what makes `--validate` useful in CI (see
[Where the CLI shines](#where-the-cli-shines)).

## Query

Two query modes. **Single file** uses the operator syntax — and because `.it`
standardizes on ISO 8601 dates, range comparisons just work:

```bash
dotit contract.it --query "type=deadline date<2026-09-30"
dotit todo.it --query "type=task owner=Ahmed sort:due:asc limit:10"
```

**Folder** mode treats a directory (or glob) of `.it` files as one queryable
dataset, with `table`, `json`, or `csv` output:

```bash
dotit query ./contracts --type deadline --format table
dotit query ./contracts --type contact --format csv > contacts.csv
dotit query "contracts/*.it" --type sign --format json
```

`dotit index <dir>` builds the per-folder `.it-index` cache (`--recursive` for a
tree), and `dotit ask <dir> "question"` answers in natural language (requires
`ANTHROPIC_API_KEY`). The full story — including cross-language Arabic/English
queries — is in [A Folder Is a Database](/docs/guide/folder-as-database).

## Trust: a complete walkthrough

This is the part enterprises ask about first, so here is the entire flow on a real
contract, with exactly what happens at each step.

### 1. Seal

Start from a finished contract:

```intenttext title="acme-cloud-services.it"
title: Cloud Services Agreement
summary: Managed hosting for Acme Gulf Trading WLL
meta: | ref: CON-2026-014 | status: active

section: Scope
text: Managed Kubernetes hosting, 99.9% uptime SLA, monthly reporting.
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee

section: Approvals
approve: Legal review complete | by: Sara Haddad | role: Counsel | at: 2026-06-01
```

```bash
dotit seal acme-cloud-services.it --signer "Fahad Al-Thani" --role "Managing Director"
# ✅  Document sealed
#     Signer:   Fahad Al-Thani (Managing Director)
#     Hash:     sha256:53cdd027b9a246d66570914c4d0e6c0e602526f711cc7c86eafa1b4b97b7ec05
#     Frozen:   2026-06-12T16:42:23.608Z
```

What `seal` actually does, in order:

1. **Computes the document hash** under the current ruleset (`spec: 4`). It takes
   the raw source text, cuts it at the `history:` boundary line if one exists (the
   audit log below it is never hashed), **drops comments** (`//` lines) and
   **styling** (presentation lines `page:`/`font:`/`style:` and presentation
   properties like `color`/`size`/`align`), then applies the **seal scope** — it
   keeps each `sign:` line whole and the `freeze:` line with only its own `hash:`
   blanked (so the seal covers the signatures and its own `at:`/`status:`), and
   removes `certify:`/`amendment:`. It normalizes line endings (CRLF/lone-CR → LF) and
   trailing whitespace, NFC-normalizes, joins with `\n`, trims, and computes
   **SHA-256 over the UTF-8 bytes** of that canonical *content*. The result is the
   `sha256:<hex>` string you see. `approve:` lines are *included* — an approval is part of
   what gets sealed; **restyling, reformatting, CRLF/whitespace changes, and comments never
   break a seal** (only a content change does).
2. **Appends two lines to the file** (just above `history:`, or at the end), each
   stamped with the `spec:` ruleset that produced its hash:

   ```intenttext
   sign: Fahad Al-Thani | role: Managing Director | at: 2026-06-12T16:42:23.608Z | hash: sha256:53cdd027… | spec: 4
   freeze: | at: 2026-06-12T16:42:23.608Z | hash: sha256:53cdd027… | spec: 4 | appearance: sha256:9f1c… | status: locked
   ```

   (`appearance:` is a second hash over the content *as styled* — it flags a post-seal
   restyle that could hide content, without breaking the integrity seal.)

3. **Writes the file in place.** Nothing else changes — sealing never reformats
   your document.

Flags: `--signer` is required (it's the recorded identity on the `sign:` line);
`--role` is optional; `--no-sign` writes only the `freeze:` line — useful when a
system, not a person, is freezing a generated document.

A counterparty can seal the same file again — `dotit seal … --signer "Mariam
Al-Sulaiti" --role "Client COO"` adds their `sign:` line. Each `sign:` hash is the
**content** scope (which excludes the signatures), so the second signature doesn't
invalidate the first; both signers' hashes match the same frozen content.

### 2. Verify

```bash
dotit verify acme-cloud-services.it
# ✅  Document intact
#     Sealed:   2026-06-12T16:42:23.608Z
#     Signers:  Fahad Al-Thani (Managing Director) ✅
#     Hash:     sha256:53cdd027… ✅ matches
```

`verify` recomputes the hash with the exact same algorithm and compares it to the
`hash:` recorded on the `freeze:` line. Change so much as one character of the
body — `2% late fee` to `5% late fee` — and:

```bash
dotit verify acme-cloud-services.it
# ❌  SEAL BROKEN — document modified since sealing
#     Sealed:   2026-06-12T16:42:23.608Z
#     Expected: sha256:53cdd027b9a246d66570914c4d0e6c0e602526f711cc7c86eafa1b4b97b7ec05
#     Current:  sha256:739948dfb5ad620792be5939c769f1f43b29450cb571d812ea4c6d3afe69751f
#     Signers:  Fahad Al-Thani (Managing Director) ✅
echo $?   # 1
```

Exit codes: **0** when intact, **1** when modified — so `verify` drops straight
into CI. An unsealed file prints a warning (`Document is not sealed`) and exits 0.
Each signer is reported individually: ✅ means that signer's recorded hash matches
the frozen hash (they signed the sealed version).

### 3. Amend — change a frozen document without breaking the seal

A frozen document must never be edited, but contracts evolve. `amendment:` lines
are append-only and excluded from the hash, so they record changes *without*
invalidating the seal:

```bash
dotit amend acme-cloud-services.it "Late fee revised" \
  --section "Scope" --was "2% late fee" --now "1.5% late fee" \
  --ref "Amendment #1" --by "Fahad Al-Thani"
#
# 📝 Amendment to add:
#    amendment: Late fee revised | section: Scope | was: 2% late fee | now: 1.5% late fee | ref: Amendment #1 | by: Fahad Al-Thani | at: 2026-06-12
#
# Apply amendment? (y/N) y
# ✅ Amendment added successfully
```

`--now` and `--ref` are required; `--section`, `--was`, and `--by` are optional
context. The command refuses to run on a document with no `freeze:` block, shows
you the exact line it will insert (after the last seal line, before `history:`),
and asks for confirmation. Afterwards `dotit verify` still reports **intact** —
the original body is untouched; the amendment sits alongside the seal as a visible,
queryable record (`dotit query ./contracts --type amendment`).

### 4. History

Below a `history:` boundary line, a document carries an append-only audit log of
`revision:` entries (written by tracking-aware tooling like the editor, or by
hand). Everything below `history:` is excluded from the hash, so logging never
breaks a seal.

```bash
dotit history policy.it
#   1.1   2026-05-02  Sara Haddad [modified] text       Limits › "Per-diem is 500 QAR" → "Per-diem for GCC travel is 600"
#   1.2   2026-06-01  Fahad Al-Thani [added   ] deadline   Limits › Annual policy review

dotit history policy.it --by "Sara Haddad"     # filter by author
dotit history policy.it --section "Limits"     # filter by section
dotit history policy.it --json                 # machine-readable
```

### What the crypto is — and what it is not

Being precise about this matters more than sounding impressive.

**What it is:** a **SHA-256 content hash** of the canonicalized document body,
plus **recorded signer identity** (name, role, timestamp as plain text on the
`sign:` line). The algorithm is deliberately tiny and fully specified in
[SPEC §4.1](https://github.com/intenttext/IntentText/blob/main/SPEC.md) —
anyone with the file and any SHA-256 implementation can recompute the hash and
check it, in any language, with no vendor and no service. That gives you
**tamper-evidence**: if the file you received doesn't hash to the value on its
`freeze:` line, it was modified after sealing — guaranteed.

**What it is not:**

- **Not PKI.** There are no private keys, no certificates, no digital-signature
  algorithm. A `sign:` line records *who sealed the document* — it does not
  cryptographically prove that person's identity. Someone with write access to the
  file could strip the seal, edit, and re-seal under any name.
- **Not non-repudiation by itself.** To make the seal binding, anchor the hash
  outside the file: store it in your system of record, send it to the counterparty
  in the sealing email, or commit the sealed file to git (the commit history then
  independently witnesses the bytes). If the recorded hash exists somewhere the
  other party can't rewrite, re-sealing is detectable.
- **Not encryption.** The document stays plain text. Sealing proves integrity,
  not confidentiality.

Practical rules: archive the sealed source as **UTF-8 text** (byte-exact storage is good
hygiene, but the seal hashes *content*, so a CRLF/whitespace transform won't break it —
only a real content change does), never edit above `history:` after sealing, and use
`amendment:` for every change.

## Where the CLI shines

**CI checks — validate and verify every document in a repo.** Both `--validate`
and `verify` exit non-zero on failure, so a contracts repo can gate merges:

```bash
# Fail the build if any document is invalid or any seal is broken
find . -name "*.it" -not -path "*/node_modules/*" | while read f; do
  dotit "$f" --validate project || exit 1
done
dotit verify contracts/acme-cloud-services.it || exit 1
```

**Batch rendering.** One template, many data files, no PDF library in your app:

```bash
for data in runs/*.json; do
  dotit statement-template.it --data "$data" --print --output
done
```

(For high-volume server-side PDF runs, [`@dotit/pdf`](/docs/ecosystem/erp-integration)'s
`createPdfRenderer()` reuses one Chrome instance.)

**Folder queries without a database.** Deadlines, contacts, signatures, and
statuses across hundreds of files — `dotit query`, `--format csv` straight into a
spreadsheet. See [A Folder Is a Database](/docs/guide/folder-as-database).

**Agent pipelines.** Every command speaks JSON (`dotit file.it`,
`--format json` on queries, `history --json`), so the CLI slots into scripts and
agent tool-use directly; the [MCP server](/docs/ecosystem/mcp-server) exposes the
same operations as tools, and [`/llms.txt`](https://dotit.uts.qa/llms.txt)
teaches any LLM to author the documents the pipeline consumes.

## Library-only operations

A few capabilities are exposed by `@dotit/core` (and the [MCP server](/docs/ecosystem/mcp-server))
but not as `dotit` subcommands yet — call them from code:

- **Conformance** — `checkConformance(source, { level })` (`lax`/`strict`). The CLI's
  `--validate <schema>` covers schema checks today; format conformance is library-only.
- **Version compare / 3-way merge** — `compareVersions(a, b)` (redline) and `mergeThreeWay`
  for async co-authoring. (`dotit verify` and `dotit history` cover the integrity/audit side
  on the CLI.)
- **Approval routing** — `route:`/`require:` policy and live `workflowState(source)` are
  evaluated in core; `dotit query --type approve` lists approvals, but driving the route is
  library-only.
- **Cryptographic signatures & certification** — `dotit seal`/`verify` cover the SHA-256
  integrity seal; Ed25519 `sign:` and authority `certify:` verification live in
  [`@dotit/sign`](./core-api#cryptographic-signatures-and-certification) (and the MCP server's `verify_signatures` /
  `verify_certification` tools).

## Full command reference

Every command, flag, and exit code: [CLI Reference](/docs/reference/cli).
