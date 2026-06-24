# Plan — A Rust→WASM Core for `.it` (multi-language, government, scale)

**Status:** plan only (no code). **Trigger to start:** a concrete non-JS / no-Node consumer
(government tender, Python/Go/Java/.NET backend) **or** a scale requirement the TS core can't
meet. Until then, only **Phase 0** (conformance vectors) is worth doing.

This plan assumes the format is **frozen** (no grammar changes) — which is what makes a second
engine safe to attempt: there is no moving target to chase.

---

## 0. Prior art & authority — read this first

This is **not greenfield**, and it reverses a deliberate decision. Per
[`ARCHITECTURE.md`](../ARCHITECTURE.md) (authoritative):

- Earlier versions (≤ v3.3) routed parsing through a **Rust/WASM core *and* a separate Python
  parser**. **Both were removed** — Rust/WASM in v3.4.0, the duplicates in the v4.1
  finalization — to make **`@dotit/core` (TypeScript) the single canonical implementation**.
- ARCHITECTURE.md still states: *"No other language re-implements the grammar."*

**Why they were removed:** maintaining a *duplicate hand-written engine* alongside TS meant two
things to keep byte-identical, and they drifted — exactly the seal-divergence hazard in §1.

**Why this plan is different (the lesson applied):**
1. **One engine, not a duplicate.** The Rust core becomes the *single* engine bound everywhere
   via WASM — it does not run *beside* a hand-maintained TS parser forever. TS stays canonical
   only until Rust passes 100% of the corpus; the end state is one kernel, many bindings.
2. **A mechanical equivalence gate (the corpus, §5)** that the prior attempt lacked — no engine
   ships until it reproduces the vectors byte-for-byte.
3. **Kernel-only scope** — the prior attempt entangled rendering; this is parse/hash/verify only.

**Consequence:** pursuing Phase 1+ is a conscious reversal of the "one TS implementation"
stance. It requires updating ARCHITECTURE.md and an explicit owner sign-off — it is not a
casual addition. Until then, TS remains the single source of truth and this stays a plan.

---

## 1. Why this exists — the one constraint that shapes everything

`.it`'s value is a **byte-exact, recomputable seal** (SHA-256 over canonicalized source,
SEAL_SPEC-versioned). That makes the architectural question *not* "which language" but:

> **one engine, or many?**

Many hand-written parsers = N chances for the canonicalization to drift by a single byte =
seals that verify in one language and fail in another. That is unacceptable for the trust
model. The current Python package already respects this (it *wraps* the TS CLI, never
re-implements the grammar).

**The clean way to reach every language is therefore: write the engine ONCE, bind it
EVERYWHERE.** A single Rust core compiled to **WASM** (plus optional native FFI) gives every
language **byte-identical** parse + hash + verify, with no per-language reimplementation.

Rust specifically: memory-safe, deterministic, no GC pauses (predictable at scale), tiny
static binaries (air-gap / gov friendly), first-class WASM, mature crypto (`ed25519-dalek`,
`sha2`).

---

## 2. Goals / non-goals

**Goals**
- One Rust engine for the **trust-critical, language-agnostic kernel**: parse, canonicalize,
  hash, verify, query, serialize, conformance.
- **Byte-identical** to the TS canonical core (enforced by a shared conformance corpus).
- Bindings for **JS/TS, Python, Go, Java, .NET** off the *same* artifact.
- **Government-grade**: offline, deterministic, reproducible builds, auditable, FIPS-friendly
  signature verification, long-term (decades) verifiability.
- **Scale**: parse/hash/verify **millions** of documents (batch + streaming + parallel).

**Non-goals (explicitly out of the Rust core)**
- **Rendering** — HTML / print / PDF / themes / the editor canvas stay in TS and per-stack.
  Presentation is large, non-trust-critical, and best done in each ecosystem.
- **Converters** (md/html/docx/xlsx) — stay in TS for now (not trust-critical).
- **Signing-key custody** — generating keys / holding private keys stays in `@dotit/sign`
  or each language's native crypto/HSM. The Rust core **verifies** signatures; it does not
  manage secrets.
- **Replacing the TS core for the web** — not initially. TS stays canonical until the Rust
  engine passes 100% of the corpus and soaks. Consolidation is an optional later phase.

---

## 3. Scope of the Rust kernel (`dotit-core`)

In priority order — this is exactly the subset that must be byte-identical:

