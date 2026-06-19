/**
 * einvoice.ts — export an IntentText invoice to **EN 16931 / UBL 2.1** XML (G-19).
 *
 * EN 16931 is the European semantic e-invoice standard; UBL 2.1 is its dominant
 * syntax, and the basis for **PEPPOL BIS Billing 3.0** and the GCC e-invoice mandates
 * (e.g. Saudi **ZATCA** Phase-1/2, which use UBL 2.1). This module produces a
 * standard-rated EN 16931 core invoice from structured data — keeping with the project
 * philosophy that **the ERP computes, `.it`/this layer formats**: you pass the figures
 * your ERP already has; we emit conformant XML with consistent monetary totals.
 *
 * `buildUBLInvoice(input)` is the reliable primary API. `intentToUBL(source, overrides)`
 * is a BEST-EFFORT convenience that lifts header fields + a line-item table out of a
 * conventional `.it` invoice — handy, but the ERP should prefer passing data explicitly.
 *
 * Zero-dependency (pure XML string building). NOTE: this emits the EN 16931 *core*
 * (standard-rated, single VAT category). Country-specific extensions — ZATCA's
 * cryptographic stamp / QR, PEPPOL transport/IDs, multi-rate tax breakdowns — are
 * deliberately out of scope and layered on by the regulated-market integration.
 */
import { parseIntentText } from "./parser";
import { extractDocumentMetadata } from "./index-builder";
import { flattenBlocks } from "./utils";

export interface UBLParty {
  /** Legal/registration name (BT-27 / BT-44). */
  name: string;
  /** VAT identifier, e.g. "SA123…" (BT-31 / BT-48). */
  vatId?: string;
  /** ISO-3166 alpha-2 country code, e.g. "SA", "QA" (BT-40 / BT-55). */
  country?: string;
  /** Optional free-form address line (BT-35 / BT-50). */
  address?: string;
  /** Optional city (BT-37 / BT-52). */
  city?: string;
}

export interface UBLLine {
  /** Line id; defaults to its 1-based position. */
  id?: string;
  /** Item name (BT-153). */
  name: string;
  /** Invoiced quantity (BT-129). */
  quantity: number;
  /** Net unit price (BT-146). */
  unitPrice: number;
  /** Unit of measure (UN/ECE Rec 20), default "EA" (each). */
  unit?: string;
}

export interface UBLInvoiceInput {
  /** Invoice number (BT-1). */
  id: string;
  /** Issue date YYYY-MM-DD (BT-2). */
  issueDate: string;
  /** Payment due date YYYY-MM-DD (BT-9). */
  dueDate?: string;
  /** ISO-4217 currency, e.g. "SAR", "QAR", "EUR" (BT-5). */
  currency: string;
  /** Invoice type code (UNTDID 1001); 380 = commercial invoice (BT-3). */
  typeCode?: string;
  supplier: UBLParty;
  customer: UBLParty;
  lines: UBLLine[];
  /** Standard VAT rate % applied to the whole invoice (BT-119). Default 0. */
  taxPercent?: number;
  /** Free-form notes (BT-22). */
  notes?: string[];
}

