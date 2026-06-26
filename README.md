<p align="center">
  <img src="icon.png" alt="IntentText icon" width="96" />
</p>

<h1 align="center">IntentText (.it)</h1>

<p align="center">
  <b>A document format where the file itself is the data.</b><br>
  Write it like a note. Search it like a spreadsheet. Lock it like a contract. Hand it to an AI.
</p>

<p align="center">
  <a href="https://dotit.uts.qa">Docs</a> ·
  <a href="https://hub.dotit.uts.qa">Hub</a> ·
  <a href="https://editor.uts.qa"><b>Try the editor</b></a> ·
  <a href="https://npmjs.com/package/@dotit/core">npm</a> ·
  <a href="https://dotit.uts.qa/llms.txt">llms.txt</a> ·
  <a href="https://dotit.uts.qa/llms.it">llms.it</a> ·
  <a href="https://x.com/IntentText">Twitter</a>
</p>

---

<div align="center">

| Format | People can read it | Computers can use it | Tamper-proof |
|---|:---:|:---:|:---:|
| Word | ✅ | ❌ | ❌ |
| PDF | ✅ | ❌ | ⚠️ |
| JSON / YAML | ❌ | ✅ | ❌ |
| Markdown | ✅ | ⚠️ | ❌ |
| **IntentText (.it)** | ✅ | ✅ | ✅ |

</div>

<p align="center">
  <b>Free &amp; open source (MIT).</b> No install to read it. Already in production inside a commercial ERP.<br>
  <b>Not a developer?</b> Try it free in your browser → <a href="https://editor.uts.qa"><b>editor.uts.qa</b></a>
</p>

---

## The idea in one line

A signed contract and the database record that tracks it are the **same agreement kept twice** — and
the two copies drift. IntentText keeps **one file that is both**: a document people read *and* the
data software uses. No second copy, no system to sync.

## See it

You write plain text like this:

```intenttext
title: Master Service Agreement
meta: | ref: MSA-2026-007

approve: Commercial terms | by: Sarah Chen | role: Finance Director | at: 2026-06-10
approve: Legal review | by: Omar Khalid | role: General Counsel | at: 2026-06-11
sign: Ahmed Al-Rashid | role: CEO | at: 2026-06-12
freeze: | status: locked
```

You get a clean, approved, signed, **tamper-proof** document — rendered automatically, printable to
PDF, and verifiable by anyone offline, with no special software:

<p align="center">
  <img src="https://dotit.uts.qa/img/landing-trust.png" alt="The same file rendered: two approvals, a verified CEO signature, and a SHA-256 seal" width="760" />
</p>

And because every line is also data, a folder of these answers *"every contract signed by the CEO
this quarter"* in **one step — no database.**

## Your first `.it` in 60 seconds

A plain line is simply a paragraph. Write naturally:

```intenttext
Welcome to the Riverside project kickoff.
```

When a line *means* something, just say so — `keyword: value`:

```intenttext
task: Draft the budget | owner: Sara | due: 2026-07-15
deadline: Permit filing | date: 2026-08-01
```

**That's the whole format:** plain prose, plus `keyword: value` when a line carries meaning. No tags
to close, no schema to learn, nothing to install. Software can already find that task and sort that
deadline — because every line says what it is. Invent any keyword you need (`risk:`, `invoice:`,
`مصروف:`); it works in any language and never breaks.

> **▶ Try it free in your browser — [editor.uts.qa](https://editor.uts.qa)** · nothing to install.

## One file, every job

The same `.it` file — no conversion, no second copy — is at once:

- **A document** people read — plain text that opens anywhere and reads naturally in Arabic & RTL.
- **A database** you search — filter or total any field across a whole folder, or ask in plain English.
- **A template** you fill from data — `{{placeholders}}` → invoices, contracts, or letters by the thousand.
- **A form** people fill in and sign — fields, logic, signatures; answers come back as data, not a flat PDF.
- **A print-ready PDF** — branded themes, page numbers, multi-page tables, accessible & archival output.
- **A sealed, self-auditing record** — tamper-proof, offline-verifiable, with a built-in history of every change.

It's just as natural for **AI assistants** (they read, write, and verify `.it` directly) and for
**governments & archives** (offline-verifiable for decades; your Word/PDF/Excel files convert *into*
it). Guides: [for organizations](https://dotit.uts.qa/docs/guide/for-organizations) ·
[for agents](https://dotit.uts.qa/docs/guide/for-agents) ·
[for writers](https://dotit.uts.qa/docs/guide/for-writers).

---

## For developers

Everything above is all most people need. To build `.it` *into software*:

```bash
npm install -g @dotit/core            # the `dotit` command + zero-dependency library
```

```bash
dotit contract.it --html --theme corporate   # render (also --print, --pdf)
dotit notes.md --to-it                        # import Word/Markdown/HTML/Excel → .it
dotit query ./contracts --type deadline       # query a folder like a database
dotit seal contract.it --signer "F. Al-Thani" --role "MD"   # seal; `dotit verify` checks it
```

```js
const { parseIntentText, queryDocument, renderHTML } = require("@dotit/core");
const doc = parseIntentText("task: Ship auth | owner: Ahmed | priority: high");
queryDocument(doc, { type: "task", properties: { priority: "high" } });
```

**Full guide → [INTEGRATION.md](INTEGRATION.md)** (format crash course, every package, full CLI & API,
ERP/AI recipes) · everything `.it` can do → [Capabilities](https://dotit.uts.qa/docs/guide/capabilities)
· teach an LLM the format in one read → [llms.txt](https://dotit.uts.qa/llms.txt).

**Packages:** `@dotit/core` (parse/render/query/merge/trust/forms/convert/CLI, zero-dep) ·
`@dotit/editor` (React editor) · `@dotit/pdf` (server PDFs, incl. court-recognized PAdES & archival
PDF/A) · `@dotit/sign` (Ed25519) · `@dotit/pades` · `@dotit/math` · `@dotit/mcp` (AI/MCP) · VS Code
extension. All **3.0**, MIT.

## Status — production-ready

Running in production as the embedded report engine of a commercial ERP. **1,600+ tests** (including
a fuzz/byte-preservation gate). The format is **frozen**: 13 core / 40 reserved keywords, `SEAL_SPEC 4`,
with CI gates that fail on any drift. Unknown keywords never error — open vocabulary is conformant by design.

## License

MIT — free and open source. Use it commercially, fork it, build on it; the format is yours.
