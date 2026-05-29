import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseIntentText, _resetIdCounter } from "../src/parser";
import { executeWorkflow } from "../src/executor";
import type {
  WorkflowRuntime,
  ExecutionResult,
  ExecutionContext,
} from "../src/executor";

beforeEach(() => _resetIdCounter());

// ── Helpers ────────────────────────────────────────────────────────────────

function parse(source: string) {
  return parseIntentText(source);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Basic execution
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — basic step execution", () => {
  it("executes steps in order and passes outputs between steps", async () => {
    const doc = parse(`
title: Test Workflow
step: Look up customer | tool: crm.lookup | input: {{phone}} | output: customer
step: Send email | tool: email.send | input: {{customer}} | depends: block-1
`);
    const result = await executeWorkflow(doc, {
      tools: {
        "crm.lookup": async (input) => ({ name: "Alice", email: "a@b.com" }),
        "email.send": async (input) => ({ sent: true }),
      },
      context: { phone: "0501234567" },
    });

    expect(result.status).toBe("completed");
    expect(result.context.customer).toEqual({
      name: "Alice",
      email: "a@b.com",
    });
    expect(result.log.length).toBeGreaterThanOrEqual(2);
  });

  it("resolves {{variable}} in input: property from context", async () => {
    const doc = parse(`
title: Test
step: Fetch | tool: fetch | input: {{url}} | output: data
`);
    let receivedInput: unknown;
    const result = await executeWorkflow(doc, {
      tools: {
        fetch: async (input) => {
          receivedInput = input;
          return { ok: true };
        },
      },
      context: { url: "https://api.example.com/data" },
    });

    expect(result.status).toBe("completed");
    expect(receivedInput).toBe("https://api.example.com/data");
  });

  it("stores step output in context under output: key", async () => {
    const doc = parse(`
title: Test
step: Get user | tool: getUser | output: user
`);
    const result = await executeWorkflow(doc, {
      tools: {
        getUser: async () => ({ id: 42, name: "Bob" }),
      },
    });

    expect(result.context.user).toEqual({ id: 42, name: "Bob" });
  });

  it("skips steps with unregistered tools when unknownTool: warn", async () => {
    const doc = parse(`
title: Test
step: Unknown | tool: noSuchTool
`);
    const result = await executeWorkflow(doc, {
      options: { unknownTool: "warn" },
    });

    expect(result.status).toBe("completed");
    const entry = result.log.find((e) => e.blockType === "step");
    expect(entry?.status).toBe("skipped");
  });

  it("throws when unknownTool: error and tool not registered", async () => {
    const doc = parse(`
title: Test
step: Unknown | tool: noSuchTool
`);
    const result = await executeWorkflow(doc, {
      options: { unknownTool: "error" },
    });

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("noSuchTool");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Decision blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — decision blocks", () => {
  it("evaluates == condition correctly", async () => {
    const doc = parse(`
title: Test
decision: Check status | if: {{status}} == 'paid' | then: ship | else: wait
`);
    const result = await executeWorkflow(doc, {
      context: { status: "paid" },
    });

    expect(result.status).toBe("completed");
    const decision = result.context.__lastDecision as Record<string, unknown>;
    expect(decision.result).toBe(true);
    expect(decision.took).toBe("ship");
  });

  it("evaluates != condition correctly", async () => {
    const doc = parse(`
title: Test
decision: Check | if: {{status}} != 'paid' | then: wait | else: ship
`);
    const result = await executeWorkflow(doc, {
      context: { status: "pending" },
    });

    const decision = result.context.__lastDecision as Record<string, unknown>;
    expect(decision.result).toBe(true);
    expect(decision.took).toBe("wait");
  });

  it("evaluates < > <= >= conditions", async () => {
    const doc = parse(`
title: Test
decision: Check amount | if: {{amount}} > 100 | then: expensive | else: cheap
`);
    const result = await executeWorkflow(doc, {
      context: { amount: 250 },
    });

    const decision = result.context.__lastDecision as Record<string, unknown>;
    expect(decision.result).toBe(true);
    expect(decision.took).toBe("expensive");
  });

  it("takes then: branch when condition true", async () => {
    const doc = parse(`
title: Test
decision: Route | if: {{ready}} == true | then: proceed | else: halt
`);
    const result = await executeWorkflow(doc, {
      context: { ready: true },
    });

    const decision = result.context.__lastDecision as Record<string, unknown>;
    expect(decision.result).toBe(true);
    expect(decision.took).toBe("proceed");
  });

  it("takes else: branch when condition false", async () => {
    const doc = parse(`
title: Test
decision: Route | if: {{ready}} == true | then: proceed | else: halt
`);
    const result = await executeWorkflow(doc, {
      context: { ready: false },
    });

    const decision = result.context.__lastDecision as Record<string, unknown>;
    expect(decision.result).toBe(false);
    expect(decision.took).toBe("halt");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Gate blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — gate blocks", () => {
  it("returns gate_blocked when onGate not provided", async () => {
    const doc = parse(`
title: Test
gate: Manager approval | approver: manager
`);
    const result = await executeWorkflow(doc);

    expect(result.status).toBe("gate_blocked");
    expect(result.blockedAt?.type).toBe("gate");
  });

  it("returns gate_blocked when onGate resolves false", async () => {
    const doc = parse(`
title: Test
gate: Manager approval | approver: manager
`);
    const result = await executeWorkflow(doc, {
      onGate: async () => false,
    });

    expect(result.status).toBe("gate_blocked");
  });

  it("continues execution when onGate resolves true", async () => {
    const doc = parse(`
title: Test
gate: Manager approval | approver: manager
step: Send | tool: email.send
`);
    const result = await executeWorkflow(doc, {
      onGate: async () => true,
      tools: {
        "email.send": async () => ({ sent: true }),
      },
    });

    expect(result.status).toBe("completed");
    const gateEntry = result.log.find((e) => e.blockType === "gate");
    expect(gateEntry?.status).toBe("completed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Context blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — context", () => {
  it("merges context: blocks into execution context", async () => {
    const doc = parse(`
title: Test
context: Agent setup | goal: send notifications | region: us-east
step: Notify | tool: notify | input: {{goal}}
`);
    let receivedInput: unknown;
    const result = await executeWorkflow(doc, {
      tools: {
        notify: async (input) => {
          receivedInput = input;
          return "ok";
        },
      },
    });

    expect(result.status).toBe("completed");
    expect(receivedInput).toBe("send notifications");
  });

  it("runtime.context overrides context: blocks", async () => {
    const doc = parse(`
title: Test
context: Setup | region: us-east
step: Check | tool: check | input: {{region}}
`);
    let receivedInput: unknown;
    const result = await executeWorkflow(doc, {
      context: { region: "eu-west" },
      tools: {
        check: async (input) => {
          receivedInput = input;
          return "ok";
        },
      },
    });

    expect(receivedInput).toBe("eu-west");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Audit and Result blocks
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — audit and result blocks", () => {
  it("resolves {{variables}} in audit: block content", async () => {
    const doc = parse(`
title: Test
step: Get data | tool: getData | output: name
audit: Processed {{name}} at {{timestamp}}
`);
    const result = await executeWorkflow(doc, {
      tools: {
        getData: async () => "Alice",
      },
    });

    expect(result.status).toBe("completed");
    // Find the audit block in the result document
    const auditBlock = result.document.blocks.find((b) => b.type === "audit");
    expect(auditBlock?.content).toContain("Alice");
  });

  it("resolves {{variables}} in result: block content", async () => {
    const doc = parse(`
title: Test
step: Compute | tool: compute | output: total
result: Total is {{total}}
`);
    const result = await executeWorkflow(doc, {
      tools: {
        compute: async () => 42,
      },
    });

    const resultBlock = result.document.blocks.find((b) => b.type === "result");
    expect(resultBlock?.content).toBe("Total is 42");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Status write-back
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — status write-back", () => {
  it("writes status: done to completed step blocks", async () => {
    const doc = parse(`
title: Test
step: Do work | tool: work
`);
    const result = await executeWorkflow(doc, {
      tools: { work: async () => "done" },
    });

    const step = result.document.blocks.find((b) => b.type === "step");
    expect(step?.properties?.status).toBe("done");
  });

  it("writes status: failed to errored step blocks", async () => {
    const doc = parse(`
title: Test
step: Fail | tool: broken
`);
    const result = await executeWorkflow(doc, {
      tools: {
        broken: async () => {
          throw new Error("boom");
        },
      },
    });

    expect(result.status).toBe("error");
    const step = result.document.blocks.find((b) => b.type === "step");
    expect(step?.properties?.status).toBe("failed");
  });

  it("writes status: blocked to gate blocks when blocked", async () => {
    const doc = parse(`
title: Test
gate: Need approval
`);
    const result = await executeWorkflow(doc);

    const gate = result.document.blocks.find((b) => b.type === "gate");
    expect(gate?.properties?.status).toBe("blocked");
  });

  it("writes status: approved to gate blocks when approved", async () => {
    const doc = parse(`
title: Test
gate: Need approval
`);
    const result = await executeWorkflow(doc, {
      onGate: async () => true,
    });

    const gate = result.document.blocks.find((b) => b.type === "gate");
    expect(gate?.properties?.status).toBe("approved");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Dry run
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — dry run", () => {
  it("dry run does not call tool handlers", async () => {
    const handler = vi.fn().mockResolvedValue("result");
    const doc = parse(`
title: Test
step: Work | tool: myTool
`);
    const result = await executeWorkflow(doc, {
      tools: { myTool: handler },
      options: { dryRun: true },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe("dry_run");
  });

  it("dry run marks all steps as dry_run status", async () => {
    const doc = parse(`
title: Test
step: Work | tool: myTool
`);
    const result = await executeWorkflow(doc, {
      tools: { myTool: async () => "x" },
      options: { dryRun: true },
    });

    const step = result.document.blocks.find((b) => b.type === "step");
    expect(step?.properties?.status).toBe("dry_run");
  });

  it("dry run returns dry_run status", async () => {
    const doc = parse(`
title: Test
step: Work | tool: myTool
`);
    const result = await executeWorkflow(doc, {
      options: { dryRun: true },
    });

    expect(result.status).toBe("dry_run");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Error handling
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — error handling", () => {
  it("returns error status when step throws", async () => {
    const doc = parse(`
title: Test
step: Boom | tool: explode
`);
    const result = await executeWorkflow(doc, {
      tools: {
        explode: async () => {
          throw new Error("kaboom");
        },
      },
    });

    expect(result.status).toBe("error");
    expect(result.error?.message).toBe("kaboom");
  });

  it("returns error status when maxSteps exceeded", async () => {
    // Create a doc with 3 steps but max 1
    const doc = parse(`
title: Test
step: A | tool: noop
step: B | tool: noop
step: C | tool: noop
`);
    const result = await executeWorkflow(doc, {
      tools: { noop: async () => "ok" },
      options: { maxSteps: 1 },
    });

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("Max steps");
  });

  it("step timeout returns error status", async () => {
    const doc = parse(`
title: Test
step: Slow | tool: slow
`);
    const result = await executeWorkflow(doc, {
      tools: {
        slow: () => new Promise((resolve) => setTimeout(resolve, 5000)),
      },
      options: { stepTimeout: 50 },
    });

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("timed out");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Output document immutability
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — output document", () => {
  it("returned document has status written back to all processed blocks", async () => {
    const doc = parse(`
title: Test
trigger: Start
step: Work | tool: work
result: Done
`);
    const result = await executeWorkflow(doc, {
      tools: { work: async () => "ok" },
    });

    const trigger = result.document.blocks.find((b) => b.type === "trigger");
    const step = result.document.blocks.find((b) => b.type === "step");
    const res = result.document.blocks.find((b) => b.type === "result");

    expect(trigger?.properties?.status).toBe("done");
    expect(step?.properties?.status).toBe("done");
    expect(res?.properties?.status).toBe("done");
  });

  it("returned document is a new object — original not mutated", async () => {
    const doc = parse(`
title: Test
step: Work | tool: work
`);
    const originalBlocks = JSON.stringify(doc.blocks);

    await executeWorkflow(doc, {
      tools: { work: async () => "ok" },
    });

    // Original document untouched
    expect(JSON.stringify(doc.blocks)).toBe(originalBlocks);
  });

  it("execution log has one entry per processed block", async () => {
    const doc = parse(`
title: Test
trigger: Start
step: A | tool: a
step: B | tool: b | depends: block-2
result: End
`);
    const result = await executeWorkflow(doc, {
      tools: {
        a: async () => "ok",
        b: async () => "ok",
      },
    });

    // Should have entries for trigger, step A, step B, result
    expect(result.log.length).toBe(4);
    expect(result.log.every((e) => e.timestamp)).toBe(true);
    expect(result.log.every((e) => e.durationMs !== undefined)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Lifecycle hooks
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — lifecycle hooks", () => {
  it("calls onStepStart and onStepComplete", async () => {
    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();

    const doc = parse(`
title: Test
step: Work | tool: work
`);
    await executeWorkflow(doc, {
      tools: { work: async () => 42 },
      onStepStart,
      onStepComplete,
    });

    expect(onStepStart).toHaveBeenCalledTimes(1);
    expect(onStepComplete).toHaveBeenCalledTimes(1);
    expect(onStepComplete.mock.calls[0][1]).toBe(42); // output arg
  });

  it("calls onStepError when step fails", async () => {
    const onStepError = vi.fn();

    const doc = parse(`
title: Test
step: Fail | tool: boom
`);
    await executeWorkflow(doc, {
      tools: {
        boom: async () => {
          throw new Error("err");
        },
      },
      onStepError,
    });

    expect(onStepError).toHaveBeenCalledTimes(1);
    expect(onStepError.mock.calls[0][1].message).toBe("err");
  });

  it("calls onAudit when audit block is processed", async () => {
    const onAudit = vi.fn();

    const doc = parse(`
title: Test
audit: Record created
`);
    await executeWorkflow(doc, { onAudit });

    expect(onAudit).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Skipped block types
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — out-of-scope block types", () => {
  it("skips loop/parallel/retry/wait and logs as skipped", async () => {
    const doc = parse(`
title: Test
loop: Repeat | max: 3
parallel: Fan out
retry: Try again | max: 2
wait: Hold | timeout: 5s
`);
    const result = await executeWorkflow(doc);

    expect(result.status).toBe("completed");
    for (const entry of result.log) {
      expect(entry.status).toBe("skipped");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Condition evaluator edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — condition evaluator", () => {
  it("handles && logical conjunction", async () => {
    const doc = parse(`
title: Test
decision: Both | if: {{a}} == 1 && {{b}} == 2 | then: yes | else: no
`);
    const result = await executeWorkflow(doc, {
      context: { a: 1, b: 2 },
    });
    const d = result.context.__lastDecision as Record<string, unknown>;
    expect(d.result).toBe(true);
  });

  it("handles || logical disjunction", async () => {
    const doc = parse(`
title: Test
decision: Either | if: {{a}} == 1 || {{b}} == 2 | then: yes | else: no
`);
    const result = await executeWorkflow(doc, {
      context: { a: 99, b: 2 },
    });
    const d = result.context.__lastDecision as Record<string, unknown>;
    expect(d.result).toBe(true);
  });

  it("handles nested dot path in variables", async () => {
    const doc = parse(`
title: Test
decision: Check | if: {{order.status}} == 'paid' | then: ship | else: wait
`);
    const result = await executeWorkflow(doc, {
      context: { order: { status: "paid" } },
    });
    const d = result.context.__lastDecision as Record<string, unknown>;
    expect(d.result).toBe(true);
  });

  it("returns false for malformed conditions", async () => {
    const doc = parse(`
title: Test
decision: Bad | if: ??? bogus !!! | then: yes | else: no
`);
    const result = await executeWorkflow(doc);
    const d = result.context.__lastDecision as Record<string, unknown>;
    expect(d.result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Policy enforcement (requires: gate)
// ═══════════════════════════════════════════════════════════════════════════

describe("executeWorkflow — policy enforcement", () => {
  it("returns policy_blocked when requires:gate but no gate present", async () => {
    const doc = parse(`
title: Test
policy: Approval required | requires: gate
step: Send | tool: email.send
`);
    const result = await executeWorkflow(doc, {
      tools: { "email.send": async () => ({ sent: true }) },
    });

    expect(result.status).toBe("policy_blocked");
    expect(result.blockedByPolicy?.type).toBe("policy");
    expect(result.log).toHaveLength(0);
  });

  it("allows execution when requires:gate and an approved gate is present", async () => {
    const doc = parse(`
title: Test
policy: Approval required | requires: gate
gate: Manager approval | status: approved
step: Send | tool: email.send
`);
    const result = await executeWorkflow(doc, {
      onGate: async () => true,
      tools: { "email.send": async () => ({ sent: true }) },
    });

    expect(result.status).toBe("completed");
  });

  it("skips policy check when requires:gate condition (if:) evaluates false", async () => {
    const doc = parse(`
title: Test
policy: Approval required | requires: gate | if: {{env}} == 'prod'
step: Send | tool: email.send
`);
    const result = await executeWorkflow(doc, {
      context: { env: "staging" },
      tools: { "email.send": async () => ({ sent: true }) },
    });

    expect(result.status).toBe("completed");
  });

  it("blocks when requires:gate condition (if:) evaluates true and no approved gate", async () => {
    const doc = parse(`
title: Test
policy: Approval required | requires: gate | if: {{env}} == 'prod'
step: Send | tool: email.send
`);
    const result = await executeWorkflow(doc, {
      context: { env: "prod" },
      tools: { "email.send": async () => ({ sent: true }) },
    });

    expect(result.status).toBe("policy_blocked");
  });

  it("policy without requires:gate does not block execution", async () => {
    const doc = parse(`
title: Test
policy: Audit only | action: log
step: Send | tool: email.send
`);
    const result = await executeWorkflow(doc, {
      tools: { "email.send": async () => ({ sent: true }) },
    });

    expect(result.status).toBe("completed");
  });
});
