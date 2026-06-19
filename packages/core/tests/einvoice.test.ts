/**
 * einvoice.test.ts — EN 16931 / UBL 2.1 invoice export (G-19).
 */
import { describe, it, expect } from "vitest";
import { buildUBLInvoice, intentToUBL } from "../src/index";

const INPUT = {
  id: "INV-2026-0114",
  issueDate: "2026-06-12",
  dueDate: "2026-06-26",
  currency: "QAR",
  supplier: { name: "Dalil Technology LLC", vatId: "QA12345", country: "QA" },
  customer: { name: "Acme Corporation", country: "QA" },
  taxPercent: 5,
  lines: [
    { name: "Platform development", quantity: 1, unitPrice: 12000 },
    { name: "UX design", quantity: 8, unitPrice: 450 },
  ],
};

describe("G-19: buildUBLInvoice (EN 16931 / UBL 2.1)", () => {
  const x = buildUBLInvoice(INPUT);

  it("emits a UBL 2.1 Invoice with the EN 16931 customization id", () => {
    expect(x).toContain("<Invoice ");
    expect(x).toContain("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2");
    expect(x).toContain("<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>");
    expect(x).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
  });

  it("carries header fields + currency on amounts", () => {
    expect(x).toContain("<cbc:ID>INV-2026-0114</cbc:ID>");
    expect(x).toContain("<cbc:IssueDate>2026-06-12</cbc:IssueDate>");
    expect(x).toContain("<cbc:DueDate>2026-06-26</cbc:DueDate>");
    expect(x).toContain("<cbc:DocumentCurrencyCode>QAR</cbc:DocumentCurrencyCode>");
    expect(x).toContain('currencyID="QAR"');
  });

  it("computes consistent monetary totals (12000 + 3600 = 15600 @5% = 16380)", () => {
    // line extension = 12000 + 8*450 = 15600; tax = 780; inclusive = 16380
    expect(x).toContain("<cbc:LineExtensionAmount currencyID=\"QAR\">15600.00</cbc:LineExtensionAmount>");
    expect(x).toContain("<cbc:TaxExclusiveAmount currencyID=\"QAR\">15600.00</cbc:TaxExclusiveAmount>");
    expect(x).toContain("<cbc:TaxInclusiveAmount currencyID=\"QAR\">16380.00</cbc:TaxInclusiveAmount>");
    expect(x).toContain("<cbc:PayableAmount currencyID=\"QAR\">16380.00</cbc:PayableAmount>");
    expect(x).toContain("<cbc:TaxAmount currencyID=\"QAR\">780.00</cbc:TaxAmount>");
  });

  it("emits both parties + their VAT scheme", () => {
    expect(x).toContain("Dalil Technology LLC");
    expect(x).toContain("Acme Corporation");
    expect(x).toContain("<cbc:CompanyID>QA12345</cbc:CompanyID>");
    expect(x).toContain("<cac:AccountingSupplierParty>");
    expect(x).toContain("<cac:AccountingCustomerParty>");
  });

  it("emits one InvoiceLine per line with qty + price", () => {
    const lines = (x.match(/<cac:InvoiceLine>/g) || []).length;
    expect(lines).toBe(2);
    expect(x).toContain("Platform development");
    expect(x).toContain('<cbc:InvoicedQuantity unitCode="EA">8.00</cbc:InvoicedQuantity>');
  });

  it("rejects an invoice with no lines / missing id", () => {
    expect(() => buildUBLInvoice({ ...INPUT, lines: [] })).toThrow(/at least one line/);
    expect(() => buildUBLInvoice({ ...INPUT, id: "" })).toThrow(/id/);
  });

  it("zero-rated when no tax percent", () => {
    const z = buildUBLInvoice({ ...INPUT, taxPercent: 0 });
    expect(z).toContain("<cbc:ID>Z</cbc:ID>"); // tax category Z (zero-rated)
    expect(z).toContain("<cbc:TaxInclusiveAmount currencyID=\"QAR\">15600.00</cbc:TaxInclusiveAmount>");
  });
});

describe("G-19: intentToUBL (best-effort .it extraction)", () => {
  const INVOICE_IT = `title: Tax Invoice | end: INV-2026-0114
meta: | type: invoice | issued: 2026-06-12 | due: 2026-06-26

section: Line Items
| Description | Qty | Unit Price |
| Platform development | 1 | 12000 |
| UX design | 8 | 450 |
`;

  it("lifts id/dates/currency + line items from a conventional invoice", () => {
    const x = intentToUBL(INVOICE_IT, {
      currency: "QAR",
      supplier: { name: "Dalil Technology LLC" },
      customer: { name: "Acme Corporation" },
      taxPercent: 5,
    });
    expect(x).toContain("<cbc:ID>INV-2026-0114</cbc:ID>");
    expect(x).toContain("<cbc:IssueDate>2026-06-12</cbc:IssueDate>");
    expect(x).toContain("<cbc:DueDate>2026-06-26</cbc:DueDate>");
    expect((x.match(/<cac:InvoiceLine>/g) || []).length).toBe(2);
    expect(x).toContain("Platform development");
    expect(x).toContain("Dalil Technology LLC");
    // 12000 + 3600 = 15600
    expect(x).toContain("<cbc:LineExtensionAmount currencyID=\"QAR\">15600.00</cbc:LineExtensionAmount>");
  });
});
