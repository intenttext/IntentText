import { IntentDocument, IntentBlock } from "./types";
import { extractWorkflow } from "./workflow";
import { flattenBlocks } from "./utils";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A tool handler — provided by the caller, called by the executor.
 * Receives the resolved input value and full context.
 * Returns the output value (stored in context under output: key).
 */
export type ToolHandler = (
  input: unknown,
  context: ExecutionContext,
) => Promise<unknown> | unknown;

/** Runtime provided by the caller. */
export interface WorkflowRuntime {
  /** Tool implementations — keyed by tool: property value. */
  tools?: Record<string, ToolHandler>;
  /** Initial context variables — merged with context: blocks. */
  context?: Record<string, unknown>;
  /** Called when a gate: block is reached. Resolve true (approved) or false (rejected). */
  onGate?: (gate: IntentBlock, context: ExecutionContext) => Promise<boolean>;
  /** Step lifecycle hooks. */
  onStepStart?: (step: IntentBlock, context: ExecutionContext) => void;
  onStepComplete?: (
    step: IntentBlock,
    output: unknown,
    context: ExecutionContext,
  ) => void;
  onStepError?: (
    step: IntentBlock,
    error: Error,
    context: ExecutionContext,
  ) => void;
  /** Called when an audit: block is reached. */
  onAudit?: (audit: IntentBlock, context: ExecutionContext) => void;
  /** Execution options. */
  options?: ExecutionOptions;
}

export interface ExecutionOptions {
  /** Maximum steps to execute (prevent runaway). Default: 1000. */
  maxSteps?: number;
  /** Timeout per step in ms. Default: 30000. */
  stepTimeout?: number;
  /** What to do when a tool is not registered. Default: 'warn'. */
  unknownTool?: "skip" | "error" | "warn";
  /** Evaluate decisions and validate but do not call tools. Default: false. */
  dryRun?: boolean;
}

/** Live execution context — variables available to steps and decisions. */
export type ExecutionContext = Record<string, unknown>;

/** Result of running a workflow. */
export interface ExecutionResult {
  /** The document with status: written back to each block. */
  document: IntentDocument;
  /** Final execution context (all outputs). */
  context: ExecutionContext;
  /** Execution log — one entry per block processed. */
  log: ExecutionLogEntry[];
  /** Overall status. */
  status: "completed" | "gate_blocked" | "policy_blocked" | "error" | "dry_run";
  /** Error if status is 'error'. */
  error?: Error;
  /** Gate block if status is 'gate_blocked'. */
  blockedAt?: IntentBlock;
  /** Policy block that blocked execution (status is 'policy_blocked'). */
  blockedByPolicy?: IntentBlock;
}

export interface ExecutionLogEntry {
  blockId: string;
  blockType: string;
  content: string;
  status:
    | "skipped"
    | "running"
    | "completed"
    | "failed"
    | "blocked"
    | "dry_run";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
  timestamp: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Property keys that must never be traversed (prototype pollution guard)
const DANGEROUS_PATH_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const MAX_PATH_DEPTH = 20;

/** Resolve a dotted path on an object. Safe against prototype pollution. */
function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  if (keys.length > MAX_PATH_DEPTH) return undefined;

  return keys.reduce((cur: unknown, key: string) => {
    if (cur === null || cur === undefined) return undefined;
    if (DANGEROUS_PATH_KEYS.has(key)) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      if (!isNaN(idx) && idx >= 0 && idx < cur.length) return cur[idx];
      return undefined;
    }
    if (typeof cur === "object") {
      return Object.prototype.hasOwnProperty.call(cur, key)
        ? (cur as Record<string, unknown>)[key]
        : undefined;
    }
    return undefined;
  }, obj);
}

/** Resolve a value from context. Handles plain strings, {{variable}}, {{nested.path}}. */
function resolveValue(
  value: string | undefined,
  context: ExecutionContext,
): unknown {
  if (value === undefined || value === null) return undefined;
  const str = String(value);
  // Exact single-reference: "{{foo}}" → return the raw value (preserves type)
  const exactMatch = str.match(/^\{\{([^}]+)\}\}$/);
  if (exactMatch) {
    return getByPath(context, exactMatch[1].trim()) ?? str;
  }
  // Mixed template: "Hello {{name}}" → resolve inline
  return resolveTemplate(str, context);
}

/** Resolve all {{variables}} in a template string. */
function resolveTemplate(template: string, context: ExecutionContext): string {
  if (!template.includes("{{")) return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath) => {
    const path = rawPath.trim();
    if (path.length > 200) return _match; // reject suspiciously long paths
    const val = getByPath(context, path);
    if (val !== undefined && val !== null) return String(val);
    return _match; // leave unresolved
  });
}

