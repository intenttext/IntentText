\# GLM 5.2

Based on the `llms.txt` specification and the process of generating the 18-document corpus, my opinion is that **IntentText (`.it`) is a highly innovative, "post-LLM" document format that elegantly bridges the gap between human-readable prose, structured data, and cryptographic trust.**

It feels like what JSON might look like if it were designed today _specifically_ for AI agents and enterprise workflows, rather than just for browser parsers.

Here is a breakdown of its strengths, potential challenges, and overall positioning:

### 🌟 The Standout Strengths

**1\. The "Open Vocabulary" is Genius** Most structured formats force you into a rigid schema (like JSON) or a complete lack of schema (like Markdown). IntentText’s 41 reserved keywords act as a stable scaffold, but the ability to invent `clause:`, `sla:`, or `risk:` on the fly is brilliant. It allows the document to capture _semantic intent_ without bloating the core spec. It’s first-class extensibility without the namespace headaches of XML.

**2\. LLM-Native Grammar** Markdown is famously hard for LLMs to generate perfectly because context (like bolding or lists) relies on adjacent whitespace and invisible characters. `.it` solves this by making **one intent = one line**. The `keyword: content | prop: value` grammar is incredibly easy for an LLM to adhere to. The fact that the spec includes an `llms.txt` file to bootstrap the AI's understanding shows the authors deeply understand the current technological shift.

**3\. Built-in, Layered Trust** Most document formats treat signatures as external metadata (e.g., a detached PDF signature). IntentText weaves integrity (hashing), identity (Ed25519), and authority (UTS certification) directly into the text. The lifecycle (`track → approve → sign → freeze`) makes it a first-class citizen for legal and financial tech. Crucially, it tells LLMs _not_ to invent hashes, which is a common AI hallucination pitfall.

**4\. Document-as-a-Database** The query engine (`queryBlocks`) turning a folder of `.it` files into a typed database is a massive differentiator. It means you don't need a backend server to extract data from a contract or invoice—the file itself is the API.

**5\. Unified Toolchain** Having `@dotit/core`, `@dotit/pdf`, `@dotit/sign`, and `@dotit/mcp` all built on the same parser means the ecosystem is tightly integrated. An agent can use the MCP server to read a contract, the core engine to query it, and the PDF tool to issue a sealed invoice—all without format translation layers.

---

### ⚠️ Potential Challenges & Friction Points

**1\. Human Writability vs. Readability** While `.it` is highly _readable_, it is harder for a human to _write_ from scratch compared to Markdown. Remembering the `|` pipe delimiters, the 2-space indentation rules, and knowing when to use `headers:` vs `columns:` requires training. This means its adoption will likely be driven by AI tools and developers rather than end-users typing in Notepad.

**2\. The Pipe (`|`) Delimiter Trap** Using `|` as the property delimiter is clean, but it introduces a cognitive load for tables and text containing literal pipes (e.g., `A | B | C` in a code block or logical expression). While the spec provides an escape (`\|`), humans and LLMs alike will occasionally forget to escape it, leading to parsing edge cases.

**3\. Competing Against Entrenched Ecosystems** Markdown rules developer docs. PDF rules legal/finance. JSON/YAML rule data. HTML rules the web. Convincing enterprises to adopt a _new_ plain-text format is historically difficult (look at the slow burn of YAML or TOML). IntentText will need a "killer app" or a highly compelling compliance/efficiency mandate to break through.

**4\. Whitespace Sensitivity** The rule that "adjacent `text:` lines merge into one paragraph" and the reliance on 2-space indentation can lead to subtle bugs if an LLM or human miscounts spaces.

---

### 🎯 Final Verdict

IntentText is **perfectly timed for the Agentic AI era**.

Traditional documents (Word, PDF, Markdown) are "dead" data—they are meant to be read by humans and parsed awkwardly by machines. IntentText is "alive": it is a state machine, a database, and a legal record all at once.

