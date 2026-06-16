import { describe, it, expect } from "vitest";
import {
  hasRedactions,
  extractRedactions,
  applyRedactions,
  verifyRedaction,
  renderHTML,
  parseIntentText,
  sealDocument,
  verifyDocument,
} from "../src/index";

const doc = `title: FOIA Response
text: The agent [John Carter]{redact: PII §6} met the source at [Cairo safehouse 12]{redact: classified}.`;

describe("redaction — legally remove content", () => {
  it("detects + extracts pending redaction marks", () => {
    expect(hasRedactions(doc)).toBe(true);
    const r = extractRedactions(doc);
    expect(r).toEqual([
      { text: "John Carter", reason: "PII §6" },
      { text: "Cairo safehouse 12", reason: "classified" },
    ]);
  });

  it("apply removes the sensitive text entirely and inserts black-bar markers", () => {
    const { source, receipts } = applyRedactions(doc);
    // the secrets are GONE from the output
    expect(source).not.toContain("John Carter");
    expect(source).not.toContain("Cairo safehouse 12");
    // markers + commitments are present
    expect(source).toContain("redacted: PII §6");
    expect(source).toContain("redacted: classified");
    expect(source).toMatch(/commit: sha256:[0-9a-f]+/);
    expect(receipts).toHaveLength(2);
    expect(hasRedactions(source)).toBe(false); // no pending marks remain
  });

  it("a receipt proves what a marker covered; a wrong guess fails", () => {
    const { source, receipts } = applyRedactions(doc);
    const commit = /commit:\s*(sha256:[0-9a-f]+)/.exec(source)![1];
    const first = receipts[0];
    expect(verifyRedaction(first.commit, "John Carter", first.salt)).toBe(true);
    expect(verifyRedaction(first.commit, "Jane Doe", first.salt)).toBe(false);
    // the marker's commit equals the receipt's commit (same redaction)
    expect(commit).toBe(first.commit);
  });

  it("renders the applied redaction as a black bar, not the text", () => {
    const { source } = applyRedactions(doc);
    const html = renderHTML(parseIntentText(source));
    expect(html).toContain('class="it-redacted"');
    expect(html).not.toContain("John Carter");
  });

  it("a redacted document seals + verifies (tamper-evident)", () => {
    const { source } = applyRedactions(doc);
    const sealed = sealDocument(source, { signer: "Records Office" }).source;
    expect(verifyDocument(sealed).intact).toBe(true);
    // altering the redacted doc post-seal breaks verification
    const tampered = sealed.replace("redacted: classified", "redacted: nothing");
    expect(verifyDocument(tampered).intact).toBe(false);
  });
});
