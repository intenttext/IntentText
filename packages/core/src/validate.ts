import { IntentDocument, IntentBlock } from "./types";
import { flattenBlocks } from "./utils";

export interface SemanticIssue {
  blockId: string;
  blockType: string;
  type: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface SemanticValidationResult {
  valid: boolean;
  issues: SemanticIssue[];
}

/**
 * Semantic validation of an IntentDocument.
 * Checks cross-block references, required properties, and structural rules.
 * Pure function — does not mutate the input.
 */
export function validateDocumentSemantic(
  doc: IntentDocument,
): SemanticValidationResult {
  if (!doc || !Array.isArray(doc.blocks)) {
    return { valid: true, issues: [] };
  }

  const issues: SemanticIssue[] = [];
  const allBlocks = flattenBlocks(doc.blocks);

  // Build a set of all known step IDs (explicit id: property or auto-assigned)
  const stepIds = new Set<string>();
  const seenExplicitIds = new Map<string, IntentBlock>();

  for (const block of allBlocks) {
    const explicitId =
      block.properties?.id != null ? String(block.properties.id) : null;
    if (explicitId) {
      if (seenExplicitIds.has(explicitId)) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "error",
          code: "DUPLICATE_STEP_ID",
          message: `Duplicate id "${explicitId}" — also used by a ${seenExplicitIds.get(explicitId)!.type} block`,
        });
      } else {
        seenExplicitIds.set(explicitId, block);
      }
      stepIds.add(explicitId);
    }
    stepIds.add(block.id);
  }

  // Collect context variables and step outputs for unresolved-variable detection
  const declaredVars = new Set<string>();
  const contextBlock = allBlocks.find((b) => b.type === "context");
  if (contextBlock?.properties) {
    for (const key of Object.keys(contextBlock.properties)) {
      declaredVars.add(key);
    }
  }
  if (doc.metadata?.context) {
    for (const key of Object.keys(doc.metadata.context)) {
      declaredVars.add(key);
    }
  }
  for (const block of allBlocks) {
    if (block.type === "step" && block.properties?.output) {
      declaredVars.add(String(block.properties.output));
    }
  }

  // Track sections for structural checks
  let lastSection: IntentBlock | null = null;
  let blocksInCurrentSection = 0;

  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];

    // Section tracking
    if (block.type === "section") {
      if (lastSection && blocksInCurrentSection === 0) {
        issues.push({
          blockId: lastSection.id,
          blockType: lastSection.type,
          type: "warning",
          code: "EMPTY_SECTION",
          message: `Section "${lastSection.content}" is empty`,
        });
      }
      lastSection = block;
      blocksInCurrentSection = 0;
    } else if (lastSection) {
      blocksInCurrentSection++;
    }

    // decision: blocks — check then/else references
    if (block.type === "decision") {
      const thenRef = block.properties?.then
        ? String(block.properties.then)
        : null;
      const elseRef = block.properties?.else
        ? String(block.properties.else)
        : null;
      if (thenRef && !stepIds.has(thenRef)) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "error",
          code: "STEP_REF_MISSING",
          message: `decision "then" references step "${thenRef}" which does not exist`,
        });
      }
      if (elseRef && !stepIds.has(elseRef)) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "error",
          code: "STEP_REF_MISSING",
          message: `decision "else" references step "${elseRef}" which does not exist`,
        });
      }
    }

    // step: depends references
    if (block.type === "step" && block.properties?.depends) {
      const deps = String(block.properties.depends)
        .split(",")
        .map((s) => s.trim());
      for (const dep of deps) {
        if (dep && !stepIds.has(dep)) {
          issues.push({
            blockId: block.id,
            blockType: block.type,
            type: "error",
            code: "DEPENDS_REF_MISSING",
            message: `step depends on "${dep}" which does not exist`,
          });
        }
      }
    }

    // parallel: steps references
    if (block.type === "parallel" && block.properties?.steps) {
      const refs = String(block.properties.steps)
        .split(",")
        .map((s) => s.trim());
      for (const ref of refs) {
        if (ref && !stepIds.has(ref)) {
          issues.push({
            blockId: block.id,
            blockType: block.type,
            type: "error",
            code: "PARALLEL_REF_MISSING",
            message: `parallel references step "${ref}" which does not exist`,
          });
        }
      }
    }

    // call: self-reference check
    if (block.type === "call") {
      const titleBlock = allBlocks.find((b) => b.type === "title");
      const callTarget = block.content || String(block.properties?.to || "");
      if (titleBlock && callTarget && callTarget === titleBlock.content) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "error",
          code: "CALL_LOOP",
          message: `call references the document's own title "${callTarget}"`,
        });
      }
    }

    // result: must be last in its section (or document)
    if (block.type === "result") {
      // Find the next non-result block in the same level
      const remaining = allBlocks.slice(i + 1);
      const nextNonResult = remaining.find(
        (b) => b.type !== "section" && b.type !== "result",
      );
      const nextSection = remaining.find((b) => b.type === "section");

      if (
        nextNonResult &&
        (!nextSection ||
          allBlocks.indexOf(nextNonResult) < allBlocks.indexOf(nextSection))
      ) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "error",
          code: "RESULT_NOT_TERMINAL",
          message: "result block is not the last block in its section",
        });
      }
    }

    // gate: without approver
    if (block.type === "gate" && !block.properties?.approver) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "warning",
        code: "GATE_NO_APPROVER",
        message: "gate block has no approver property",
      });
    }

    // step: without tool
    if (block.type === "step" && !block.properties?.tool) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "warning",
        code: "STEP_NO_TOOL",
        message: "step block has no tool property",
      });
    }

    // handoff: without to
    if (block.type === "handoff" && !block.properties?.to) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "warning",
        code: "HANDOFF_NO_TO",
        message: "handoff block has no 'to' property",
      });
    }

    // retry: without max
    if (block.type === "retry" && !block.properties?.max) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "warning",
        code: "RETRY_NO_MAX",
        message: "retry block has no 'max' property",
      });
    }

    // policy: without any condition
    if (block.type === "policy") {
      const hasCondition =
        block.properties?.if ||
        block.properties?.always ||
        block.properties?.never;
      if (!hasCondition) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "warning",
          code: "POLICY_NO_CONDITION",
          message: `Policy "${block.content}" has no condition (if:, always:, or never:). Add a condition or use note: instead.`,
        });
      }
      // policy: with if: but no action/notify/requires
      if (
        block.properties?.if &&
        !block.properties?.action &&
        !block.properties?.notify &&
        !block.properties?.requires
      ) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          type: "warning",
          code: "POLICY_NO_ACTION",
          message: `Policy "${block.content}" has a condition but no action. Add action:, notify:, or requires:.`,
        });
      }
    }

    // Check for unresolved {{variables}} in content and property values
    checkUnresolvedVars(block, declaredVars, issues);
  }

  // Check last section emptiness
  if (lastSection && blocksInCurrentSection === 0) {
    issues.push({
      blockId: lastSection.id,
      blockType: lastSection.type,
      type: "warning",
      code: "EMPTY_SECTION",
      message: `Section "${lastSection.content}" is empty`,
    });
  }

  // Info: no title
  if (!allBlocks.some((b) => b.type === "title")) {
    issues.push({
      blockId: "",
      blockType: "",
      type: "info",
      code: "DOCUMENT_NO_TITLE",
      message: "Document has no title block",
    });
  }

  // Info: template with unresolved variables
  const hasTemplateVars = allBlocks.some((b) => {
    const text = b.originalContent || b.content || "";
    return /\{\{[^}]+\}\}/.test(text);
  });
  if (hasTemplateVars) {
    issues.push({
      blockId: "",
      blockType: "",
      type: "info",
      code: "TEMPLATE_HAS_UNRESOLVED",
      message: "Document contains {{variable}} placeholders (template)",
    });
  }

  const hasErrors = issues.some((i) => i.type === "error");
  return { valid: !hasErrors, issues };
}

function checkUnresolvedVars(
  block: IntentBlock,
  declaredVars: Set<string>,
  issues: SemanticIssue[],
): void {
  const varPattern = /\{\{([^}]+)\}\}/g;

  // Check content
  const text = block.originalContent || block.content || "";
  let match: RegExpExecArray | null;
  while ((match = varPattern.exec(text)) !== null) {
    const varName = match[1].trim();
    if (!declaredVars.has(varName)) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "warning",
        code: "UNRESOLVED_VARIABLE",
        message: `Unresolved variable "{{${varName}}}"`,
      });
    }
  }

  // Check property values
  if (block.properties) {
    for (const val of Object.values(block.properties)) {
      const strVal = String(val);
      varPattern.lastIndex = 0;
      while ((match = varPattern.exec(strVal)) !== null) {
        const varName = match[1].trim();
        if (!declaredVars.has(varName)) {
          issues.push({
            blockId: block.id,
            blockType: block.type,
            type: "warning",
            code: "UNRESOLVED_VARIABLE",
            message: `Unresolved variable "{{${varName}}}" in property value`,
          });
        }
      }
    }
  }
}