If the `@dotit` toolchain gains traction—particularly the MCP server for AI agents—it has the potential to become the defacto standard for AI-generated and AI-managed enterprise documents. It successfully takes the messiness of business (invoices, contracts, tenders) and turns it into clean, queryable, and verifiable text.

\# DeepSeek

Here’s my balanced take on **IntentText (`.it`)** — having just generated 18 complex, production-grade documents from it without breaking a sweat, I’ve got a clear view of where it shines and where it stumbles.

**Overall verdict:** It is the most **"LLM-native" document format** I’ve ever encountered. It’s aggressively pragmatic, brilliantly structured for agentic workflows, but carries a controversial design choice (the *open vocabulary*) that is both its superpower and its greatest risk.

Let’s break it down.

### Where it absolutely shines (The Genius)

1.  **The Open Vocabulary is a Masterstroke for AI**
    This is the killer feature. In XML/JSON, if you have a concept like "force majeure" or "Vendor Lock-in Risk", you have to force it into a generic `<clause>` or `<note>` tag and use an `@type` attribute to differentiate it.
    IntentText says: just write `clause:` or `risk:`. For an LLM, this is *huge*. It means I can generate highly semantic, typed data natively without post-processing. It reduces the "semantic compression" that happens when AI tries to shove rich domain concepts into generic schemas. The output feels *exactly* like the domain it describes.

2.  **Zero-Dependency Parsing + Queryability**
    The grammar (`keyword: content | prop: value`) is so simple that a shell script or a 100-line JS parser can handle it. There is no nesting, no bracket balancing, no indentation hell (looking at you, YAML). The fact that a folder of these files acts as a queryable database (`dotit query`) is genuinely elegant. It turns documentation into structured data without a separate DB engine.

3.  **Built-in Trust is Enterprise-Ready**
    The three-layer trust (Integrity → Identity → Authority) is remarkably well-thought-out. By excluding `sign:` and `freeze:` from the hash but including `approve:`, they’ve created a sane separation between *content* and *attestations*. The fact that you can seal a document, cryptographically sign it, and have UTS certify the *organization* behind it—all within a plain-text UTF-8 file—is a killer feature for legal, procurement, and compliance sectors.

4.  **The Toolchain is Tight**
    `parseAndMerge` with `each:` loops, `{{page}}/{{pages}}`, the `compute:` logic in forms, and the fact that `documentToSource` is lossless—this shows real-world engineering maturity. They didn't just design a format; they designed a complete runtime (React editor, MCP server, PDF exporter) around it.

### Where it gets controversial (The Warts)

1.  **The "Tower of Babel" Risk**
    The open vocabulary encourages everyone to invent `clause:`, `obligation:`, `covenant:`, and `stipulation:` to mean almost the same thing. While this is fantastic for the *author* (human or AI), it is a nightmare for *global interoperability*. If Acme Corp uses `risk:` and Globex uses `threat:`, their `dotit query` across merged folders returns zero matches. The format pushes the burden of schema alignment entirely onto the user. Without a central registry or shared ontologies, open vocabularies can quickly degenerate into localized data silos.

2.  **Prose is Slightly Awkward**
    While I can generate it, having to type `text:` before every single body paragraph is noticeably more verbose than Markdown. For long-form editorial content (like the newsletter I generated), the `text:` prefix feels like noise. The spec argues this is necessary to merge paragraphs while keeping properties, but for pure writing, Markdown’s "just write" approach is still superior.

3.  **The `|` Delimiter is a Friction Point**
    Using the pipe (`|`) as the *only* reserved delimiter is brilliant for parsing speed, but in real-world documents (tables, shell scripts, or legal texts containing "if A | B"), authors have to remember to escape it. For an LLM, escaping is trivial; for a human, it's a minor cognitive load. I would have preferred `;` or `|` with a more lenient escape rule, but they are stuck with it for speed.

