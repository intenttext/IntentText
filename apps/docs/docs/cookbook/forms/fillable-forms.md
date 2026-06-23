---
sidebar_position: 1
title: Fillable Forms
---

# Fillable Forms

## The problem

You need a form people can fill in — vendor onboarding, an intake sheet, an order — that
behaves like a PDF form (boxes, required fields, a signature) but stays **plain text**,
**queryable**, and **tamper-evident**. And you want two-party trust: the author locks the
_questions_, the filler signs the _answers_.

## The solution

`meta: | type: form` turns every `input:` line into a fillable field. A field is a single
line; its `key:` is the machine name, and pipe properties declare its behaviour:

```intenttext
meta: | type: form | title: Vendor Onboarding
title: Vendor Onboarding
summary: Complete every required field, attach your CR, and sign to submit.

section: Company
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA, AE, QA | required: yes
input: VAT number | key: vat | type: text | show-if: country == SA
input: Commercial registration (PDF) | key: cr | type: attachment | required: yes

section: Order
input: Quantity | key: qty | type: number | required: yes | value: 1
input: Unit price (USD) | key: unit_price | type: number | required: yes | value: 250
input: Total (USD) | key: total | type: number | compute: qty * unit_price

section: Authorization
input: Authorized signatory | key: signer | type: text | required: yes
input: Signature | key: signature | type: signature | required: yes
input: Date | key: signed_at | type: date | required: yes
```

Open this in the [editor](../../ecosystem/editor) and it renders the fill UI automatically.

## Field types

`type:` is one of: `text`, `textarea`, `date`, `number`, `choice`, `checkbox`, `signature`,
`table`, `attachment`. Common properties:

| Property      | Meaning                                                              |
| ------------- | ------------------------------------------------------------------- |
| `key:`        | Machine name — the answer key and the variable in `show-if`/`compute` |
| `required:`   | `yes` marks the field as required for completion                     |
| `options:`    | Comma-separated choices (for `type: choice`)                         |
| `value:`      | The current answer (a default, or what the filler entered)          |
| `show-if:`    | Show the field only when **one comparison** holds                    |
| `compute:`    | Auto-fill from an arithmetic expression (read-only field)           |

## Conditional fields: `show-if:`

`show-if:` holds **exactly one comparison** — `==`, `!=`, `>`, `<`, `>=`, `<=` — against
another field's `key`. The VAT field appears only when Country is `SA`:

```intenttext
input: Country | key: country | type: choice | options: KW, SA, AE, QA | required: yes
input: VAT number | key: vat | type: text | show-if: country == SA
```

A hidden field is **not** counted toward completion — so an unanswered VAT number won't block
a Kuwaiti vendor.

## Computed fields: `compute:`

`compute:` is **arithmetic** — `+`, `-`, `*`, `/`, and parentheses over other fields' keys.
The result is filled in automatically and the field is read-only:

```intenttext
input: Quantity | key: qty | type: number | value: 10
input: Unit price (USD) | key: unit_price | type: number | value: 250
input: Total (USD) | key: total | type: number | compute: qty * unit_price
```

`Total` resolves to `2500`. (Keep comparison logic in `show-if` and math in `compute` —
they are deliberately separate, single-purpose mini-languages.)

## File uploads: `type: attachment`

An `attachment` field accepts a file. The file rides **inside** the document as an `attach:`
block, so it travels with the form and is covered by the seal — see the
[Attachments](../trust/attachments) recipe.

```intenttext
input: Commercial registration (PDF) | key: cr | type: attachment | required: yes
```

## Fill and complete it in code

```javascript
import { applyAnswers, isFormComplete, computeFormValues, missingRequiredFields } from "@dotit/core";

let source = formSource;

// Apply answers (one or many) — keys map to each field's `key:`
source = applyAnswers(source, {
  legal_name: "Dalil Technology LLC",
  country: "SA",
  vat: "300012345600003",
  qty: "10",
  unit_price: "250",
  signer: "Sarah Al-Ahmad",
  signature: "Sarah Al-Ahmad",
  signed_at: "2026-06-16",
});

computeFormValues(source).total; // "2500" — derived from qty * unit_price
isFormComplete(source);          // true once every *visible* required field is answered
missingRequiredFields(source);   // [] — or the keys still outstanding
```

`setFieldValue(source, key, value)` sets one field; `formAnswers(source)` reads every answer
back as a `Record<string, string>`; `formVisibility(source)` reports which fields are
currently shown.

## Two-party trust: author seals structure, filler signs answers

A form has **two** trust acts, and they don't collide:

1. **The author seals the structure.** `sealFormStructure` hashes only the _questions_
   (the field set, labels, types, required flags, conditions) — not the answers. This proves
   nobody slipped in or altered a field after you published it.

   ```javascript
   import { sealFormStructure, verifyFormStructure } from "@dotit/core";

   const { source, structureHash } = sealFormStructure(blankForm, { sealer: "Acme HR" });
   // adds a form-seal that pins the structure; answers can still be filled in afterwards

   const v = verifyFormStructure(filledForm);
   // { sealed: true, intact: true, sealer: "Acme HR", structureHash, expected }
   ```

2. **The filler signs the answers.** Once every required field is answered, the form stops
   being a template and becomes a signable record — seal it like any other document:

   ```javascript
   import { isFormComplete, sealDocument } from "@dotit/core";

   if (isFormComplete(filled)) {
     const { source } = sealDocument(filled, { signer: "Sarah Al-Ahmad", role: "Authorized signatory" });
     // now the *answers* are frozen and tamper-evident — see Sealing Contracts
   }
   ```

The two hashes are independent: the structure hash survives the form being filled in
(answers aren't part of it), and the content seal locks the completed answers.

## Submitting to a hub (optional)

To post a completed, sealed form to an endpoint, `submitForm` builds the payload (source +
answers + hash) and POSTs it:

```javascript
import { submitForm } from "@dotit/core";

const result = await submitForm(sealedSource, {
  endpoint: "https://forms.acme.co/intake",
  formId: "vendor-onboarding",
  requireComplete: true, // refuse to submit an incomplete form
});
// { ok, status, body }
```

`buildSubmission(source)` returns the same payload without sending, if you want to handle
transport yourself.

## Next steps

- [Attachments](../trust/attachments) — how `type: attachment` files ride inside the doc
- [Sealing Contracts](../trust/sealing-contracts) — freezing the completed answers
- [Approval Workflow](../trust/approval-workflow) — routing a completed form for sign-off
