# Verify — proving the claims are true

This folder turns IntentText's trust claims into things you can **run**, not just read.

| File | What it is |
| --- | --- |
| [`claims.it`](claims.it) | The claims-verification checklist — itself a `.it` document (it dogfoods the format and round-trips byte-for-byte). |
| [`verify-claims.mjs`](verify-claims.mjs) | A runnable script (27 assertions) that proves each claim against the built `@dotit/*` packages — integrity, byte preservation, storage, authenticity, workflow state, audit chain, time honesty. |

The deepest guarantee — byte preservation — is proven separately and continuously by a
**property-based gate** that generates thousands of random documents (arbitrary property
order, bare and explicit injected-default keywords, sealed docs, surgical edits) and asserts
the round-trip holds for every one:
[`packages/core/tests/byte-preservation.test.ts`](../packages/core/tests/byte-preservation.test.ts).

## Run it

```bash
# from the repo root
pnpm -r build                                  # build the packages once

node verify/verify-claims.mjs                  # the 27-assertion claim pass
cd packages/core && npx vitest run tests/byte-preservation.test.ts   # the property-based gate
```

A clean run prints `✅ Every claim holds. IntentText trust is real.` and exits 0; any failed
claim exits non-zero and names what broke.

## The invariant that must never break

> `documentToSource(parseIntentText(x)) === x` for every well-formed document `x`.

This is the foundation of trust: a sealed `.it` keeps its hash through editing, storage, and
round-tripping only if parse → serialize is the identity. The property-based gate is what
keeps that true as the format evolves — it is a **release gate**: core does not ship if it is
red.