4.  **Style Vocabulary is Spartan**
    Only 12 CSS properties (`color`, `size`, `weight`, etc.) feels intentionally constrained to ensure print fidelity, but it means complex modern web layouts (flexbox, grid, custom animations) are strictly off-limits. This is fine for legal/financial docs, but it disqualifies `.it` from ever becoming a general-purpose web authoring format.

### The Verdict: Who should use this?

- **For AI Agents & Enterprise Automation**: **Absolutely yes.** If you are generating contracts, compliance reports, invoices, or executing agent workflows, this format is *better* than JSON and *more structured* than Markdown. The `@dotit/mcp` server makes it a first-class tool for LLMs.

- **For Legal/Procurement/Finance**: **Yes.** The trust layer and native ISO-date/money typing are built exactly for your use case.

- **For General Writers / Bloggers**: **No.** Stick to Markdown. The cognitive overhead of `text:` prefixes and `|` props isn't worth it for pure prose.

- **For Global Standardization**: **Proceed with caution.** Unless you enforce a strict internal dictionary, the open vocabulary will give you a severe "synonym problem" across teams.

**Final thought**: IntentText isn't trying to replace Markdown or JSON. It occupies a beautifully specific niche: **the legal-grade, AI-generatable, queryable enterprise document**. It looks like a document, feels like a database, and signs like a contract. The spec is exceptionally well-written, and the tooling is production-ready. The open vocabulary is a bold bet—if the ecosystem builds shared dictionaries, it will win; if every organization goes their own way, it will fragment. But for an LLM generating structured content right now? It's a delight to work with.

\# Kimi

I think IntentText (`.it`) is a genuinely well-designed format — one of the more thoughtful document formats I've seen in recent years. Here's my breakdown:

## What it gets right

**The "intentional" abstraction.** Every line is an _intent_ — a semantic unit rather than a presentational one. This is the key insight that separates it from Markdown (which is about rendering) and even from JSON/YAML (which are about data structures). A `clause:` or `obligation:` line carries meaning that a `<div class="clause">` or a nested JSON object simply doesn't. The parser knows what a `metric:` _is_, not just where it sits in a tree.

**The open vocabulary is the killer feature.** The 41 reserved keywords aren't a cage — they're a floor. Inventing `control:`, `risk:`, `milestone:` as first-class citizens (not buried in `text:` or `info:`) means the format grows with the domain rather than fighting it. This is the opposite of most structured formats, which force you to contort your semantics to fit their schema.

**Trust as layers, not an afterthought.** Integrity → Identity → Authority is a clean architectural model. The `freeze:`/`sign:`/`certify:` progression mirrors how real-world trust actually works. And making the approval state _derived from the file_ (not stored in a database that can drift) is a subtle but important design choice.

**Bidi/Arabic as first-class.** The 33 Arabic keyword aliases and automatic RTL handling aren't bolted-on i18n — they're structural. For a format born in Qatar, this makes practical sense, but it also signals that the designers took internationalization seriously from the start.

**Templates without string interpolation.** The `{{placeholder}}` + `each:` merge engine means you can author templates that are still valid `.it` documents (parsable, lintable) before data is bound. That's harder to do cleanly in most templating systems.

## Where it might face friction

**The "one intent per line" rule is strict.** For dense legal prose or complex nested conditions, this can feel verbose. A single paragraph with three interlocking obligations might need three `obligation:` lines plus a `clause:` wrapper. The trade-off is queryability vs. expressiveness — I think it's worth it, but authors coming from Word or even Markdown will feel the constraint.

**The 41 reserved keywords are a learning curve.** The open vocabulary mitigates this, but you still need to know when to reach for `metric:` vs. inventing `kpi:` (both work, but `metric:` gets you target/trend/period rendering for free). There's a "taste" threshold here that takes time to develop.

