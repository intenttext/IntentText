import { describe, it, expect } from "vitest";
import {
  isValidIban,
  isValidBic,
  isValidCurrencyCode,
  validateDocument,
  parseIntentText,
  type DocumentSchema,
} from "../src/index";

/**
 * #61 — financial schema types. A `.it` document that carries payment
 * instructions (IBAN, BIC/SWIFT, currency) must be able to VALIDATE them, not
 * merely store any string. Before this, a schema could only assert "string",
 * so a transposed-digit IBAN or a bogus currency code sealed cleanly and failed
 * only at the bank. These validators run the real ISO checks.
 */
describe("IBAN validation (ISO 13616 mod-97)", () => {
  it("accepts well-known valid IBANs", () => {
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true); // UK reference IBAN
    expect(isValidIban("DE89370400440532013000")).toBe(true); // Germany
    expect(isValidIban("QA58DOHB00001234567890ABCDEFG")).toBe(true); // Qatar
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true); // France (letter in BBAN)
  });

  it("RED-TEAM: a single transposed digit fails the checksum", () => {
    // Valid GB IBAN with two digits swapped in the account number.
    expect(isValidIban("GB82WEST12345698765432")).toBe(true);
    expect(isValidIban("GB82WEST12345698764532")).toBe(false); // 76→46 transposition
  });

  it("rejects wrong shape (no country, bad check digits, too long)", () => {
    expect(isValidIban("1234567890")).toBe(false);
    expect(isValidIban("GBXXWEST1234")).toBe(false); // check digits not numeric
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("GB82" + "A".repeat(40))).toBe(false); // exceeds 34
  });
});

describe("BIC/SWIFT validation (ISO 9362)", () => {
  it("accepts 8- and 11-char BICs", () => {
    expect(isValidBic("DEUTDEFF")).toBe(true); // 8 (no branch)
    expect(isValidBic("DEUTDEFF500")).toBe(true); // 11 (with branch)
    expect(isValidBic("qiibqaqa")).toBe(true); // QIIB Qatar, case-insensitive
  });

  it("RED-TEAM: rejects wrong length and digits in the bank code", () => {
    expect(isValidBic("DEUTDEF")).toBe(false); // 7 chars
    expect(isValidBic("DEUTDEFF5")).toBe(false); // 9 chars
    expect(isValidBic("DEUTDEFF5000")).toBe(false); // 12 chars
    expect(isValidBic("1EUTDEFF")).toBe(false); // digit in bank code
  });
});

describe("ISO 4217 currency validation", () => {
  it("accepts active currency codes", () => {
    for (const c of ["USD", "EUR", "QAR", "GBP", "JPY", "SAR", "AED"]) {
      expect(isValidCurrencyCode(c)).toBe(true);
    }
    expect(isValidCurrencyCode("usd")).toBe(true); // case-insensitive
  });

  it("RED-TEAM: rejects made-up or retired codes and wrong shape", () => {
    expect(isValidCurrencyCode("XYZ")).toBe(false);
    expect(isValidCurrencyCode("US")).toBe(false); // too short
    expect(isValidCurrencyCode("DOLLAR")).toBe(false);
    expect(isValidCurrencyCode("")).toBe(false);
  });
});

describe("financial formats wired through validateDocument", () => {
  const schema: DocumentSchema = {
    name: "payment",
    blockSchemas: {
      // metric blocks carry the payment fields via properties
      metric: {
        type: "metric",
        allowUnknownProperties: true,
        properties: {
          iban: { type: "string", format: "iban" },
          bic: { type: "string", format: "bic" },
          currency: { type: "string", format: "currency" },
        },
      },
    },
  } as DocumentSchema;

  it("a document with a bad IBAN reports a schema error", () => {
    const doc = parseIntentText(
      `title: Wire\nmetric: Beneficiary | iban: GB82WEST12345698764532 | bic: DEUTDEFF | currency: EUR`,
    );
    const result = validateDocument(doc, schema);
    const ibanErr = result.errors.find((e) => e.field === "iban");
    expect(ibanErr).toBeTruthy();
    expect(ibanErr?.message).toMatch(/IBAN/);
  });

  it("a fully valid payment document passes", () => {
    const doc = parseIntentText(
      `title: Wire\nmetric: Beneficiary | iban: DE89370400440532013000 | bic: DEUTDEFF500 | currency: EUR`,
    );
    const result = validateDocument(doc, schema);
    const finErr = result.errors.find(
      (e) => e.field === "iban" || e.field === "bic" || e.field === "currency",
    );
    expect(finErr).toBeUndefined();
  });
});
