/**
 * format-version-stamp.test.ts — FORMAT-REVIEW T-04.
 *
 * A `.it` file may declare the grammar version it conforms to with an OPTIONAL
 * `// it-format: <version>` comment in the leading header. Because it is a comment
 * it never enters the seal hash and round-trips as trivia. `document.version` reads
 * it; `document.detectedFeatureLevel` is the independent, sniffed feature level.
 */
import { describe, it, expect } from "vitest";
import { parseIntentText, documentToSource, computeDocumentHash } from "../src/index";

describe("T-04: // it-format: version stamp", () => {
  it("sets document.version from a leading header comment", () => {
    const doc = parseIntentText("// it-format: 1.0\ntitle: X\ntext: hi\n");
    expect(doc.version).toBe("1.0");
    expect(doc.detectedFeatureLevel).toBe("1.4"); // sniffed, independent of the stamp
  });

  it("falls back to the detected feature level when no stamp is present", () => {
    const doc = parseIntentText(
      "title: X\nsign: A | at: 2026-01-01 | hash: sha256:x\n",
    );
    expect(doc.version).toBe("2.8"); // version IS the sniffed level (trust content)
    expect(doc.detectedFeatureLevel).toBeUndefined(); // only surfaced when stamped
  });

  it("is byte-preserved on round-trip (it is just a comment)", () => {
    const src = "// it-format: 1.0\ntitle: Contract\ntext: body\n";
    const once = documentToSource(parseIntentText(src));
    expect(once).toContain("// it-format: 1.0");
    const twice = documentToSource(parseIntentText(once));
    expect(twice).toBe(once); // idempotent
  });

  it("never affects the seal/content hash (comments are excluded)", () => {
    const base = "title: Contract\ntext: body\n";
    expect(computeDocumentHash("// it-format: 1.0\n" + base)).toBe(
      computeDocumentHash(base),
    );
  });

  it("is ignored outside the leading header (body/code lines do not count)", () => {
    const doc = parseIntentText("title: X\ntext: hi\n// it-format: 9.9\n");
    expect(doc.version).not.toBe("9.9");
    expect(doc.version).toBe("1.4"); // unstamped → detected level
    expect(doc.detectedFeatureLevel).toBeUndefined();
  });

  it("tolerates whitespace variants", () => {
    expect(parseIntentText("//it-format:2.0\ntitle: X\n").version).toBe("2.0");
    expect(parseIntentText("//   it-format:   3.1  \ntitle: X\n").version).toBe("3.1");
  });
});
