import { describe, it, expect } from "vitest";
import { parseIntentText } from "../src/parser";
import { renderHTML } from "../src/renderer";

// ─── Helper ────────────────────────────────────────────────────────────────

function findBlock(input: string, type: string, index = 0) {
  const doc = parseIntentText(input);
  const matches = doc.blocks.filter((b) => b.type === type);
  return { doc, block: matches[index] };
}

function flatBlocks(input: string) {
  const doc = parseIntentText(input);
  const flat: ReturnType<typeof parseIntentText>["blocks"] = [];
  function walk(blocks: typeof flat) {
    for (const b of blocks) {
      flat.push(b);
      if (b.children) walk(b.children);
    }
  }
  walk(doc.blocks);
  return { doc, flat };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Step blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("step: blocks", () => {
  it("parses a basic step with tool and input", () => {
    const { block } = findBlock(
      "step: Verify email | tool: email.verify | input: userId",
      "step",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("Verify email");
    expect(block.properties?.tool).toBe("email.verify");
    expect(block.properties?.input).toBe("userId");
  });

  it("auto-assigns sequential step IDs", () => {
    const input = `step: First step
step: Second step
step: Third step`;
    const doc = parseIntentText(input);
    const steps = doc.blocks.filter((b) => b.type === "step");
    expect(steps[0].id).toBe("step-1");
    expect(steps[0].properties?.id).toBe("step-1");
    expect(steps[1].id).toBe("step-2");
    expect(steps[2].id).toBe("step-3");
  });

  it("respects explicit id and overrides auto-numbering", () => {
    const input = `step: First
step: Second | id: custom-id
step: Third`;
    const doc = parseIntentText(input);
    const steps = doc.blocks.filter((b) => b.type === "step");
    expect(steps[0].id).toBe("step-1");
    expect(steps[1].id).toBe("custom-id");
    expect(steps[2].id).toBe("step-3");
  });

  it("defaults status to 'pending' when not set", () => {
    const { block } = findBlock("step: Something", "step");
    expect(block.properties?.status).toBe("pending");
  });

  it("preserves explicit status", () => {
    const { block } = findBlock("step: Done thing | status: done", "step");
    expect(block.properties?.status).toBe("done");
  });

  it("parses depends property", () => {
    const { block } = findBlock(
      "step: Create workspace | depends: step-1 | tool: ws.create",
      "step",
    );
    expect(block.properties?.depends).toBe("step-1");
  });

  it("parses output property", () => {
    const { block } = findBlock(
      "step: Verify email | tool: email.verify | input: userId | output: emailStatus",
      "step",
    );
    expect(block.properties?.output).toBe("emailStatus");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Decision blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("decision: blocks", () => {
  it("parses if/then/else properties", () => {
    const { block } = findBlock(
      'decision: Check plan | if: plan == "pro" | then: step-3 | else: step-4',
      "decision",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("Check plan");
    expect(block.properties?.if).toBe('plan == "pro"');
    expect(block.properties?.then).toBe("step-3");
    expect(block.properties?.else).toBe("step-4");
  });

  it("works with only if and then (no else)", () => {
    const { block } = findBlock(
      "decision: Check status | if: status == active | then: step-2",
      "decision",
    );
    expect(block.properties?.if).toBe("status == active");
    expect(block.properties?.then).toBe("step-2");
    expect(block.properties?.else).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Trigger blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("trigger: blocks", () => {
  it("parses trigger with event", () => {
    const { block } = findBlock(
      "trigger: webhook | event: user.signup",
      "trigger",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("webhook");
    expect(block.properties?.event).toBe("user.signup");
  });

  it("parses trigger without event", () => {
    const { block } = findBlock("trigger: manual start", "trigger");
    expect(block.content).toBe("manual start");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Loop blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("loop: blocks", () => {
  it("parses loop with over and do", () => {
    const { block } = findBlock(
      "loop: Process items | over: itemList | do: step-3",
      "loop",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("Process items");
    expect(block.properties?.over).toBe("itemList");
    expect(block.properties?.do).toBe("step-3");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Checkpoint blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("checkpoint: blocks", () => {
  it("parses checkpoint with content only", () => {
    const { block } = findBlock("checkpoint: post-setup", "checkpoint");
    expect(block).toBeDefined();
    expect(block.content).toBe("post-setup");
  });

  it("parses checkpoint with no extra properties", () => {
    const { block } = findBlock(
      "checkpoint: onboarding-complete",
      "checkpoint",
    );
    expect(block.content).toBe("onboarding-complete");
    expect(block.properties).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Audit blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("audit: blocks", () => {
  it("parses audit with by and at", () => {
    const { block } = findBlock(
      "audit: Workflow initialized | by: {{agent}} | at: {{timestamp}}",
      "audit",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("Workflow initialized");
    expect(block.properties?.by).toBe("{{agent}}");
    expect(block.properties?.at).toBe("{{timestamp}}");
  });

  it("preserves template variables unparsed", () => {
    const { block } = findBlock(
      "audit: Step completed | by: {{agent}} | at: {{timestamp}}",
      "audit",
    );
    expect(block.properties?.by).toBe("{{agent}}");
    expect(block.properties?.at).toBe("{{timestamp}}");
  });

  it("parses audit without template variables", () => {
    const { block } = findBlock(
      "audit: Manual check | by: admin | at: 2026-03-04",
      "audit",
    );
    expect(block.properties?.by).toBe("admin");
    expect(block.properties?.at).toBe("2026-03-04");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Error blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("error: blocks", () => {
  it("parses error with fallback and notify", () => {
    const { block } = findBlock(
      "error: On failure | fallback: step-2 | notify: admin",
      "error",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("On failure");
    expect(block.properties?.fallback).toBe("step-2");
    expect(block.properties?.notify).toBe("admin");
  });

  it("parses error with fallback only", () => {
    const { block } = findBlock("error: Retry | fallback: step-1", "error");
    expect(block.properties?.fallback).toBe("step-1");
    expect(block.properties?.notify).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Import / Export blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("import: / export: blocks", () => {
  it("parses import with as alias", () => {
    const { block } = findBlock("import: ./auth-flow.it | as: auth", "import");
    expect(block).toBeDefined();
    expect(block.content).toBe("./auth-flow.it");
    expect(block.properties?.as).toBe("auth");
  });

  it("parses export with format", () => {
    const { block } = findBlock("export: userRecord | format: json", "export");
    expect(block).toBeDefined();
    expect(block.content).toBe("userRecord");
    expect(block.properties?.format).toBe("json");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Schema blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("schema: blocks", () => {
  it("parses schema with extends", () => {
    const { block } = findBlock(
      "schema: custom-block-type | extends: step",
      "schema",
    );
    expect(block).toBeDefined();
    expect(block.content).toBe("custom-block-type");
    expect(block.properties?.extends).toBe("step");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Progress blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("progress: blocks", () => {
  it("parses progress with value/total in content", () => {
    const { block } = findBlock("progress: 3/5 tasks completed", "progress");
    expect(block).toBeDefined();
    expect(block.content).toBe("3/5 tasks completed");
  });

  it("parses progress with value and total as properties", () => {
    const { block } = findBlock(
      "progress: Upload | value: 75 | total: 100",
      "progress",
    );
    expect(block.content).toBe("Upload");
    expect(block.properties?.value).toBe("75");
    expect(block.properties?.total).toBe("100");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Context blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("context: blocks", () => {
  it("parses key=value pairs into properties", () => {
    const input = 'context: userId = "u_123" | plan = "pro"';
    const doc = parseIntentText(input);
    const ctx = doc.blocks.find((b) => b.type === "context");
    expect(ctx).toBeDefined();
    expect(ctx!.properties?.userId).toBe("u_123");
    expect(ctx!.properties?.plan).toBe("pro");
  });

  it("populates document metadata.context when before sections", () => {
    const input = `title: My Flow
context: userId = "u_123" | plan = "pro"
section: Steps
step: Do something`;
    const doc = parseIntentText(input);
    expect(doc.metadata?.context).toEqual({ userId: "u_123", plan: "pro" });
  });

  it("handles unquoted values", () => {
    const input = "context: count = 42 | mode = fast";
    const doc = parseIntentText(input);
    const ctx = doc.blocks.find((b) => b.type === "context");
    expect(ctx!.properties?.count).toBe("42");
    expect(ctx!.properties?.mode).toBe("fast");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Document metadata (agent / model)
// ═══════════════════════════════════════════════════════════════════════════

describe("document metadata: agent: and model:", () => {
  it("agent: before sections populates metadata, not blocks", () => {
    const input = `title: Onboard
agent: onboard-agent | model: claude-sonnet-4
section: Steps
step: Do something`;
    const doc = parseIntentText(input);
    expect(doc.metadata?.agent).toBe("onboard-agent");
    expect(doc.metadata?.model).toBe("claude-sonnet-4");
    // agent should NOT appear as a block
    expect(doc.blocks.find((b) => b.type === ("agent" as any))).toBeUndefined();
  });

  it("model: as standalone header populates metadata", () => {
    const input = `title: My Flow
model: gpt-4
step: Do something`;
    const doc = parseIntentText(input);
    expect(doc.metadata?.model).toBe("gpt-4");
    expect(doc.blocks.find((b) => b.type === ("model" as any))).toBeUndefined();
  });

  it("agent: after a section is treated as a regular block (not metadata)", () => {
    const input = `section: Agents
agent: worker-agent`;
    const doc = parseIntentText(input);
    // agent after section is NOT metadata
    expect(doc.metadata?.agent).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Version detection
// ═══════════════════════════════════════════════════════════════════════════

describe("version detection", () => {
  it("v1 documents remain version 1.4", () => {
    const input = `title: Simple Doc
task: Do something | owner: Ahmed`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("1.4");
  });

  it("documents with v2.0 agentic blocks get version 2.0", () => {
    const input = `title: Flow
step: Do something`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.0");
  });

  it("documents with agent metadata get version 2.0", () => {
    const input = `title: Flow
agent: my-agent
task: Legacy task`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.0");
  });

  it("documents with v2.1 inter-agent blocks get version 2.1", () => {
    const input = `title: Inter-Agent Flow
status: Running | phase: init
result: Done | code: 200`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.1");
  });

  it("handoff block triggers version 2.1", () => {
    const input = `title: Handoff Test
handoff: Transfer | from: agent-a | to: agent-b`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.1");
  });

  it("wait/parallel/retry blocks trigger version 2.1", () => {
    const input = `title: Advanced
wait: User input | timeout: 30s
parallel: Run checks | steps: a,b
retry: Fetch data | max: 3`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.1");
  });

  it("mixed v2.0 and v2.1 blocks get version 2.1", () => {
    const input = `title: Mixed
step: Do something
handoff: Transfer to billing`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.1");
  });

  it("v2.1 blocks inside sections detected correctly", () => {
    const input = `title: Nested
section: Workflow
status: Active | phase: deploy
result: Success`;
    const doc = parseIntentText(input);
    expect(doc.version).toBe("2.1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Backward compatibility
// ═══════════════════════════════════════════════════════════════════════════

describe("backward compatibility", () => {
  it("v1 document with tasks parses identically", () => {
    const input = `title: Project Plan
summary: Quarterly update

section: Team Tasks
task: Database migration | owner: Ahmed | due: Sunday
done: Secure the domain | time: 09:00 AM

section: Questions
ask: Who has the key?`;
    const doc = parseIntentText(input);

    expect(doc.blocks[0].type).toBe("title");
    expect(doc.blocks[0].content).toBe("Project Plan");
    expect(doc.blocks[1].type).toBe("summary");
    expect(doc.blocks[2].type).toBe("section");
    expect(doc.blocks[2].content).toBe("Team Tasks");

    const tasks = doc.blocks[2].children!;
    expect(tasks[0].type).toBe("task");
    expect(tasks[0].content).toBe("Database migration");
    expect(tasks[0].properties?.owner).toBe("Ahmed");
    expect(tasks[1].type).toBe("task");
    expect(tasks[1].properties?.status).toBe("done");
  });

  it("mixed v1 and v2 blocks parse correctly", () => {
    const input = `title: Hybrid Doc
agent: my-agent

section: Verification
step: Verify email | tool: email.verify
task: Fallback manual check | owner: Ahmed

note: This is a mixed document`;
    const doc = parseIntentText(input);

    expect(doc.metadata?.agent).toBe("my-agent");
    expect(doc.version).toBe("2.0");

    const section = doc.blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    const children = section!.children!;
    expect(children.some((c) => c.type === "step")).toBe(true);
    expect(children.some((c) => c.type === "task")).toBe(true);
  });

  it("all v1 block types still work", () => {
    const input = `title: Full v1 Test
summary: Testing all v1 types
section: Main
sub: Details
note: A note
info: Information
warning: Be careful
tip: Pro tip
success: All good
task: Do something | owner: Team
done: Did it | time: 10:00
ask: Any questions?
quote: Wise words | by: Author
link: Click here | to: https://example.com
image: Photo | at: photo.png | caption: A photo`;
    const doc = parseIntentText(input);

    expect(doc.blocks.length).toBeGreaterThan(0);
    expect(doc.blocks.find((b) => b.type === "title")).toBeDefined();
    expect(doc.blocks.find((b) => b.type === "summary")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Full example from spec
// ═══════════════════════════════════════════════════════════════════════════

describe("full agentic workflow example", () => {
  it("parses the complete example correctly", () => {
    const input = `title: User Onboarding Flow
agent: onboard-agent | model: claude-sonnet-4

context: userId = "u_123" | plan = "pro"

section: Verification

step: Verify email address | tool: email.verify | input: userId | output: emailStatus
step: Create user workspace | tool: ws.create | depends: step-1 | input: userId
decision: Check plan | if: plan == "pro" | then: step-3 | else: step-4
step: Enable pro features | id: step-3 | tool: features.enable | status: pending
step: Send welcome email | id: step-4 | tool: email.send

checkpoint: onboarding-complete

audit: Workflow initialized | by: {{agent}} | at: {{timestamp}}`;

    const doc = parseIntentText(input);

    // Metadata
    expect(doc.metadata?.title).toBe("User Onboarding Flow");
    expect(doc.metadata?.agent).toBe("onboard-agent");
    expect(doc.metadata?.model).toBe("claude-sonnet-4");
    expect(doc.metadata?.context).toEqual({ userId: "u_123", plan: "pro" });

    // Version
    expect(doc.version).toBe("2.0");

    // Find section children
    const section = doc.blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    expect(section!.content).toBe("Verification");

    const children = section!.children!;
    // Steps
    const steps = children.filter((b) => b.type === "step");
    expect(steps).toHaveLength(4);
    expect(steps[0].id).toBe("step-1");
    expect(steps[0].content).toBe("Verify email address");
    expect(steps[0].properties?.tool).toBe("email.verify");

    expect(steps[1].id).toBe("step-2");
    expect(steps[1].properties?.depends).toBe("step-1");

    // Decision
    const decision = children.find((b) => b.type === "decision");
    expect(decision).toBeDefined();
    expect(decision!.content).toBe("Check plan");
    expect(decision!.properties?.if).toBe('plan == "pro"');
    expect(decision!.properties?.then).toBe("step-3");
    expect(decision!.properties?.else).toBe("step-4");

    // Steps with explicit ids
    expect(steps[2].id).toBe("step-3");
    expect(steps[3].id).toBe("step-4");

    // Checkpoint (nested inside section as a content block)
    const checkpoint = children.find((b) => b.type === "checkpoint");
    expect(checkpoint).toBeDefined();
    expect(checkpoint!.content).toBe("onboarding-complete");

    // Audit (also nested inside section)
    const audit = children.find((b) => b.type === "audit");
    expect(audit).toBeDefined();
    expect(audit!.properties?.by).toBe("{{agent}}");
    expect(audit!.properties?.at).toBe("{{timestamp}}");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. Rendering
// ═══════════════════════════════════════════════════════════════════════════

describe("v2 block rendering", () => {
  it("renders step block with status badge and tool", () => {
    const doc = parseIntentText("step: Verify email | tool: email.verify");
    const html = renderHTML(doc);
    expect(html).toContain("intent-step");
    expect(html).toContain("▶");
    expect(html).toContain("Verify email");
    expect(html).toContain("email.verify");
    expect(html).toContain("intent-status-pending");
  });

  it("renders decision block with diamond", () => {
    const doc = parseIntentText(
      'decision: Check plan | if: plan == "pro" | then: step-3 | else: step-4',
    );
    const html = renderHTML(doc);
    expect(html).toContain("intent-decision");
    expect(html).toContain("intent-decision-diamond");
    expect(html).toContain("Check plan");
    expect(html).toContain("step-3");
    expect(html).toContain("step-4");
  });

  it("renders trigger block with bolt icon", () => {
    const doc = parseIntentText("trigger: webhook | event: user.signup");
    const html = renderHTML(doc);
    expect(html).toContain("intent-trigger");
    expect(html).toContain("⚡");
    expect(html).toContain("user.signup");
  });

  it("renders loop block", () => {
    const doc = parseIntentText(
      "loop: Process items | over: itemList | do: step-3",
    );
    const html = renderHTML(doc);
    expect(html).toContain("intent-loop");
    expect(html).toContain("🔁");
    expect(html).toContain("itemList");
  });

  it("renders checkpoint block as milestone", () => {
    const doc = parseIntentText("checkpoint: post-setup");
    const html = renderHTML(doc);
    expect(html).toContain("intent-checkpoint");
    expect(html).toContain("🚩");
    expect(html).toContain("post-setup");
  });

  it("renders audit block as monospace log", () => {
    const doc = parseIntentText(
      "audit: Step completed | by: agent-1 | at: 2026-03-04",
    );
    const html = renderHTML(doc);
    expect(html).toContain("intent-audit");
    expect(html).toContain("Step completed");
    expect(html).toContain("agent-1");
  });

  it("renders error block as red callout", () => {
    const doc = parseIntentText(
      "error: On failure | fallback: step-2 | notify: admin",
    );
    const html = renderHTML(doc);
    expect(html).toContain("intent-error-block");
    expect(html).toContain("On failure");
    expect(html).toContain("step-2");
  });

  it("renders context block as key-value table", () => {
    const doc = parseIntentText('context: userId = "u_123" | plan = "pro"');
    const html = renderHTML(doc);
    expect(html).toContain("intent-context-table");
    expect(html).toContain("userId");
    expect(html).toContain("u_123");
  });

  it("renders progress block with progress bar", () => {
    const doc = parseIntentText("progress: 3/5 tasks completed");
    const html = renderHTML(doc);
    expect(html).toContain("intent-progress");
    expect(html).toContain("intent-progress-bar");
    expect(html).toContain("60%");
  });

  it("renders import block", () => {
    const doc = parseIntentText("import: ./auth-flow.it | as: auth");
    const html = renderHTML(doc);
    expect(html).toContain("intent-import");
    expect(html).toContain("📥");
    expect(html).toContain("auth");
  });

  it("renders export block", () => {
    const doc = parseIntentText("export: userRecord | format: json");
    const html = renderHTML(doc);
    expect(html).toContain("intent-export");
    expect(html).toContain("📤");
    expect(html).toContain("json");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. Edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  it("step with confidence property", () => {
    const { block } = findBlock(
      "step: Analyze data | tool: analysis.run | confidence: 0.9",
      "step",
    );
    expect(block.properties?.confidence).toBe("0.9");
  });

  it("step with source property", () => {
    const { block } = findBlock("step: Review code | source: human", "step");
    expect(block.properties?.source).toBe("human");
  });

  it("multiple context blocks accumulate metadata", () => {
    const input = `context: a = "1"
context: b = "2"
step: Go`;
    const doc = parseIntentText(input);
    expect(doc.metadata?.context?.a).toBe("1");
    expect(doc.metadata?.context?.b).toBe("2");
  });

  it("empty step content still gets an id", () => {
    const input = "step: ";
    const doc = parseIntentText(input);
    const step = doc.blocks.find((b) => b.type === "step");
    expect(step).toBeDefined();
    expect(step!.id).toBe("step-1");
  });

  it("agentic blocks nest inside sections", () => {
    const input = `section: Workflow
step: First | tool: a.run
decision: Branch | if: x == 1 | then: step-2
step: Second`;
    const doc = parseIntentText(input);
    const section = doc.blocks[0];
    expect(section.type).toBe("section");
    expect(section.children).toHaveLength(3);
    expect(section.children![0].type).toBe("step");
    expect(section.children![1].type).toBe("decision");
    expect(section.children![2].type).toBe("step");
  });

  it("schema block with extends", () => {
    const { block } = findBlock(
      "schema: custom-type | extends: step",
      "schema",
    );
    expect(block.properties?.extends).toBe("step");
  });

  it("trigger with no properties", () => {
    const { block } = findBlock("trigger: manual", "trigger");
    expect(block.content).toBe("manual");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v2.1 New block types
// ═══════════════════════════════════════════════════════════════════════════

// ─── status: blocks ────────────────────────────────────────────────────────

describe("status: blocks", () => {
  it("basic status block", () => {
    const { block } = findBlock("status: In Progress", "status");
    expect(block.type).toBe("status");
    expect(block.content).toBe("In Progress");
  });

  it("status with phase property", () => {
    const { block } = findBlock("status: Active | phase: onboarding", "status");
    expect(block.content).toBe("Active");
    expect(block.properties?.phase).toBe("onboarding");
  });

  it("status with level property", () => {
    const { block } = findBlock(
      "status: Warning state | level: warning",
      "status",
    );
    expect(block.properties?.level).toBe("warning");
  });

  it("renders status block HTML", () => {
    const doc = parseIntentText("status: Deploying | phase: release");
    const html = renderHTML(doc);
    expect(html).toContain("intent-status-block");
    expect(html).toContain("📊");
    expect(html).toContain("Deploying");
    expect(html).toContain("release");
  });
});

// ─── result: blocks ────────────────────────────────────────────────────────

describe("result: blocks", () => {
  it("basic result block defaults status to success", () => {
    const { block } = findBlock("result: User created", "result");
    expect(block.type).toBe("result");
    expect(block.content).toBe("User created");
    expect(block.properties?.status).toBe("success");
  });

  it("result with explicit status and code", () => {
    const { block } = findBlock(
      "result: Request failed | status: error | code: 500",
      "result",
    );
    expect(block.properties?.status).toBe("error");
    expect(block.properties?.code).toBe("500");
  });

  it("result with data property", () => {
    const { block } = findBlock(
      'result: Created | data: {"id":"u_123"}',
      "result",
    );
    expect(block.properties?.data).toBe('{"id":"u_123"}');
  });

  it("renders result block HTML", () => {
    const doc = parseIntentText("result: All tests passed | code: 200");
    const html = renderHTML(doc);
    expect(html).toContain("intent-result");
    expect(html).toContain("✅");
    expect(html).toContain("All tests passed");
    expect(html).toContain("200");
  });
});

// ─── handoff: blocks ───────────────────────────────────────────────────────

describe("handoff: blocks", () => {
  it("basic handoff block", () => {
    const { block } = findBlock("handoff: Transfer control", "handoff");
    expect(block.type).toBe("handoff");
    expect(block.content).toBe("Transfer control");
  });

  it("handoff with from and to agents", () => {
    const { block } = findBlock(
      "handoff: Pass to billing | from: onboarding-agent | to: billing-agent",
      "handoff",
    );
    expect(block.properties?.from).toBe("onboarding-agent");
    expect(block.properties?.to).toBe("billing-agent");
  });

  it("renders handoff block HTML with arrow", () => {
    const doc = parseIntentText(
      "handoff: Transfer | from: agent-a | to: agent-b",
    );
    const html = renderHTML(doc);
    expect(html).toContain("intent-handoff");
    expect(html).toContain("🤝");
    expect(html).toContain("agent-a");
    expect(html).toContain("agent-b");
    expect(html).toContain("→");
  });
});

// ─── wait: blocks ──────────────────────────────────────────────────────────

describe("wait: blocks", () => {
  it("basic wait block defaults status to waiting", () => {
    const { block } = findBlock("wait: User confirmation", "wait");
    expect(block.type).toBe("wait");
    expect(block.content).toBe("User confirmation");
    expect(block.properties?.status).toBe("waiting");
  });

  it("wait with timeout and fallback", () => {
    const { block } = findBlock(
      "wait: Approval | timeout: 30s | fallback: step-3",
      "wait",
    );
    expect(block.properties?.timeout).toBe("30s");
    expect(block.properties?.fallback).toBe("step-3");
  });

  it("wait with numeric timeout coercion", () => {
    const { block } = findBlock("wait: Signal | timeout: 5000", "wait");
    expect(block.properties?.timeout).toBe(5000);
  });

  it("renders wait block HTML", () => {
    const doc = parseIntentText("wait: External API | timeout: 10s");
    const html = renderHTML(doc);
    expect(html).toContain("intent-wait");
    expect(html).toContain("⏳");
    expect(html).toContain("External API");
    expect(html).toContain("10s");
  });
});

// ─── parallel: blocks ──────────────────────────────────────────────────────

describe("parallel: blocks", () => {
  it("basic parallel block", () => {
    const { block } = findBlock("parallel: Run checks", "parallel");
    expect(block.type).toBe("parallel");
    expect(block.content).toBe("Run checks");
  });

  it("parallel with steps property", () => {
    const { block } = findBlock(
      "parallel: Run checks | steps: validate,lint,test",
      "parallel",
    );
    expect(block.properties?.steps).toBe("validate,lint,test");
  });

  it("parallel with timeout", () => {
    const { block } = findBlock(
      "parallel: Batch jobs | timeout: 60000",
      "parallel",
    );
    expect(block.properties?.timeout).toBe(60000);
  });

  it("renders parallel block HTML with step badges", () => {
    const doc = parseIntentText("parallel: Checks | steps: validate,lint,test");
    const html = renderHTML(doc);
    expect(html).toContain("intent-parallel");
    expect(html).toContain("⏩");
    expect(html).toContain("validate");
    expect(html).toContain("lint");
    expect(html).toContain("test");
  });
});

// ─── retry: blocks ─────────────────────────────────────────────────────────

describe("retry: blocks", () => {
  it("basic retry block", () => {
    const { block } = findBlock("retry: API call", "retry");
    expect(block.type).toBe("retry");
    expect(block.content).toBe("API call");
  });

  it("retry with max, delay, and backoff", () => {
    const { block } = findBlock(
      "retry: Fetch data | max: 3 | delay: 1000 | backoff: exponential",
      "retry",
    );
    expect(block.properties?.max).toBe(3);
    expect(block.properties?.delay).toBe(1000);
    expect(block.properties?.backoff).toBe("exponential");
  });

  it("retry with retries property (alias for max)", () => {
    const { block } = findBlock("retry: Send email | retries: 5", "retry");
    expect(block.properties?.retries).toBe(5);
  });

  it("renders retry block HTML", () => {
    const doc = parseIntentText(
      "retry: API call | max: 3 | delay: 500 | backoff: linear",
    );
    const html = renderHTML(doc);
    expect(html).toContain("intent-retry");
    expect(html).toContain("🔄");
    expect(html).toContain("API call");
    expect(html).toContain("max: 3");
    expect(html).toContain("500ms");
    expect(html).toContain("linear");
  });
});

// ─── New pipe properties (v2.1) ────────────────────────────────────────────

describe("v2.1 pipe properties", () => {
  it("timeout property on step block", () => {
    const { block } = findBlock("step: Fetch data | timeout: 30000", "step");
    expect(block.properties?.timeout).toBe(30000);
  });

  it("timeout property with string value (unit suffix)", () => {
    const { block } = findBlock("step: Process | timeout: 30s", "step");
    expect(block.properties?.timeout).toBe("30s");
  });

  it("priority property coerced to number", () => {
    const { block } = findBlock("step: Critical task | priority: 1", "step");
    expect(block.properties?.priority).toBe(1);
  });

  it("data property preserved as string", () => {
    const { block } = findBlock(
      'result: Done | data: {"key":"value"}',
      "result",
    );
    expect(block.properties?.data).toBe('{"key":"value"}');
  });

  it("retries property coerced to number", () => {
    const { block } = findBlock("step: API call | retries: 3", "step");
    expect(block.properties?.retries).toBe(3);
  });

  it("delay property coerced to number", () => {
    const { block } = findBlock("step: Wait then run | delay: 2000", "step");
    expect(block.properties?.delay).toBe(2000);
  });

  it("level property stays as string", () => {
    const { block } = findBlock("status: Warning | level: critical", "status");
    expect(block.properties?.level).toBe("critical");
  });

  it("multiple new properties on one block", () => {
    const { block } = findBlock(
      "step: Complex task | timeout: 5000 | priority: 2 | retries: 3",
      "step",
    );
    expect(block.properties?.timeout).toBe(5000);
    expect(block.properties?.priority).toBe(2);
    expect(block.properties?.retries).toBe(3);
  });
});

// ─── v2.1 blocks inside sections ──────────────────────────────────────────

describe("v2.1 blocks nest inside sections", () => {
  it("status, result, handoff nest as section children", () => {
    const input = `section: Workflow
status: Running | phase: init
result: Step 1 done | code: 200
handoff: Transfer | to: next-agent`;
    const doc = parseIntentText(input);
    const section = doc.blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    expect(section!.children).toHaveLength(3);
    expect(section!.children![0].type).toBe("status");
    expect(section!.children![1].type).toBe("result");
    expect(section!.children![2].type).toBe("handoff");
  });

  it("wait, parallel, retry nest as section children", () => {
    const input = `section: Execution
wait: User input | timeout: 60s
parallel: Run tests | steps: a,b,c
retry: API call | max: 3`;
    const doc = parseIntentText(input);
    const section = doc.blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    expect(section!.children).toHaveLength(3);
    expect(section!.children![0].type).toBe("wait");
    expect(section!.children![1].type).toBe("parallel");
    expect(section!.children![2].type).toBe("retry");
  });
});