function xml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function partyXml(tag: string, p: UBLParty, currencyUnused?: never): string {
  void currencyUnused;
  const taxScheme = p.vatId
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${xml(p.vatId)}</cbc:CompanyID>` +
      `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : "";
  const address =
    p.address || p.city || p.country
      ? `<cac:PostalAddress>` +
        (p.address ? `<cbc:StreetName>${xml(p.address)}</cbc:StreetName>` : "") +
        (p.city ? `<cbc:CityName>${xml(p.city)}</cbc:CityName>` : "") +
        (p.country
          ? `<cac:Country><cbc:IdentificationCode>${xml(p.country)}</cbc:IdentificationCode></cac:Country>`
          : "") +
        `</cac:PostalAddress>`
      : "";
  return (
    `<${tag}><cac:Party>` +
    `<cac:PartyName><cbc:Name>${xml(p.name)}</cbc:Name></cac:PartyName>` +
    address +
    taxScheme +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${xml(p.name)}</cbc:RegistrationName></cac:PartyLegalEntity>` +
    `</cac:Party></${tag}>`
  );
}

/**
 * Build an EN 16931 / UBL 2.1 invoice XML string from structured data. Computes
 * consistent monetary totals (line extension, tax-exclusive/inclusive, payable) and a
 * single standard VAT category. Throws on missing required fields / empty lines.
 */
export function buildUBLInvoice(input: UBLInvoiceInput): string {
  if (!input.id) throw new Error("UBL invoice requires an id (BT-1).");
  if (!input.issueDate) throw new Error("UBL invoice requires issueDate (BT-2).");
  if (!input.currency) throw new Error("UBL invoice requires currency (BT-5).");
  if (!input.lines?.length) throw new Error("UBL invoice requires at least one line.");

  const cur = input.currency.toUpperCase();
  const ccy = (n: number) => `${money(n)}`;
  const amt = (tag: string, n: number) =>
    `<${tag} currencyID="${xml(cur)}">${ccy(n)}</${tag}>`;
  const taxPercent = input.taxPercent ?? 0;
  const categoryId = taxPercent > 0 ? "S" : "Z"; // standard-rated vs zero-rated

  let lineExtensionTotal = 0;
  const linesXml = input.lines
    .map((l, i) => {
      const qty = Number(l.quantity) || 0;
      const price = Number(l.unitPrice) || 0;
      const lineAmount = Math.round(qty * price * 100) / 100;
      lineExtensionTotal += lineAmount;
      const unit = l.unit || "EA";
      return (
        `<cac:InvoiceLine>` +
        `<cbc:ID>${xml(l.id ?? i + 1)}</cbc:ID>` +
        `<cbc:InvoicedQuantity unitCode="${xml(unit)}">${money(qty)}</cbc:InvoicedQuantity>` +
        amt("cbc:LineExtensionAmount", lineAmount) +
        `<cac:Item><cbc:Name>${xml(l.name)}</cbc:Name>` +
        `<cac:ClassifiedTaxCategory><cbc:ID>${categoryId}</cbc:ID>` +
        `<cbc:Percent>${money(taxPercent)}</cbc:Percent>` +
        `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>` +
        `<cac:Price>${amt("cbc:PriceAmount", price)}</cac:Price>` +
        `</cac:InvoiceLine>`
      );
    })
    .join("");

  lineExtensionTotal = Math.round(lineExtensionTotal * 100) / 100;
  const taxAmount = Math.round((lineExtensionTotal * taxPercent) / 100 * 100) / 100;
  const taxInclusive = Math.round((lineExtensionTotal + taxAmount) * 100) / 100;

  const taxTotal =
    `<cac:TaxTotal>` +
    amt("cbc:TaxAmount", taxAmount) +
    `<cac:TaxSubtotal>` +
    amt("cbc:TaxableAmount", lineExtensionTotal) +
    amt("cbc:TaxAmount", taxAmount) +
    `<cac:TaxCategory><cbc:ID>${categoryId}</cbc:ID><cbc:Percent>${money(taxPercent)}</cbc:Percent>` +
    `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>` +
    `</cac:TaxSubtotal></cac:TaxTotal>`;

  const monetaryTotal =
    `<cac:LegalMonetaryTotal>` +
    amt("cbc:LineExtensionAmount", lineExtensionTotal) +
    amt("cbc:TaxExclusiveAmount", lineExtensionTotal) +
    amt("cbc:TaxInclusiveAmount", taxInclusive) +
    amt("cbc:PayableAmount", taxInclusive) +
    `</cac:LegalMonetaryTotal>`;

  const notes = (input.notes ?? [])
    .map((n) => `<cbc:Note>${xml(n)}</cbc:Note>`)
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"` +
    ` xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"` +
    ` xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
    `<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>` +
    `<cbc:ID>${xml(input.id)}</cbc:ID>` +
    `<cbc:IssueDate>${xml(input.issueDate)}</cbc:IssueDate>` +
    (input.dueDate ? `<cbc:DueDate>${xml(input.dueDate)}</cbc:DueDate>` : "") +
    `<cbc:InvoiceTypeCode>${xml(input.typeCode ?? "380")}</cbc:InvoiceTypeCode>` +
    notes +
    `<cbc:DocumentCurrencyCode>${xml(cur)}</cbc:DocumentCurrencyCode>` +
    partyXml("cac:AccountingSupplierParty", input.supplier) +
    partyXml("cac:AccountingCustomerParty", input.customer) +
    taxTotal +
    monetaryTotal +
    linesXml +
    `</Invoice>`
  );
}

/** Pull a number out of a free-form amount like "16,500 QAR" / "QAR 1,234.50". */
function parseAmount(s: unknown): number {
  const m = String(s ?? "").replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const n = parseFloat(m);
  return Number.isFinite(n) ? n : 0;
}

/**
 * BEST-EFFORT: derive a UBL invoice from a conventional `.it` invoice + caller overrides
 * (G-19). Lifts the invoice id (title `end:` / meta), issue/due dates, currency, and
 * line items (the first table whose header looks like description/qty/price), then calls
 * buildUBLInvoice. Parties are NOT reliably encodable in free-form `.it`, so pass
 * `overrides.supplier` / `overrides.customer` (and anything else to correct). Prefer
 * `buildUBLInvoice` with explicit data for production e-invoicing.
 */
export function intentToUBL(
  source: string,
  overrides: Partial<UBLInvoiceInput> = {},
): string {
  const doc = parseIntentText(source);
  const meta = extractDocumentMetadata(source);
  const allBlocks = flattenBlocks(doc.blocks); // tables/etc. nest under section:

  // id: title `end:` (e.g. "Tax Invoice | end: INV-1") → meta fields → fallback.
  const titleBlock = allBlocks.find((b) => b.type === "title");
  const titleEnd = titleBlock?.properties?.end
    ? String(titleBlock.properties.end)
    : undefined;
  const id =
    overrides.id ?? titleEnd ?? meta.fields.number ?? meta.fields.id ?? "INV";

  // currency: from a metric/amount, else default.
  const currency =
    overrides.currency ??
    (Object.values(meta.metrics).join(" ").match(/\b([A-Z]{3})\b/)?.[1]) ??
    "USD";

  // lines: first table with rows; map columns by header keywords.
  let lines: UBLLine[] = overrides.lines ?? [];
  if (!overrides.lines) {
    const table = allBlocks.find((b) => b.type === "table" && b.table?.rows?.length);
    if (table?.table) {
      const headers = (table.table.headers ?? []).map((h) => h.toLowerCase());
      const col = (re: RegExp) => headers.findIndex((h) => re.test(h));
      const nameCol = Math.max(0, col(/desc|item|name|product/));
      const qtyCol = col(/qty|quantity|count/);
      const priceCol = col(/price|unit|rate/);
      lines = table.table.rows.map((r, i) => ({
        id: String(i + 1),
        name: r[nameCol] ?? `Item ${i + 1}`,
        quantity: qtyCol >= 0 ? parseAmount(r[qtyCol]) || 1 : 1,
        unitPrice: priceCol >= 0 ? parseAmount(r[priceCol]) : 0,
      }));
    }
  }

  return buildUBLInvoice({
    id,
    issueDate: overrides.issueDate ?? meta.fields.issued ?? meta.fields.date ?? "",
    dueDate: overrides.dueDate ?? meta.fields.due,
    currency,
    supplier: overrides.supplier ?? { name: meta.fields.from ?? meta.title ?? "Supplier" },
    customer: overrides.customer ?? { name: meta.fields.to ?? meta.fields.client ?? "Customer" },
    lines,
    taxPercent: overrides.taxPercent,
    notes: overrides.notes,
  });
}