// ── Condition evaluator ─────────────────────────────────────────────────────
// Safe recursive-descent parser. NO eval(). NO Function().
// Grammar:
//   expr     → or_expr
//   or_expr  → and_expr ( '||' and_expr )*
//   and_expr → cmp_expr ( '&&' cmp_expr )*
//   cmp_expr → atom ( ('==' | '!=' | '<=' | '>=' | '<' | '>') atom )?
//   atom     → '(' expr ')' | string_literal | number | boolean | null | {{var}}

type Token =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "null" }
  | { type: "var"; path: string }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (input[i] === " " || input[i] === "\t") {
      i++;
      continue;
    }

    // String literal (single or double quoted)
    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i];
      i++;
      let val = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          val += input[i];
        } else {
          val += input[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: "string", value: val });
      continue;
    }

    // Variable reference: {{path}}
    if (input[i] === "{" && input[i + 1] === "{") {
      i += 2;
      let path = "";
      while (i < input.length && !(input[i] === "}" && input[i + 1] === "}")) {
        path += input[i];
        i++;
      }
      i += 2; // skip }}
      tokens.push({ type: "var", path: path.trim() });
      continue;
    }

    // Two-char operators
    const two = input.slice(i, i + 2);
    if (
      two === "==" ||
      two === "!=" ||
      two === "<=" ||
      two === ">=" ||
      two === "&&" ||
      two === "||"
    ) {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }

    // Single-char operators
    if (input[i] === "<" || input[i] === ">") {
      tokens.push({ type: "op", value: input[i] });
      i++;
      continue;
    }

    // Parens
    if (input[i] === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (input[i] === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    // Number literal
    if (
      (input[i] >= "0" && input[i] <= "9") ||
      (input[i] === "-" &&
        i + 1 < input.length &&
        input[i + 1] >= "0" &&
        input[i + 1] <= "9")
    ) {
      let num = "";
      if (input[i] === "-") {
        num += "-";
        i++;
      }
      while (
        i < input.length &&
        ((input[i] >= "0" && input[i] <= "9") || input[i] === ".")
      ) {
        num += input[i];
        i++;
      }
      tokens.push({ type: "number", value: Number(num) });
      continue;
    }

    // Keywords: true, false, null
    const rest = input.slice(i);
    if (
      rest.startsWith("true") &&
      (i + 4 >= input.length || !/\w/.test(input[i + 4]))
    ) {
      tokens.push({ type: "boolean", value: true });
      i += 4;
      continue;
    }
    if (
      rest.startsWith("false") &&
      (i + 5 >= input.length || !/\w/.test(input[i + 5]))
    ) {
      tokens.push({ type: "boolean", value: false });
      i += 5;
      continue;
    }
    if (
      rest.startsWith("null") &&
      (i + 4 >= input.length || !/\w/.test(input[i + 4]))
    ) {
      tokens.push({ type: "null" });
      i += 4;
      continue;
    }

    // Unknown character — skip
    i++;
  }

  return tokens;
}

function atomValue(token: Token, context: ExecutionContext): unknown {
  switch (token.type) {
    case "string":
      return token.value;
    case "number":
      return token.value;
    case "boolean":
      return token.value;
    case "null":
      return null;
    case "var":
      return getByPath(context, token.path);
    default:
      return undefined;
  }
}

function compare(op: string, left: unknown, right: unknown): boolean {
  // Coerce to number for numeric comparisons
  const lNum = typeof left === "number" ? left : Number(left);
  const rNum = typeof right === "number" ? right : Number(right);

  switch (op) {
    case "==":
      // eslint-disable-next-line eqeqeq
      return left == right;
    case "!=":
      // eslint-disable-next-line eqeqeq
      return left != right;
    case "<":
      return lNum < rNum;
    case ">":
      return lNum > rNum;
    case "<=":
      return lNum <= rNum;
    case ">=":
      return lNum >= rNum;
    default:
      return false;
  }
}

