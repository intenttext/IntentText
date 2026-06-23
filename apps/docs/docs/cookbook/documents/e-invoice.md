---
sidebar_position: 4
title: E-Invoices (EN16931 / UBL)
---

# E-Invoices (EN16931 / UBL)

## The problem

Your invoice lives as a readable, sealable `.it` document — but tax authorities and ERP
inboxes want a **structured e-invoice**: UBL 2.1 XML conforming to the EN16931 European norm
(the same model behind ZATCA, Peppol, and most GCC/EU mandates). You need both, from one
source of truth.

## The solution: `buildUBLInvoice`

`buildUBLInvoice(input)` emits EN16931-conformant UBL 2.1 `Invoice` XML — tax totals,
party VAT IDs, and line items, all computed for you.

```javascript
import { buildUBLInvoice } from "@dotit/core";

const xml = buildUBLInvoice({
  id: "INV-2026-0114",
  issueDate: "2026-06-12",
  dueDate: "2026-06-26",
  currency: "QAR", // ISO-4217 — bare magnitudes, no symbols/separators
  supplier: {
    name: "Dalil Technology LLC",
    vatId: "QA300012345600003",
    country: "QA",
  },
  customer: { name: "Acme Corporation", country: "QA" },
  taxPercent: 5,
  lines: [
    { name: "Platform development — June 2026", quantity: 1, unitPrice: 12000 },
    { name: "UX design services", quantity: 8, unitPrice: 450, unit: "HUR" },
    { name: "Hosting and infrastructure", quantity: 1, unitPrice: 900 },
  ],
});
```

The output is standards XML — note the `CustomizationID` pinning EN16931, ISO-4217 currency
codes, and the tax totals the library computed (`TaxAmount`, `TaxInclusiveAmount`,
`PayableAmount`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ...>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>INV-2026-0114</cbc:ID>
  <cbc:IssueDate>2026-06-12</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>QAR</cbc:DocumentCurrencyCode>
  ...
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="QAR">17325.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="QAR">17325.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>
```

### Money hygiene maps straight through

The UBL model is exactly the IntentText money rule: **`value` is a bare magnitude, the
currency is an ISO-4217 code** (`currency:` / `unit:`) — never a symbol, never thousands
separators. So `unitPrice: 12000` + `currency: "QAR"` becomes `12000.00` with
`currencyID="QAR"`. (`unit:` on a line is the UN/ECE quantity code — `EA` each, `HUR` hours;
it defaults to `EA`.)

## From an existing `.it` invoice: `intentToUBL`

If you already author invoices as `.it` documents (see [Your First
Document](../../guide/first-document)), `intentToUBL` reads the document and produces UBL,
with `overrides` filling anything the document doesn't carry structurally:

```javascript
import { intentToUBL } from "@dotit/core";

const xml = intentToUBL(invoiceSource, {
  id: "INV-2026-0114",
  issueDate: "2026-06-12", // required (EN16931 BT-2) if the source has no structured date
  currency: "QAR",
  supplier: { name: "Dalil Technology LLC", vatId: "QA300012345600003", country: "QA" },
  customer: { name: "Acme Corporation", country: "QA" },
});
```

## The one-source-of-truth pattern

1. **Author** the invoice as a `.it` document — human-readable, queryable, renders to PDF.
2. **Seal** it (`sealDocument`) so the human-facing artifact is tamper-evident — see
   [Sealing Contracts](../trust/sealing-contracts).
3. **Emit** the UBL XML (`buildUBLInvoice` / `intentToUBL`) for the tax portal or ERP.

The readable record and the machine filing come from the same numbers, so they can never
disagree.

## Next steps

- [Building Templates](../templates/building-templates) — generate invoices from a template + data
- [PDF Export](../print/pdf-export) — the human-facing PDF (`@dotit/pdf` `issuePDF`)
- [Sealing Contracts](../trust/sealing-contracts) — make the issued invoice tamper-evident
