---
sidebar_position: 2
title: Pipeline Definition
---

# Pipeline Definition

## The problem

You need a multi-step agent pipeline with conditional branching, error handling, retries, and dependencies — all in a format that both agents and humans can read.

## The solution

```intenttext
title: Document Processing Pipeline
summary: Extract, validate, classify, and store incoming documents
meta: | type: agentic | domain: automation

section: Ingestion

step: Receive document | id: receive | tool: inbox-watcher | output: raw_doc | status: pending | phase: ingestion
step: Extract text | id: extract | depends: receive | tool: ocr-service | input: raw_doc | output: extracted_text | timeout: 30000 | retries: 3 | status: pending | phase: ingestion
step: Detect language | id: detect-lang | depends: extract | tool: lang-detect | input: extracted_text | output: language | confidence: 0.9 | status: pending | phase: ingestion

section: Classification

decision: Supported language? | if: language in [en, es, fr, de] | then: classify | else: manual-route

step: Classify document | id: classify | depends: detect-lang | tool: classifier | model: gpt-4 | input: extracted_text | output: doc_type | confidence: 0.85 | status: pending | phase: classification

decision: Route by type | id: route | options: contract, invoice, report, other | input: doc_type | output: processing_queue

section: Validation

step: Validate schema | id: validate | depends: classify | tool: schema-validator | input: extracted_text, doc_type | output: validation_result | status: pending | phase: validation

decision: Schema valid? | if: validation_result.valid == true | then: enrich | else: flag-review

section: Enrichment

step: Extract entities | id: enrich | depends: validate | tool: ner-service | input: extracted_text | output: entities | status: pending | phase: enrichment
step: Link to existing records | id: link | depends: enrich | tool: record-matcher | input: entities | output: matched_records | confidence: 0.8 | status: pending | phase: enrichment

section: Storage

step: Store document | id: store | depends: link | tool: doc-store | input: extracted_text, entities, matched_records, doc_type | output: doc_id | status: pending | phase: storage
step: Update index | id: index | depends: store | tool: search-indexer | input: doc_id, entities | status: pending | phase: storage

section: Error Handling

error: OCR failed | step: extract | fallback: manual-route | notify: ops-team@acme.co | code: E001
error: Classification uncertain | step: classify | fallback: manual-route | notify: ml-team@acme.co | code: E002
error: Schema validation failed | step: validate | fallback: flag-review | notify: data-team@acme.co | code: E003

section: Events

trigger: Document stored | event: store.complete | signal: doc-processed
trigger: Error occurred | event: error.* | signal: ops-alert

audit: Pipeline created | by: pipeline-agent | at: 2026-03-15 | level: info
done: Pipeline definition complete | status: template
```

## Step by step

### Dependencies

Steps execute in dependency order. `depends:` takes one or more step IDs:

```intenttext
step: Step A | id: a | status: pending
step: Step B | id: b | depends: a | status: pending
step: Step C | id: c | depends: a, b | status: pending
```

Step C waits for both A and B to complete.

### Gates and decisions

`gate:` pauses execution until a named approver grants permission:

```intenttext
gate: Manager approval | approver: engineering-manager | timeout: 72h | fallback: escalate
```

`decision:` branches based on a condition:

### Error handling

`error:` blocks define what happens when a step fails:

```intenttext
error: OCR failed | step: extract | fallback: manual-route | notify: ops-team@acme.co | code: E001
```

- `step:` — which step this error handler covers
- `fallback:` — step ID to execute on failure
- `notify:` — who to alert
- `code:` — error code for tracking

### Timeouts and retries

Steps can have execution limits:

```intenttext
step: External API call | id: api-call | tool: external-api | timeout: 30000 | retries: 3 | delay: 1000 | backoff: exponential
```

### Phases

Use `phase:` to group steps across sections:

```bash
# Query all steps in the validation phase
intenttext pipeline.it --query "type=step phase=validation"
```

## Query it

```bash
# All steps with their dependencies
intenttext pipeline.it --query "type=step"

# Error handlers
intenttext pipeline.it --query "type=error"

# Steps that use a specific tool
intenttext pipeline.it --query "type=step tool:contains=ocr"
```

## Next steps

- [Task Planning](./task-planning) — simpler single-pipeline task plan
- [Agent Handoff](./agent-handoff) — connecting pipelines across agents
- [MCP Integration](./mcp-integration) — executing pipelines via MCP