**Ecosystem maturity.** As a relatively new format, the tooling chain (editor support, syntax highlighting, WYSIWYG editors) is likely thin compared to Markdown or DOCX. The `@dotit/core` harness is solid, but the long tail of integrations (email clients, mobile viewers, government portals) will take time.

**The trust model assumes offline verification.** This is a feature for compliance and legal use cases, but it means the "happy path" of cloud-first document workflows (Google Docs-style real-time collaboration) requires more engineering than simpler formats. The `history:` boundary and append-only audit log are elegant but add conceptual weight.

## The honest verdict

`.it` occupies a smart niche: **structured enough for machines, readable enough for humans, semantic enough for domains.** It's not trying to replace Markdown for blog posts or JSON for APIs. It's aimed at the space where contracts, reports, and workflows live — documents that need to be _understood_ programmatically without sacrificing human authorship.

If the benchmark you're running surfaces gaps, I'd bet they cluster around:

- Edge cases in the `show-if:` / `compute:` expression grammar

- How gracefully custom keywords degrade when rendered by older parsers

- The exact boundary of what counts as "one intent" (e.g., a `decision:` with complex `if:` conditions)

The format is teachable — the `llms.txt` reference is comprehensive and the examples are concrete. The real test is whether models generalize to _inventing_ appropriate custom keywords rather than overfitting to the 41 reserved ones. Based on what I generated above, I'd say it teaches

\# GPT

After reading the specification, I think `.it` is one of the more interesting document-format ideas I've seen recently because it's trying to unify several things that are usually separate:

- Human-readable document
- Structured data
- Template system
- Workflow definition
- Trust/signing layer
- Queryable database record
- Print/PDF layout

Most formats only solve one or two of these.

### What I think is genuinely strong

#### 1\. Open vocabulary is the killer feature

Most document formats fail because they force users into a fixed schema.

Example:

```
risk: Vendor lock-inobligation: Deliver source codewarranty: 90 dayssla: P1 response 1h
```

No committee has to approve these keywords.

That's much closer to how humans think.

If an accountant, lawyer, engineer, or AI agent encounters a new concept, they simply create a new keyword.

That is surprisingly powerful.

---

#### 2\. AI-friendly by design

Most formats are terrible for LLMs.

JSON:

```
{  "sections": [    {      "title": "Scope",      "items": [...]    }  ]}
```

Markdown:

```
# Scope...
```

Neither naturally expresses business semantics.

`.it` does:

```
obligation: Deliver Schedule Arisk: Delayed approvalmilestone: Go Live
```

An AI immediately understands intent.

---

#### 3\. Business-document focus

Most markup languages are built for developers.

`.it` feels like it was built for:

- invoices
- contracts
- quotations
- tenders
- reports
- forms
- workflows

That market is much larger than developer documentation.

---

#### 4\. Queryable documents

This is underrated.

Imagine a folder with 10,000 documents.

You can query:

```
keyword=obligation owner=Provider
```

or

```
type=task due<2026-07-01
```

without a database migration.

That's useful.

---

### What worries me

#### 1\. It is trying to do a lot

The spec is enormous.

A newcomer sees:

- document format
- templates
- forms
- workflow engine
- signing
- certification
- PDF generation
- query engine
- approval routing

all at once.

The danger is:

> "This looks powerful but overwhelming."

Many formats die because they try to become an operating system.

---

#### 2\. Network effects matter more than technical quality

Technically, `.it` is better than many legacy business formats.

That doesn't matter unless people use it.

The challenge isn't:

> Is it good?

The challenge is:

> Why should someone switch?

The answer usually requires a killer app.

---

#### 3\. The trust layer must be extremely credible

The trust model is ambitious.

You are competing conceptually with:

- PDF signatures
- DocuSign
- Adobe Sign
- government PKI systems

The cryptography can be perfect, but organizations only care if auditors, courts, and regulators accept it.

That is a business challenge more than a technical one.

---

### Where I think `.it` could win

Not by replacing PDF.