1. **Parser** — line grammar → `IntentDocument` (typed blocks, properties, inline nodes,
   tables, lists, metadata lifting, trivia for round-trip). Matches `parser.ts`.
2. **Serializer** — `documentToSource` (lossless canonical round-trip).
3. **Canonicalizer + hash** — the SEAL_SPEC v0–v4 `CANONICALIZERS` (NFC, history-boundary cut,
   comment/styling exclusion, trust-line scoping, CRLF/trailing-WS normalization, signature
   identity, appearance hash). **This is the hard part and the whole point** — it must match
   `trust.ts` to the byte.
4. **Verify** — `verifyDocument` (intact, per-signer validity, spec/specOutdated,
   appearanceChanged) + **Ed25519 signature verification** (`@dotit/sign` semantics) +
   audit-chain verification.
5. **Query** — `queryBlocks` (type/keyword/property filters, ISO-date-aware comparisons,
   sort, limit/offset) + the per-folder `.it-index`.
6. **Conformance** — `checkConformance` (lax/strict) over the structural + semantic diagnostics.

---

## 4. Architecture & distribution

```
                         ┌──────────────────────────┐
                         │   dotit-core  (Rust crate)│   ← single source of truth for the kernel
                         │  parse · canon · hash ·   │
                         │  verify · query · serialize│
                         └─────────────┬─────────────┘
                  ┌────────────────────┼─────────────────────┐
            wasm32-*  (WASM)      cdylib / staticlib (C ABI)   (native CLI)
                  │                     │                         │
   ┌──────┬───────┼─────────┬──────────┼───────────┐       single static binary
  JS/TS  Python   Go       Java        .NET        …          (air-gapped gov)
 (wasm)  (wasm/   (wazero) (Chicory/   (Wasmtime
         PyO3)              GraalWasm)  .NET / FFI)
```

**One artifact, many runtimes:**
- **JS/TS** — WASM + thin TS typings (`@dotit/core-wasm`). Can later replace the TS parser
  kernel (keep TS rendering).
- **Python** — either **WASM via `wasmtime-py`** (pure `pip`, **no Node**) or a **PyO3 native
  wheel** (`maturin`) for max speed. PyO3 wheels are the better DX (just `pip install`).
- **Go** — **`wazero`** (pure-Go WASM runtime, **no cgo** → static binaries, ideal for gov).
- **Java** — **Chicory** (pure-Java WASM) or **GraalWasm**; or JNI native.
- **.NET** — **Wasmtime.NET** or native P/Invoke.
- **Native CLI** — a single static `dotit` binary (musl) for air-gapped / archival use.

Each binding is thin (load module, marshal strings/JSON). The engine logic lives once.

---

## 5. The correctness contract (make-or-break)

A second engine is only safe with a **mechanical equivalence guarantee**:

1. **Conformance vector corpus** — `vectors/NNN.it` → expected `{ json, contentHash,
   sealHash, appearanceHash, conformance }`, **generated from the TS canonical core**. Cover
   every block type, trust scope, SEAL_SPEC version (v0–v4), RTL/Arabic, CRLF, edge cases.
   This is the artifact the freeze produces; it pins behavior forever.
2. **Every implementation runs the corpus in its own CI** — TS, Rust, and *each* language
   binding must reproduce it **byte-for-byte**. A mismatch fails the build.
3. **Differential fuzzing** — generate random `.it`, run TS and Rust, assert identical JSON +
   all hashes. Catches divergence the corpus didn't anticipate.
4. **Versioned canonicalizers ported verbatim** — `SEAL_SPEC` dispatch and v0–v4 rules are
   copied exactly; new spec versions are added in lock-step to both engines (rare, post-freeze).

> Rule: **the corpus is the spec's enforcement.** No binding ships until it is 100% green.

---

## 6. Government requirements

- **Offline / no network** — pure computation; no telemetry; verifiable in an air-gap.
- **Deterministic** — no `Date.now()`/`rand` in the hash path (already true in TS); identical
  output across OS/arch.
- **Reproducible builds** — pinned toolchain, vendored deps, `cargo --locked`; publish build
  provenance + **SBOM** (CycloneDX). Verifiable that the binary matches the source.
- **Minimal, audited supply chain** — few deps (`sha2`, `ed25519-dalek`, a WASM-free core);
  `cargo audit` / `cargo vet` in CI.
