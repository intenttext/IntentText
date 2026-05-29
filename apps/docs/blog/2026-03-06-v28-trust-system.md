---
slug: v28-trust-system
title: "v2.8: Trust System — Documents You Can Seal"
authors: [intenttext]
tags: [release, trust]
---

v2.8 introduces five keywords that turn IntentText documents into trustworthy records: `approve`, `sign`, `freeze`, `revision`, and `track`.

The philosophy: you own the format. The CLI gives it trust.

<!-- truncate -->

## The problem with document trust

Organizations sign PDFs. They email Word docs back and forth. They track changes with version history buried in a proprietary app. None of this is portable, verifiable, or queryable.

What if trust was part of the document itself?

## Five new keywords

### `track:`

Enables the trust system for a document:

```
track: | version: 1.0 | by: Ahmed
```

This tells the parser to maintain a trust history — a registry of every block and a log of every change.

### `approve:`

Records an approval with the approver's identity:

```
approve: Reviewed by legal | by: Sarah Chen | role: Legal Counsel
```

### `sign:`

Records a cryptographic signature:

```
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
```

### `freeze:`

Seals the document. After this, any content change invalidates the hash:

```
freeze: | status: locked
```

### `revision:`

Records a version change in the trust history:

```
revision: Updated payment terms | by: Ahmed | at: 2026-03-07
```

## How it works

When you seal a document with the CLI (`intenttext seal contract.it --signer "Ahmed"`), the system:

1. Computes a SHA-256 hash of the document content
2. Adds a `sign:` block with the hash
3. Adds a `freeze:` block that locks the document

Later, `intenttext verify contract.it` recomputes the hash and checks it against the seal. If anyone changed a single character, the verification fails.

The trust data lives in the same `.it` file — below a `history:` boundary. It's human-readable. It's version-controlled. It travels with the document.

## The organizational use case

An HR department with 200 employment contracts:

```bash
intenttext query ./contracts --type approve --format table
intenttext query ./contracts --type sign --format table
intenttext verify ./contracts --recursive
```

Three commands. You know who approved what, who signed what, and whether any document has been tampered with. No PDF viewer required. No proprietary tool.

[Read the trust documentation →](/docs/guide/trust-and-signing)
