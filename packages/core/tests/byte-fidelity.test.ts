import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  toStorageRecord,
  fromStorageRecord,
  verifyStorageRecord,
  verifyDocument,
} from "../src/index";

/**
 * BYTE-FIDELITY / TRUST-PRESERVATION GATE.
 *
 * The seal hashes the RAW source bytes. So every exchange surface (DB save/load,
 * desktop, transport) MUST preserve the source exactly — a single reformatted
 * byte silently breaks the seal. This suite locks the storage contract: a sealed
 * document round-trips through the storage record byte-for-byte and still
 * verifies, and any mutation by the storage layer is caught loudly (never silent).
 */

const examplesDir = resolve(__dirname, "../../../examples");
const SEALED = ["contract-sealed.it", "intake-form-filled.it"];

describe("byte-fidelity: sealed documents survive the storage round-trip", () => {
  for (const name of SEALED) {
    const path = resolve(examplesDir, name);
    const present = existsSync(path);
    it.skipIf(!present)(
      `${name}: DB save→load is byte-identical and stays verified`,
      () => {
        const src = readFileSync(path, "utf8");
        // Sanity: it really is a sealed, intact document to begin with.
        expect(verifyDocument(src).intact).toBe(true);

        const record = toStorageRecord(src); // what the DB stores
        const back = fromStorageRecord(record); // what the DB returns

        // The exchange must not change a single byte …
        expect(back).toBe(src);
        // … so the seal still holds end-to-end.
        expect(verifyDocument(back).intact).toBe(true);
        expect(verifyStorageRecord(record)).toBe(true);
      },
    );
  }

  it("catches a storage layer that mutates even one byte (no silent trust loss)", () => {
    const src = "title: Agreement\ntext:  two spaces are sacred\n";
    const record = toStorageRecord(src);
    // Simulate a storage layer that "helpfully" collapsed the double space.
    const tampered = { ...record, source: record.source.replace("  ", " ") };

    expect(verifyStorageRecord(tampered)).toBe(false);
    expect(() => fromStorageRecord(tampered)).toThrow(/integrity/i);
  });

  it("round-trips arbitrary cosmetic whitespace through storage unchanged", () => {
    const adversarial =
      "// a hand-authored doc\n\n\nsection:  Spacing\ntext:   tabs\tand   spaces   \n\n";
    const back = fromStorageRecord(toStorageRecord(adversarial));
    expect(back).toBe(adversarial); // sacred bytes — never normalized
  });
});