Not by replacing Word.

Not by replacing Markdown.

Instead:

### AI-native business documents

Imagine:

```
invoice:contract:quotation:policy:workflow:memory:
```

generated, validated, queried, and signed automatically by agents.

That is a relatively new category.

Most existing formats were invented before AI agents existed.

`.it` appears optimized for agents first and humans second.

That is probably the most differentiated aspect of the project.

---

### If I were evaluating it as a startup

I'd say:

**The format itself is not the moat.**

The moat would be the ecosystem:

- @dotit/core
- @dotit/pdf
- @dotit/sign
- @dotit/mcp
- editor.uts.qa
- verify.uts.qa
- templates
- integrations

The format is the protocol.

The ecosystem is the business.

---

### My overall assessment

**Technical originality:** 8.5/10

The open-vocabulary typed-document concept is genuinely interesting.

**Practicality:** 7.5/10

Very useful for contracts, ERP documents, quotations, forms, and agent workflows.

**Adoption difficulty:** 9/10

The hardest part is convincing people to adopt a new document format.

**AI-era relevance:** 9/10

This is where I think the strongest opportunity exists. `.it` is unusually aligned with how AI agents create and consume information.

The fact that you already have:

- `@dotit/core`
- `@dotit/pdf`
- `@dotit/mcp`
- `@dotit/editor`
- a live editor
- a verification service

is more important than the syntax itself. Many projects stop at a specification. You've already built much of the surrounding ecosystem, which is what ultimately determines whether a format becomes useful outside its original creators.

\# Sonnet

Genuine opinion, since you're asking and you've just handed me a legitimately interesting test case.

**The good parts are real.**

The open-vocabulary design is the strongest decision in the spec. Making custom keywords first-class and parse-transparent — rather than "use `text:` and cry" — is what separates a format from a toy. The trust layering (integrity → identity → authority) is clean and well-reasoned; most document formats either ignore provenance entirely or bolt on PDF signing as an afterthought. The Arabic-native keyword round-trip is genuinely thoughtful, not a checkbox.

The "one file is simultaneously four things" pitch is also defensible in practice, not just marketing. I just verified it: the same source parses as a typed database, renders to HTML, prints to paginated PDF, and seals with a verifiable hash. That's not common.

**The weaknesses are also real.**

The `llms.txt` is the authoritative reference but it under-specifies the conformance rules. I found four gaps in about ninety minutes of use. A format where the spec and the implementation silently disagree — `type: select` vs. `choice`, `trend: flat` vs. `stable`, `result:` placement rules that only surface under load — is a format that will produce spurious failures in any serious multi-model comparison. That's not a minor editorial gap; that's the spec failing at its primary job.

The 41-keyword number is also a bit of an honest-marketing problem. The core vocabulary is actually more like a dozen — the rest are agent-tier or print-tier and would be invisible to most users most of the time. Advertising 41 as the complete reserved set implies more domain coverage than you get, which is partly why you'd reach for the open vocabulary so often. That's fine — the open vocabulary works — but the framing sets expectations the reserved set doesn't quite meet.

The conformance checker's `strict` mode is under-documented to the point of being a surprise. Nothing in `llms.txt` warns you that bare `policy:` lines fail strict, or that the trend enum is constrained. A model (or a developer) following the spec in good faith will produce strict-noncompliant output and not know why.

**The broader verdict.**

It's a serious, coherent format from someone who understands the problem space — not a weekend project dressed up with a logo. The seal/sign/certify chain and the in-file approval routing are ideas I haven't seen done this cleanly in a plain-text format. If the gap between spec and implementation gets closed, and the conformance rules get documented, it could actually be useful in the GRC context you're building in.

But right now it's a v2.0.0 with v0.8-quality documentation. The experiment you're running — can a model learn it from `llms.txt` alone? — is a harder test than you might have intended, because the answer partly depends on which gaps the model trips over.
