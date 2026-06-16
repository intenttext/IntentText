---
title: Config & Options (a readable alternative to YAML/JSON)
description: Use .it as a configuration / options file — plain text, no whitespace traps, with comments, types, and (uniquely) signed, approved, tamper-evident config.
---

# Config & options — a readable alternative to YAML/JSON

`.it` isn't only for documents. Because it parses to a clean structured model and
round-trips losslessly, it makes an excellent **configuration / options file** — and
it removes the things people dislike about YAML while adding something neither YAML
nor JSON can do.

## Why not YAML?

YAML's pain is real: **significant whitespace** (one wrong indent and the meaning
changes), **type surprises** (`no` becomes `false`, `NO` the country code becomes a
boolean — the "Norway problem"), and config that's easy to mistype and hard to
trust. JSON fixes the types but has **no comments** and is noisy to hand-write.

`.it` keeps config as **flat, readable plain text**:

```text
// app config — readable, comment-able, no indentation traps
meta: | type: config | env: production
flag: new-checkout   | enabled: yes
flag: ai-suggestions | enabled: no
limit: max-upload-mb | value: 50
limit: rate-per-min  | value: 600
```

- **No significant whitespace** — `key: value | key: value` on one line; indentation
  is cosmetic, never meaning. (The thing that makes you leave a tool over its YAML.)
- **Comments** with `//`, anywhere.
- **Explicit, queryable values** — read them with `parseIntentText` + `flattenBlocks`,
  or query across files.

```ts
import { parseIntentText, flattenBlocks } from "@dotit/core";

const cfg = parseIntentText(source);
const flags = Object.fromEntries(
  flattenBlocks(cfg.blocks)
    .filter((b) => b.properties?.keyword === "flag")
    .map((b) => [b.content, b.properties?.enabled === "yes"]),
);
// → { "new-checkout": true, "ai-suggestions": false }
```

## The part YAML and JSON can't do: **trusted config**

A `.it` config can be **sealed, signed, approved, and hash-chain-audited**. So your
app can refuse to apply a config that wasn't approved or that was tampered with —
*answered from the file alone, offline*:

```text
meta: | type: config | env: production
flag: new-checkout | enabled: yes

route: sequential
require: release-manager
require: security
approve: shipped to prod | by: Sarah | role: release-manager | at: 2026-06-16 | prev: sha256:…
approve: reviewed        | by: Omar  | role: security        | at: 2026-06-16 | prev: sha256:…
sign: Sarah | role: release-manager | at: … | hash: …
freeze: | at: … | hash: … | status: locked
```

```ts
import { verifyDocument, workflowState, verifyAuditChain } from "@dotit/core";

if (!verifyDocument(src).intact) throw new Error("config tampered — refusing to apply");
if (!workflowState(src).complete) throw new Error("config not fully approved");
if (!verifyAuditChain(src).valid) throw new Error("approval trail was altered");
// safe to apply
```

That's **config-as-code with provenance**: who approved this production change, in
what order, and proof it hasn't been altered — none of which YAML or JSON can carry.
See [Trust & Signing](./trust-and-signing) and [Forms, Review & Compliance](./forms-and-workflows).

## Is `.it` the same data as JSON?

Close, and losslessly inter-convertible **with itself**: `parseIntentText(source)`
gives a JSON model, and `documentToSource(model)` reproduces the source **byte-for-byte**
(so a sealed config keeps its hash through a save). Note the shapes differ — `.it`
is an *ordered list of typed blocks with `key: value` properties*, JSON is arbitrary
nested objects/arrays:

- `.it → its JSON model → .it` — **lossless** (guaranteed and tested).
- *Config-shaped* JSON (sections + key/value + lists) maps cleanly both ways.

## Honest limits — what it is and isn't

- ✅ **Great for**: app/feature-flag config, environment settings, limits, ordered
  pipelines/steps, and anything you'd reach for a `.env`/`.yaml`/`.json` for and wish
  were readable, commentable, and trustworthy.
- ⚠️ **Not a drop-in for deeply nested manifests.** Kubernetes-style specs
  (`spec.template.spec.containers[].resources.limits…`) are deep object trees; `.it`'s
  model is flat-ish blocks, so very deep nesting needs a deliberate mapping rather than
  a 1:1 paste. `.it` solves YAML's *readability and trust* pain for the bulk of
  human-authored config — it doesn't try to be a general nested-object serializer.

In short: for the config that makes people hate YAML, `.it` is plainer, has comments
and clear types — and can prove who approved it and that it's intact.
