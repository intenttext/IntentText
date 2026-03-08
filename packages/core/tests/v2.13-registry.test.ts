import { describe, it, expect } from "vitest";
import { parseIntentText } from "../src/parser";
import { renderHTML } from "../src/renderer";

describe("v2.13 Language registry — new block types", () => {
  it("parses cite: as its own block type with properties", () => {
    const doc = parseIntentText(
      "cite: The Pragmatic Programmer | author: Hunt | date: 2019",
    );
    expect(doc.blocks[0].type).toBe("cite");
    expect(doc.blocks[0].content).toBe("The Pragmatic Programmer");
    expect(doc.blocks[0].properties?.author).toBe("Hunt");
    expect(doc.blocks[0].properties?.date).toBe("2019");
  });

  it("parses input: with type and required properties", () => {
    const doc = parseIntentText(
      "input: customer_id | type: string | required: true",
    );
    expect(doc.blocks[0].type).toBe("input");
    expect(doc.blocks[0].content).toBe("customer_id");
    expect(doc.blocks[0].properties?.type).toBe("string");
    expect(doc.blocks[0].properties?.required).toBe("true");
  });

  it("parses output: with type and format properties", () => {
    const doc = parseIntentText("output: report | type: object | format: JSON");
    expect(doc.blocks[0].type).toBe("output");
    expect(doc.blocks[0].content).toBe("report");
    expect(doc.blocks[0].properties?.type).toBe("object");
    expect(doc.blocks[0].properties?.format).toBe("JSON");
  });

  it("parses tool: with api and method properties", () => {
    const doc = parseIntentText(
      "tool: Slack | api: https://hooks.slack.com | method: POST",
    );
    expect(doc.blocks[0].type).toBe("tool");
    expect(doc.blocks[0].content).toBe("Slack");
    expect(doc.blocks[0].properties?.api).toBe("https://hooks.slack.com");
    expect(doc.blocks[0].properties?.method).toBe("POST");
  });

  it("parses prompt: with model property", () => {
    const doc = parseIntentText("prompt: Summarize this | model: claude-3");
    expect(doc.blocks[0].type).toBe("prompt");
    expect(doc.blocks[0].content).toBe("Summarize this");
    expect(doc.blocks[0].properties?.model).toBe("claude-3");
  });

  it("parses memory: with scope property", () => {
    const doc = parseIntentText("memory: migration progress | scope: session");
    expect(doc.blocks[0].type).toBe("memory");
    expect(doc.blocks[0].content).toBe("migration progress");
    expect(doc.blocks[0].properties?.scope).toBe("session");
  });

  it("parses danger: as a callout block type", () => {
    const doc = parseIntentText("danger: This will delete all data");
    expect(doc.blocks[0].type).toBe("danger");
    expect(doc.blocks[0].content).toBe("This will delete all data");
  });

  it("critical: alias resolves to danger block type", () => {
    const doc = parseIntentText("critical: Irreversible operation");
    expect(doc.blocks[0].type).toBe("danger");
  });

  it("destructive: alias resolves to danger block type", () => {
    const doc = parseIntentText("destructive: Drops the table");
    expect(doc.blocks[0].type).toBe("danger");
  });
});