/** Evaluate a condition string against context. Safe — no eval(). */
function evaluateCondition(
  condition: string | undefined,
  context: ExecutionContext,
): boolean {
  if (!condition) return true;

  try {
    const tokens = tokenize(condition);
    let pos = 0;

    function peek(): Token | undefined {
      return tokens[pos];
    }
    function advance(): Token {
      return tokens[pos++];
    }

    function parseExpr(): boolean {
      return parseOr();
    }

    function parseOr(): boolean {
      let left = parseAnd();
      while (
        peek()?.type === "op" &&
        (peek() as Token & { value: string }).value === "||"
      ) {
        advance(); // consume ||
        const right = parseAnd();
        left = left || right;
      }
      return left;
    }

    function parseAnd(): boolean {
      let left = parseCmp();
      while (
        peek()?.type === "op" &&
        (peek() as Token & { value: string }).value === "&&"
      ) {
        advance(); // consume &&
        const right = parseCmp();
        left = left && right;
      }
      return left;
    }

    function parseCmp(): boolean {
      const leftVal = parseAtom();
      const next = peek();
      if (next?.type === "op" && next.value !== "&&" && next.value !== "||") {
        const op = (advance() as Token & { value: string }).value;
        const rightVal = parseAtom();
        return compare(op, leftVal, rightVal);
      }
      // Truthy check
      return !!leftVal;
    }

    function parseAtom(): unknown {
      const token = peek();
      if (!token) return undefined;

      if (token.type === "lparen") {
        advance(); // consume (
        const val = parseExpr();
        if (peek()?.type === "rparen") advance(); // consume )
        return val;
      }

      advance();
      return atomValue(token, context);
    }

    return parseExpr();
  } catch {
    return false;
  }
}

// ── Document mutation helpers (operate on the cloned document) ──────────────

/** Find a block by id in a document (searches recursively). */
function findBlockById(
  doc: IntentDocument,
  blockId: string,
): IntentBlock | undefined {
  const all = flattenBlocks(doc.blocks);
  return all.find((b) => b.id === blockId);
}

/** Write status: property back to a block in the document. */
function writeStatus(
  doc: IntentDocument,
  blockId: string,
  status: string,
): void {
  const block = findBlockById(doc, blockId);
  if (!block) return;
  if (!block.properties) block.properties = {};
  block.properties.status = status;
}

/** Update block content (for audit: and result: resolution). */
function updateBlockContent(
  doc: IntentDocument,
  blockId: string,
  content: string,
): void {
  const block = findBlockById(doc, blockId);
  if (!block) return;
  block.content = content;
}

/** Execute a promise with a timeout. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ── Executor ────────────────────────────────────────────────────────────────

/**
 * Execute an IntentText workflow document.
 *
 * Same pattern as mergeData() — pure function, takes document + runtime,
 * returns a new document with execution state written back.
 *
 * The caller provides tool implementations.
 * IntentText provides structure and execution order.
 */
