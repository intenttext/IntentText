/**
 * document-metadata.test.ts — extractDocumentMetadata (G-16).
 *
 * The ERP indexing bridge: a flat, RDBMS-friendly record an ERP upserts into its own
 * tables so reporting stays in the database, with `.it` as the sealed artifact.
 */
import { describe, it, expect } from "vitest";
import { extractDocumentMetadata, sealDocument } from "../src/index";

const INVOICE = `title: Tax Invoice
meta: | type: invoice | status: issued | client: Acme

section: Totals
metric: Subtotal | value: 16,500 QAR
metric: Total Due | value: 17,325 QAR
`;

describe("G-16: extractDocumentMetadata", () => {
  it("flattens meta: fields, title, type, status", () => {
    const m = extractDocumentMetadata(INVOICE);
    expect(m.title).toBe("Tax Invoice");
    expect(m.type).toBe("invoice");
    expect(m.status).toBe("issued");
    expect(m.fields.client).toBe("Acme");
  });

  it("captures metric blocks as name -> value (for child tables)", () => {
    const m = extractDocumentMetadata(INVOICE);
    expect(m.metrics["Subtotal"]).toBe("16,500 QAR");
    expect(m.metrics["Total Due"]).toBe("17,325 QAR");
  });

  it("reports unsealed/unsigned for a plain document", () => {
    const m = extractDocumentMetadata(INVOICE);
    expect(m.sealed).toBe(false);
    expect(m.signed).toBe(false);
    expect(m.signers).toEqual([]);
    expect(m.contentHash).toBeUndefined();
  });

  it("surfaces seal state, signers, and the content hash once sealed", () => {
    const sealed = sealDocument(INVOICE, { signer: "Ada", role: "CFO" }).source;
    const m = extractDocumentMetadata(sealed);
    expect(m.sealed).toBe(true);
    expect(m.signed).toBe(true);
    expect(m.signers[0]).toMatchObject({ signer: "Ada", role: "CFO" });
    expect(m.frozenAt).toBeTruthy();
    expect(m.contentHash).toMatch(/^sha256:/);
  });

  it("is stable: same source -> same record", () => {
    expect(extractDocumentMetadata(INVOICE)).toEqual(
      extractDocumentMetadata(INVOICE),
    );
  });
});