describe("v2.13 Language registry — canonical renames", () => {
  it("note: resolves to text block type", () => {
    const doc = parseIntentText("note: Hello world");
    expect(doc.blocks[0].type).toBe("text");
    expect(doc.blocks[0].content).toBe("Hello world");
  });

  it("text: parses as text block type directly", () => {
    const doc = parseIntentText("text: Direct text");
    expect(doc.blocks[0].type).toBe("text");
  });

  it("emit: resolves to signal block type with deprecation warning", () => {
    const doc = parseIntentText("emit: pipeline_complete");
    expect(doc.blocks[0].type).toBe("signal");
    const deprec = doc.diagnostics?.find(
      (d) => d.code === "DEPRECATED_KEYWORD",
    );
    expect(deprec).toBeDefined();
    expect(deprec!.message).toContain("emit:");
    expect(deprec!.message).toContain("signal:");
  });

  it("status: resolves to signal block type with deprecation warning", () => {
    const doc = parseIntentText("status: pipeline_complete");
    expect(doc.blocks[0].type).toBe("signal");
    const deprec = doc.diagnostics?.find(
      (d) => d.code === "DEPRECATED_KEYWORD",
    );
    expect(deprec).toBeDefined();
    expect(deprec!.message).toContain("status:");
  });

  it("headers: resolves to columns block type", () => {
    const doc = parseIntentText(
      "headers: Name | Age | City\nrow: Alice | 30 | NYC",
    );
    // headers/row produce a table block
    expect(doc.blocks[0].type).toBe("table");
    expect(doc.blocks[0].table?.headers).toEqual(["Name", "Age", "City"]);
  });

  it("columns: works as the canonical form", () => {
    const doc = parseIntentText("columns: Name | Age\nrow: Alice | 30");
    expect(doc.blocks[0].type).toBe("table");
    expect(doc.blocks[0].table?.headers).toEqual(["Name", "Age"]);
  });

  it("done: parses to its own done block type, not task", () => {
    const doc = parseIntentText("done: Fix the bug");
    expect(doc.blocks[0].type).toBe("done");
    expect(doc.blocks[0].properties?.status).toBe("done");
  });
});

describe("v2.13 Language registry — {label} inline syntax", () => {
  it("parses {Label} as inline label node", () => {
    const doc = parseIntentText("text: Review with {Legal} before {2026-Q2}");
    const block = doc.blocks[0];
    expect(block.type).toBe("text");
    const labels = block.inline!.filter((n) => n.type === "label");
    expect(labels).toHaveLength(2);
    expect(labels[0].value).toBe("Legal");
    expect(labels[1].value).toBe("2026-Q2");
  });

  it("label does not conflict with existing inline syntax", () => {
    const doc = parseIntentText("text: Hello *bold* {Tag} @alice");
    const block = doc.blocks[0];
    const types = block.inline!.map((n) => n.type);
    expect(types).toContain("bold");
    expect(types).toContain("label");
    expect(types).toContain("mention");
  });
});