- **FIPS-friendly crypto** — Ed25519 verify via an audited lib; pluggable backend if a
  FIPS-validated module is mandated.
- **Long-term verifiability** — SEAL_SPEC is version-stamped, so a 2046 document still verifies
  under its recorded rules; ship the spec + corpus as archival artifacts.
- **Single static binary** — `x86_64/aarch64-unknown-linux-musl` `dotit verify` for archival
  workstations with no runtime.
- **Accessibility / records compliance** stays in the (TS) rendering layer, not the core.

---

## 7. Scale — millions of documents

- **Parallel batch** — hash/verify a corpus with `rayon`; bounded worker pool; linear scaling.
- **Streaming parse** — constant memory per document; never load a whole corpus at once.
- **Folder index in Rust** — the `.it-index` build/refresh/query path, the hot loop for
  "query 10M docs," moved off the per-call TS cost.
- **Zero-copy where safe** — parse over borrowed slices; avoid allocations in the hash path.
- **Targets (to be benchmarked, illustrative):** ≥100 MB/s parse+hash single-thread; ≥10k
  seal-verifies/sec/core; index ≥1M docs with bounded RAM. Set real SLOs at Phase 4.

---

## 8. Phased roadmap

| Phase | Deliverable | Notes |
| --- | --- | --- |
| **0 — Vectors** *(do now, regardless)* | Conformance corpus generated from the TS core (json + 3 hashes + conformance per input). | Cheap; the freeze's enforcement artifact; prerequisite for everything. |
| **1 — Kernel + WASM + JS** | Rust `dotit-core`: parse + serialize + canonicalize + hash(v4) + verify(intact). WASM build + `@dotit/core-wasm` JS glue. Passes 100% corpus + differential fuzz vs TS. | The hard 80%: byte-exact hash. |
| **2 — Full kernel** | query + `.it-index` + conformance(lax/strict) + Ed25519 signature verify + audit-chain verify. All SEAL_SPEC versions. | Reaches feature parity for the kernel. |
| **3 — Bindings** | Python (wasmtime-py + PyO3 wheel), Go (wazero), Java (Chicory), .NET (Wasmtime.NET). Each runs the corpus in its own CI. | Thin; the engine is done. |
| **4 — Scale + gov hardening** | rayon batch, streaming, perf SLOs; reproducible builds, SBOM, `cargo vet`, static musl CLI, FIPS-pluggable crypto. | Productionization for gov/scale. |
| **5 — (optional) Consolidate** | JS ecosystem adopts the WASM kernel, retiring the TS *parser* (keep TS rendering). | Only if it clearly pays off; not required. |

---

## 9. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| **Hash divergence** (breaks cross-language seals) | Conformance corpus + differential fuzz, run in **every** engine's CI; canonicalizers ported verbatim. |
| **Maintaining two engines** | Format is frozen (no moving target); TS stays canonical until Rust is 100% green + soaked; new SEAL_SPEC versions are rare and added in lock-step. |
| **Scope creep into rendering** | Explicit non-goal; kernel only. |
| **WASM perf/size ceilings** | Native FFI / PyO3 / static CLI for hot paths; WASM where portability matters more than peak speed. |
| **Crypto/compliance drift** | Pluggable signature backend; SBOM + `cargo audit`/`vet`; pin + vendor. |

---

## 10. Decision triggers (when to actually start)

Start **Phase 1+** when **any** of these is real:
- A government / enterprise consumer requires a **non-JS, no-Node** verifier (Python/Go/Java/.NET).
- A **scale** workload (millions of docs, high-throughput seal verification) the TS core can't meet.
- A mandate for a **single audited static binary** verifier.

Otherwise: do **Phase 0** (vectors) now — it's valuable on its own and makes any later start safe.

---

## 11. Effort (rough order-of-magnitude)

- **Phase 0:** days — generate + commit the corpus from the TS core.
- **Phase 1:** the bulk — porting parser + byte-exact canonicalizer/hash is the real work
  (the rest is mechanical). Plan for a focused multi-week effort with the corpus as the gate.
- **Phases 2–3:** incremental; bindings are thin once the kernel is green.
- **Phase 4:** ongoing hardening, scoped to the gov/scale contract that triggered it.

**Bottom line:** not needed today, but this is the *correct* foundation for multi-language +
government + scale — one Rust engine, byte-identical everywhere, kernel-only, gated by a
conformance corpus. Build the corpus now; build the engine when a real non-JS/scale consumer
appears.
