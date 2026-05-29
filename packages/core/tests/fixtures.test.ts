import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseIntentText } from "../src/parser";

function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (k === "id") {
        out[k] = "id";
      } else {
        out[k] = normalize(v);
      }
    }
    return out;
  }
  return value;
}

describe("IntentText Fixtures", () => {
  const fixturesDir = join(__dirname, "..", "fixtures");

  const files = readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".it"))
    .sort();

  for (const itFile of files) {
    const base = itFile.slice(0, -3);

    it(`${base}`, () => {
      const input = readFileSync(join(fixturesDir, itFile), "utf-8");
      const expectedRaw = readFileSync(
        join(fixturesDir, `${base}.json`),
        "utf-8",
      );

      const parsed = parseIntentText(input);
      const normalizedParsed = normalize(parsed);
      const expected = JSON.parse(expectedRaw);

      expect(normalizedParsed).toEqual(expected);
    });
  }
});