describe("v2.13 Language registry — renderer", () => {
  it("renders cite: block with expected classes", () => {
    const doc = parseIntentText(
      "cite: The Art of War | author: Sun Tzu | url: https://example.com",
    );
    const html = renderHTML(doc);
    expect(html).toContain("it-cite");
    expect(html).toContain("it-cite-title");
    expect(html).toContain("it-cite-author");
  });

  it("renders input: block with expected classes", () => {
    const doc = parseIntentText("input: user_id | type: string");
    const html = renderHTML(doc);
    expect(html).toContain("it-input");
    expect(html).toContain("it-input-name");
  });

  it("renders output: block with expected classes", () => {
    const doc = parseIntentText("output: report | type: object");
    const html = renderHTML(doc);
    expect(html).toContain("it-output");
    expect(html).toContain("it-output-name");
  });

  it("renders tool: block with expected classes", () => {
    const doc = parseIntentText("tool: Slack | api: https://hooks.slack.com");
    const html = renderHTML(doc);
    expect(html).toContain("it-tool");
    expect(html).toContain("it-tool-name");
  });

  it("renders prompt: block with expected classes", () => {
    const doc = parseIntentText("prompt: Summarize | model: gpt-4");
    const html = renderHTML(doc);
    expect(html).toContain("it-prompt");
    expect(html).toContain("it-prompt-content");
  });

  it("renders memory: block with expected classes", () => {
    const doc = parseIntentText("memory: progress | scope: session");
    const html = renderHTML(doc);
    expect(html).toContain("it-memory");
    expect(html).toContain("it-memory-scope");
  });

  it("renders danger: as a callout with expected classes", () => {
    const doc = parseIntentText("danger: Do not delete");
    const html = renderHTML(doc);
    expect(html).toContain("it-danger");
    expect(html).toContain("it-callout");
  });

  it("renders text: (formerly note:) with intent-text class", () => {
    const doc = parseIntentText("text: Hello world");
    const html = renderHTML(doc);
    expect(html).toContain("intent-text");
  });

  it("renders signal: (formerly emit:) with intent-signal class", () => {
    const doc = parseIntentText("signal: pipeline_done");
    const html = renderHTML(doc);
    expect(html).toContain("intent-signal-block");
  });

  it("renders {label} inline as it-label span", () => {
    const doc = parseIntentText("text: Review by {Legal}");
    const html = renderHTML(doc);
    expect(html).toContain("it-label");
    expect(html).toContain("Legal");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v2.13 — assert: and secret: keywords
// ═══════════════════════════════════════════════════════════════════════════

describe("v2.13 assert: keyword", () => {
  it("parses assert: with expect property", () => {
    const doc = parseIntentText(
      "assert: Status is 200 | expect: status == 200",
    );
    expect(doc.blocks[0].type).toBe("assert");
    expect(doc.blocks[0].content).toBe("Status is 200");
    expect(doc.blocks[0].properties?.expect).toBe("status == 200");
  });

  it("parses assert: with severity property", () => {
    const doc = parseIntentText(
      "assert: Token count ok | expect: tokens < 4096 | severity: warning",
    );
    expect(doc.blocks[0].properties?.severity).toBe("warning");
  });

  it("expect: alias resolves to assert", () => {
    const doc = parseIntentText("expect: All tests pass | severity: error");
    expect(doc.blocks[0].type).toBe("assert");
  });

  it("verify: alias resolves to assert", () => {
    const doc = parseIntentText("verify: No PII in output");
    expect(doc.blocks[0].type).toBe("assert");
  });

  it("renders assert: block with expected classes", () => {
    const doc = parseIntentText(
      "assert: Response valid | expect: status == 200",
    );
    const html = renderHTML(doc);
    expect(html).toContain("it-assert");
    expect(html).toContain("it-assert-content");
    expect(html).toContain("it-assert-expect");
    expect(html).toContain("ASSERT");
  });

  it("renders assert: with severity class", () => {
    const doc = parseIntentText("assert: Check passed | severity: warning");
    const html = renderHTML(doc);
    expect(html).toContain("it-assert-warning");
  });

  it("defaults severity to error in render", () => {
    const doc = parseIntentText("assert: Must be true");
    const html = renderHTML(doc);
    expect(html).toContain("it-assert-error");
  });
});

describe("v2.13 secret: keyword", () => {
  it("parses secret: with env property", () => {
    const doc = parseIntentText("secret: SLACK_TOKEN | env: SLACK_BOT_TOKEN");
    expect(doc.blocks[0].type).toBe("secret");
    expect(doc.blocks[0].content).toBe("SLACK_TOKEN");
    expect(doc.blocks[0].properties?.env).toBe("SLACK_BOT_TOKEN");
  });

  it("parses secret: with vault property", () => {
    const doc = parseIntentText(
      "secret: DB_PASSWORD | vault: aws/secretsmanager/prod/db",
    );
    expect(doc.blocks[0].properties?.vault).toBe("aws/secretsmanager/prod/db");
  });

  it("credential: alias resolves to secret", () => {
    const doc = parseIntentText("credential: API_KEY | env: OPENAI_KEY");
    expect(doc.blocks[0].type).toBe("secret");
  });

  it("token: alias resolves to secret", () => {
    const doc = parseIntentText("token: GITHUB_TOKEN");
    expect(doc.blocks[0].type).toBe("secret");
  });

  it("renders secret: as redacted — never shows content", () => {
    const doc = parseIntentText("secret: MY_API_KEY | env: SUPER_SECRET");
    const html = renderHTML(doc);
    expect(html).toContain("it-secret");
    expect(html).toContain("\u2022\u2022\u2022\u2022"); // bullet dots
    expect(html).not.toContain("MY_API_KEY");
    expect(html).not.toContain("SUPER_SECRET");
  });

  it("secret: content is not exposed in rendered HTML", () => {
    const doc = parseIntentText("secret: password123 | env: DB_PASS");
    const html = renderHTML(doc);
    expect(html).not.toContain("password123");
    expect(html).not.toContain("DB_PASS");
  });
});
