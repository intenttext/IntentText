---
sidebar_position: 5
title: Attachments
---

# Attachments

## The problem

A document references a file — a signed PDF, a logo, a CR certificate — and you need the file
to **travel with the document** and be **covered by the seal**, not live as a loose
attachment that can be swapped or lost.

## The solution

An `attach:` block embeds a file inside the `.it` document. The bytes are base64-encoded
inline, with a recorded `mime:`, `size:`, and SHA-256 — so the attachment is part of the
document's content and is included when you seal it.

```intenttext
title: Vendor Onboarding — Acme
meta: | type: form

section: Documents
text: Commercial registration attached below.

attach: cr | name: cr-300012345.pdf | mime: application/pdf | size: 10 | data: Q1IgT04gRklMRQ==
```

- The content after `attach:` is the attachment **key** (`cr`) — how you fetch it later.
- `name:` is the original filename, `mime:` the media type, `size:` the byte length.
- `data:` is the base64-encoded file (small files); large files can be referenced by
  `href:` instead of embedded.

This is exactly what a form's `type: attachment` field produces — see
[Fillable Forms](../forms/fillable-forms).

## Add, read, and remove in code

```javascript
import {
  addAttachment,
  extractAttachments,
  getAttachment,
  hasAttachment,
  removeAttachment,
  MAX_EMBED_BYTES,
} from "@dotit/core";

// Embed a file (base64 in `data`). Refuses files larger than MAX_EMBED_BYTES
// unless you raise the limit via opts.maxEmbedBytes.
let source = addAttachment(docSource, {
  key: "cr",
  name: "cr-300012345.pdf",
  mime: "application/pdf",
  size: 10,
  data: "Q1IgT04gRklMRQ==",
});

hasAttachment(source, "cr");        // true
extractAttachments(source);         // [{ key, name, mime, size, sha256, data? }]
const cr = getAttachment(source, "cr");
source = removeAttachment(source, "cr");
```

`attachmentDataUri(att)` turns an embedded attachment into a `data:` URI for preview, and
`safePreviewMime(mime)` returns a render-safe MIME (so an untrusted `mime:` can't be used to
sneak active content into a preview).

## Covered by the seal

Because `attach:` is document content, sealing the document hashes the attachment along with
everything else:

```javascript
import { sealDocument, verifyDocument } from "@dotit/core";

const { source: sealed } = sealDocument(source, { signer: "Acme HR", role: "Records" });
// Swap the file's bytes afterwards and verifyDocument(sealed).intact becomes false.
verifyDocument(sealed).intact; // true — until the attachment (or any content) changes
```

So an embedded contract PDF, a signed annex, or an uploaded CR can't be substituted without
breaking the seal — the file and the document that vouches for it are one tamper-evident unit.

## Next steps

- [Fillable Forms](../forms/fillable-forms) — `type: attachment` fields that produce `attach:` blocks
- [Sealing Contracts](./sealing-contracts) — what the seal covers (attachments included)
