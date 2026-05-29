import { IntentDocument, IntentBlock } from "./types.js";

export interface WorkflowStep {
  block: IntentBlock;
  dependsOn: string[];
  dependedOnBy: string[];
  isGate: boolean;
  isTerminal: boolean;
  isParallel: boolean;
}

export interface WorkflowGraph {
  entryPoints: string[];
  steps: Record<string, WorkflowStep>;
  executionOrder: string[][];
  gatePositions: number[];
  hasTerminal: boolean;
  warnings: string[];
}

const WORKFLOW_TYPES = new Set([
  "step",
  "gate",
  "decision",
  "parallel",
  "wait",
  "result",
  "checkpoint",
  "retry",
  "call",
  "handoff",
  "trigger",
  "loop",
  "signal",
  "error",
  "audit",
]);

function collectWorkflowBlocks(blocks: IntentBlock[]): IntentBlock[] {
  const result: IntentBlock[] = [];
  for (const block of blocks) {
    if (WORKFLOW_TYPES.has(block.type)) {
      result.push(block);
    }
    if (block.children) {
      result.push(...collectWorkflowBlocks(block.children));
    }
  }
  return result;
}

function getStepId(block: IntentBlock): string {
  return (block.properties?.id as string) || block.id;
}

function isInsideParallel(block: IntentBlock, doc: IntentDocument): boolean {
  function search(blocks: IntentBlock[], insideParallel: boolean): boolean {
    for (const b of blocks) {
      const inP = insideParallel || b.type === "parallel";
      if (b === block) return inP;
      if (b.children) {
        const found = search(b.children, inP);
        if (found) return true;
      }
    }
    return false;
  }
  return search(doc.blocks, false);
}

export function extractWorkflow(doc: IntentDocument): WorkflowGraph {
  if (!doc || !doc.blocks) {
    return {
      entryPoints: [],
      steps: {},
      executionOrder: [],
      gatePositions: [],
      hasTerminal: false,
      warnings: ["Empty or invalid document"],
    };
  }

  const warnings: string[] = [];
  const workflowBlocks = collectWorkflowBlocks(doc.blocks);

  if (workflowBlocks.length === 0) {
    return {
      entryPoints: [],
      steps: {},
      executionOrder: [],
      gatePositions: [],
      hasTerminal: false,
      warnings: ["No workflow blocks found"],
    };
  }

  // Build step map
  const steps: Record<string, WorkflowStep> = {};
  const idMap = new Map<string, IntentBlock>(); // track explicit IDs

  for (const block of workflowBlocks) {
    const stepId = getStepId(block);

    if (steps[stepId]) {
      warnings.push(`Duplicate step ID: ${stepId}`);
      continue;
    }

    idMap.set(stepId, block);
    steps[stepId] = {
      block,
      dependsOn: [],
      dependedOnBy: [],
      isGate: block.type === "gate",
      isTerminal: block.type === "result",
      isParallel: isInsideParallel(block, doc),
    };
  }

  // Build dependency graph from depends: property
  for (const [stepId, step] of Object.entries(steps)) {
    const depends = step.block.properties?.depends;
    if (depends && typeof depends === "string") {
      const deps = depends
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      for (const dep of deps) {
        if (!steps[dep]) {
          warnings.push(`Step "${stepId}" depends on unknown step "${dep}"`);
          continue;
        }
        step.dependsOn.push(dep);
        steps[dep].dependedOnBy.push(stepId);
      }
    }
  }

  // Topological sort (Kahn's algorithm)
  const inDegree: Record<string, number> = {};
  for (const id of Object.keys(steps)) {
    inDegree[id] = steps[id].dependsOn.length;
  }

  const executionOrder: string[][] = [];
  const processed = new Set<string>();

  let iterationGuard = 0;
  const maxIterations = Object.keys(steps).length + 1;

  while (
    processed.size < Object.keys(steps).length &&
    iterationGuard < maxIterations
  ) {
    iterationGuard++;

    // Collect all steps with in-degree 0 that haven't been processed
    const batch: string[] = [];
    for (const id of Object.keys(steps)) {
      if (!processed.has(id) && inDegree[id] === 0) {
        batch.push(id);
      }
    }

    if (batch.length === 0) {
      // Cycle detected - add remaining steps with a warning
      const remaining = Object.keys(steps).filter((id) => !processed.has(id));
      warnings.push(`Cycle detected involving: ${remaining.join(", ")}`);
      executionOrder.push(remaining);
      for (const id of remaining) {
        processed.add(id);
      }
      break;
    }

    executionOrder.push(batch);
    for (const id of batch) {
      processed.add(id);
      // Reduce in-degree for dependents
      for (const dependent of steps[id].dependedOnBy) {
        inDegree[dependent]--;
      }
    }
  }

  // Entry points = steps with no dependencies
  const entryPoints = Object.keys(steps).filter(
    (id) => steps[id].dependsOn.length === 0,
  );

  // Gate positions = batch indices that contain a gate
  const gatePositions: number[] = [];
  for (let i = 0; i < executionOrder.length; i++) {
    if (executionOrder[i].some((id) => steps[id]?.isGate)) {
      gatePositions.push(i);
    }
  }

  const hasTerminal = Object.values(steps).some((s) => s.isTerminal);

  return {
    entryPoints,
    steps,
    executionOrder,
    gatePositions,
    hasTerminal,
    warnings,
  };
}