export async function executeWorkflow(
  document: IntentDocument,
  runtime: WorkflowRuntime = {},
): Promise<ExecutionResult> {
  const options = {
    maxSteps: 1000,
    stepTimeout: 30_000,
    unknownTool: "warn" as const,
    dryRun: false,
    ...runtime.options,
  };

  // 1. Extract workflow graph
  const workflow = extractWorkflow(document);

  // 2. Build execution context — runtime.context first, then context: blocks
  const context: ExecutionContext = {};
  const allBlocks = flattenBlocks(document.blocks);

  // Merge context: blocks (document-level context variables)
  for (const block of allBlocks) {
    if (block.type === "context" && block.properties) {
      for (const [k, v] of Object.entries(block.properties)) {
        context[k] = v;
      }
    }
  }

  // Runtime context overrides document context
  if (runtime.context) {
    Object.assign(context, runtime.context);
  }

  // 3. Collect policy: blocks
  const policies: IntentBlock[] = [];
  for (const block of allBlocks) {
    if (block.type === "policy") {
      policies.push(block);
    }
  }
  if (policies.length > 0) {
    context.__policies = policies;
  }

  // 4. Enforce policy: blocks with requires: gate
  //    If a policy's condition is satisfied but no approved gate exists → block immediately.
  for (const policy of policies) {
    const requires = policy.properties?.requires as string | undefined;
    if (requires !== "gate") continue;

    const condition = (policy.properties?.if as string | undefined) ||
      (policy.properties?.always ? "true" : undefined);

    if (!evaluateCondition(condition, context)) continue;

    // Check if any gate block in the document has status: approved
    const hasApprovedGate = allBlocks.some(
      (b) => b.type === "gate" && b.properties?.status === "approved",
    );

    if (!hasApprovedGate) {
      return {
        document,
        context,
        log: [],
        status: "policy_blocked",
        blockedByPolicy: policy,
        error: new Error(
          `Policy "${policy.content}" requires an approved gate but none found`,
        ),
      };
    }
  }

  // 5. Walk executionOrder — string[][] (batches of parallel steps)
  const log: ExecutionLogEntry[] = [];
  const resultDoc = structuredClone(document);
  let stepCount = 0;

  for (const batch of workflow.executionOrder) {
    for (const blockId of batch) {
      if (stepCount >= options.maxSteps) {
        return {
          document: resultDoc,
          context,
          log,
          status: "error",
          error: new Error(`Max steps (${options.maxSteps}) reached`),
        };
      }

      const block = findBlockById(resultDoc, blockId);
      if (!block) continue;

      const entry: ExecutionLogEntry = {
        blockId: block.id,
        blockType: block.type,
        content: block.content,
        status: "running",
        timestamp: new Date().toISOString(),
      };

      const start = Date.now();

      try {
        switch (block.type) {
          case "step": {
            const toolName = block.properties?.tool as string | undefined;
            const inputKey = block.properties?.input as string | undefined;
            const outputKey = block.properties?.output as string | undefined;

            const input = resolveValue(inputKey, context);
            entry.input = input;

            if (options.dryRun) {
              entry.status = "dry_run";
              writeStatus(resultDoc, blockId, "dry_run");
              break;
            }

            if (!toolName) {
              entry.status = "skipped";
              writeStatus(resultDoc, blockId, "skipped");
              break;
            }

            const handler = runtime.tools?.[toolName];
            if (!handler) {
              if (options.unknownTool === "error") {
                throw new Error(`No tool handler registered for: ${toolName}`);
              }
              entry.status = "skipped";
              writeStatus(resultDoc, blockId, "skipped");
              break;
            }

            runtime.onStepStart?.(block, context);

            const output = await withTimeout(
              Promise.resolve(handler(input, context)),
              options.stepTimeout,
              `Step "${block.content}" timed out after ${options.stepTimeout}ms`,
            );

            if (outputKey) {
              context[outputKey] = output;
            }

            runtime.onStepComplete?.(block, output, context);

            entry.output = output;
            entry.status = "completed";
            writeStatus(resultDoc, blockId, "done");
            stepCount++;
            break;
          }

          case "decision": {
            const condition = block.properties?.if as string | undefined;
            const thenTarget = block.properties?.then as string | undefined;
            const elseTarget = block.properties?.else as string | undefined;

            const result = evaluateCondition(condition, context);
            const nextTarget = result ? thenTarget : elseTarget;

            context.__lastDecision = {
              condition,
              result,
              took: nextTarget,
            };

            entry.status = "completed";
            entry.output = { condition, result, branch: nextTarget };
            writeStatus(resultDoc, blockId, "done");
            break;
          }

          case "gate": {
            if (options.dryRun) {
              entry.status = "dry_run";
              writeStatus(resultDoc, blockId, "dry_run");
              break;
            }

            if (!runtime.onGate) {
              writeStatus(resultDoc, blockId, "blocked");
              entry.status = "blocked";
              entry.durationMs = Date.now() - start;
              log.push(entry);
              return {
                document: resultDoc,
                context,
                log,
                status: "gate_blocked",
                blockedAt: block,
              };
            }

            const approved = await runtime.onGate(block, context);
            if (!approved) {
              writeStatus(resultDoc, blockId, "rejected");
              entry.status = "blocked";
              entry.durationMs = Date.now() - start;
              log.push(entry);
              return {
                document: resultDoc,
                context,
                log,
                status: "gate_blocked",
                blockedAt: block,
              };
            }

            writeStatus(resultDoc, blockId, "approved");
            entry.status = "completed";
            break;
          }

          case "audit": {
            const resolved = resolveTemplate(block.content, context);
            updateBlockContent(resultDoc, blockId, resolved);
            runtime.onAudit?.(block, context);
            entry.status = "completed";
            writeStatus(resultDoc, blockId, "done");
            break;
          }

          case "trigger": {
            entry.status = "completed";
            writeStatus(resultDoc, blockId, "done");
            break;
          }

          case "result": {
            const resolved = resolveTemplate(block.content, context);
            updateBlockContent(resultDoc, blockId, resolved);
            entry.status = "completed";
            writeStatus(resultDoc, blockId, "done");
            break;
          }

          default:
            entry.status = "skipped";
            break;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        entry.status = "failed";
        entry.error = error.message;
        writeStatus(resultDoc, blockId, "failed");
        runtime.onStepError?.(block, error, context);

        entry.durationMs = Date.now() - start;
        log.push(entry);
        return { document: resultDoc, context, log, status: "error", error };
      }

      entry.durationMs = Date.now() - start;
      log.push(entry);
    }
  }

  return {
    document: resultDoc,
    context,
    log,
    status: options.dryRun ? "dry_run" : "completed",
  };
}
