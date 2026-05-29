import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  parseIntentTextSafe,
  renderHTML,
  validateDocumentSemantic,
  documentToSource,
  _resetIdCounter,
} from "../src";

beforeEach(() => {
  _resetIdCounter();
});

// ── Parser ────────────────────────────────────────────────────

describe("policy: parser", () => {
  it("parses policy: with if and action", () => {
    const doc = parseIntentText(
      "policy: Standard refund | if: order_age_days < 30 | action: approve",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("policy");
    expect(block.content).toBe("Standard refund");
    expect(block.properties?.if).toBe("order_age_days < 30");
    expect(block.properties?.action).toBe("approve");
  });

  it("parses policy: with always", () => {
    const doc = parseIntentText(
      "policy: Language | always: respond_in_user_language",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("policy");
    expect(block.content).toBe("Language");
    expect(block.properties?.always).toBe("respond_in_user_language");
  });

  it("parses policy: with never and requires", () => {
    const doc = parseIntentText(
      "policy: Data protection | never: share_personal_data | requires: manager_approval",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("policy");
    expect(block.properties?.never).toBe("share_personal_data");
    expect(block.properties?.requires).toBe("manager_approval");
  });

  it("preserves unknown properties (open schema)", () => {
    const doc = parseIntentText(
      "policy: Custom rule | custom_prop: some_value | if: x > 0",
    );
    const block = doc.blocks[0];
    expect(block.properties?.custom_prop).toBe("some_value");
    expect(block.properties?.if).toBe("x > 0");
  });

  it("parses multiple policy blocks in a document", () => {
    const doc = parseIntentText(`title: Policies
policy: Refund standard | if: order_age_days < 30 | action: approve
policy: Fraud block | if: fraud_score > 0.8 | action: deny | notify: fraud-team
policy: Tone | always: professional | never: casual`);
    const policies = doc.blocks.filter((b) => b.type === "policy");
    expect(policies).toHaveLength(3);
  });

  it("does not trigger UNKNOWN_KEYWORD warning", () => {
    const result = parseIntentTextSafe("policy: Test rule | always: be_nice");
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ── Renderer ──────────────────────────────────────────────────

describe("policy: renderer", () => {
  it("renders with it-policy class", () => {
    const doc = parseIntentText("policy: Rule name | always: be_nice");
    const html = renderHTML(doc);
    expect(html).toContain("it-policy");
    expect(html).toContain("it-policy-name");
    expect(html).toContain("Rule name");
  });

  it("renders if: with it-policy-condition class", () => {
    const doc = parseIntentText(
      "policy: Refund | if: age < 30 | action: approve",
    );
    const html = renderHTML(doc);
    expect(html).toContain("it-policy-condition");
    expect(html).toContain("if age &lt; 30");
  });

  it("renders always: with it-policy-always class", () => {
    const doc = parseIntentText(
      "policy: Language | always: respond_in_user_language",
    );
    const html = renderHTML(doc);
    expect(html).toContain("it-policy-always");
    expect(html).toContain("always: respond_in_user_language");
  });

  it("renders never: with it-policy-never class", () => {
    const doc = parseIntentText("policy: Privacy | never: share_personal_data");
    const html = renderHTML(doc);
    expect(html).toContain("it-policy-never");
    expect(html).toContain("never: share_personal_data");
  });

  it("renders action: with it-policy-action class", () => {
    const doc = parseIntentText(
      "policy: Refund | if: age < 30 | action: approve",
    );
    const html = renderHTML(doc);
    expect(html).toContain("it-policy-action");
    expect(html).toContain("→ approve");
  });

  it("renders requires: with it-policy-requires class", () => {
    const doc = parseIntentText(
      "policy: Override | action: approve | requires: manager_approval",
    );
    const html = renderHTML(doc);
    expect(html).toContain("it-policy-requires");
    expect(html).toContain("requires: manager_approval");
  });
});

// ── Validation ────────────────────────────────────────────────

describe("policy: validation", () => {
  it("passes with if: and action:", () => {
    const doc = parseIntentText(
      "policy: Refund | if: age < 30 | action: approve",
    );
    const result = validateDocumentSemantic(doc);
    const policyIssues = result.issues.filter((i) =>
      i.code.startsWith("POLICY_"),
    );
    expect(policyIssues).toHaveLength(0);
  });

  it("warns POLICY_NO_CONDITION when no if/always/never", () => {
    const doc = parseIntentText("policy: Dangling rule | action: approve");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "POLICY_NO_CONDITION")).toBe(
      true,
    );
  });

  it("warns POLICY_NO_ACTION when if: but no action/notify/requires", () => {
    const doc = parseIntentText("policy: Half rule | if: age < 30");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "POLICY_NO_ACTION")).toBe(true);
  });

  it("passes with always: and no action (always IS the action)", () => {
    const doc = parseIntentText("policy: Tone | always: professional_tone");
    const result = validateDocumentSemantic(doc);
    const policyIssues = result.issues.filter((i) =>
      i.code.startsWith("POLICY_"),
    );
    expect(policyIssues).toHaveLength(0);
  });

  it("passes with if: and notify: (notify counts as an action)", () => {
    const doc = parseIntentText(
      "policy: Alert | if: fraud_score > 0.8 | notify: fraud-team",
    );
    const result = validateDocumentSemantic(doc);
    const policyIssues = result.issues.filter((i) =>
      i.code.startsWith("POLICY_"),
    );
    expect(policyIssues).toHaveLength(0);
  });
});

// ── documentToSource ──────────────────────────────────────────

describe("policy: documentToSource", () => {
  it("round-trips policy: block", () => {
    const source =
      "policy: Standard refund | if: order_age_days < 30 | action: approve";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output.trim()).toBe(source);
  });

  it("serialises properties in canonical order", () => {
    const source =
      "policy: Mixed order | action: deny | if: fraud > 0.8 | notify: team";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    // Canonical order: if, then action, then notify
    expect(output).toContain("if: fraud > 0.8 | action: deny | notify: team");
  });
});
