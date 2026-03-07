import { IntentDocument, IntentBlock } from "./types";
import { flattenBlocks } from "./utils";
import { computeDocumentHash, findHistoryBoundaryInSource } from "./trust";

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

    // v2.8: approve: without by
    if (block.type === "approve" && !block.properties?.by) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "error",
        code: "APPROVE_NO_BY",
        message: "approve block has no 'by' property",
      });
    }

    // v2.8: sign: without hash
    if (block.type === "sign" && !block.properties?.hash) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "error",
        code: "SIGN_NO_HASH",
        message: "sign block has no 'hash' property",
      });
    }

    // v2.8: sign: without at
    if (block.type === "sign" && !block.properties?.at) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        type: "error",
        code: "SIGN_NO_AT",
        message: "sign block has no 'at' property",
      });
    }
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

  // v2.8: freeze: must be the last block before history boundary
  const freezeBlocks = allBlocks.filter((b) => b.type === "freeze");
  if (freezeBlocks.length > 1) {
    issues.push({
      blockId: freezeBlocks[1].id,
      blockType: "freeze",
      type: "error",
      code: "MULTIPLE_FREEZE",
      message: "More than one freeze: block found — only one is allowed",
    });
  }
  if (freezeBlocks.length === 1) {
    const freezeIdx = allBlocks.indexOf(freezeBlocks[0]);
    const blocksAfterFreeze = allBlocks.slice(freezeIdx + 1);
    // v2.11: amendment: and sign: blocks may appear after freeze:
    const nonAmendmentAfterFreeze = blocksAfterFreeze.filter(
      (b) => b.type !== "amendment" && b.type !== "sign",
    );
    if (nonAmendmentAfterFreeze.length > 0) {
      issues.push({
        blockId: freezeBlocks[0].id,
        blockType: "freeze",
        type: "error",
        code: "FREEZE_NOT_LAST",
        message:
          "freeze: block is not the last block before the history boundary (amendment: and sign: are allowed after freeze:)",
      });
    }
  }

  // v2.12: HISTORY_WITHOUT_FREEZE warning — history: present but no freeze:
  if (doc.history && freezeBlocks.length === 0) {
    issues.push({
      blockId: "",
      blockType: "history",
      type: "warning",
      code: "HISTORY_WITHOUT_FREEZE",
      message:
        "Document has a history section but no freeze: block — " +
        "this may indicate manual editing or a broken seal.",
    });
  }

  // v2.8: track: without version
  if (doc.metadata?.tracking && !doc.metadata.tracking.version) {
    issues.push({
      blockId: "",
      blockType: "track",
      type: "error",
      code: "TRACK_NO_VERSION",
      message: "track block has no 'version' property",
    });
  }

  // v2.8: track: without title warning
  if (doc.metadata?.tracking && !allBlocks.some((b) => b.type === "title")) {
    issues.push({
      blockId: "",
      blockType: "track",
      type: "warning",
      code: "TRACK_WITHOUT_TITLE",
      message:
        "Document has track: but no title: — tracked documents should have a title",
    });
  }

  // v2.8: freeze: without any sign: blocks
  if (freezeBlocks.length > 0 && !allBlocks.some((b) => b.type === "sign")) {
    issues.push({
      blockId: freezeBlocks[0].id,
      blockType: "freeze",
      type: "warning",
      code: "FREEZE_UNSIGNED",
      message:
        "Document is frozen but has no sign: blocks — consider adding signatures before sealing",
    });
  }

  // v2.8: sign: hash doesn't match current document content
  const signBlocks = allBlocks.filter((b) => b.type === "sign");
  if (signBlocks.length > 0 && doc.metadata?.signatures) {
    for (let si = 0; si < signBlocks.length; si++) {
      const signBlock = signBlocks[si];
      const hash = signBlock.properties?.hash
        ? String(signBlock.properties.hash)
        : "";
      if (hash && doc.metadata.signatures[si]?.hash) {
        // We can't fully verify without source, but we can flag if metadata says invalid
        if (doc.metadata.signatures[si].valid === false) {
          issues.push({
            blockId: signBlock.id,
            blockType: "sign",
            type: "warning",
            code: "SIGN_HASH_INVALID",
            message: `sign: hash does not match current document content — document was edited after signing`,
          });
        }
      }
    }
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

  // v2.8.1: meta: blocks that appear after a section (emitted as content blocks)
  const metaBlocks = allBlocks.filter((b) => b.type === "meta");
  for (const metaBlock of metaBlocks) {
    issues.push({
      blockId: metaBlock.id,
      blockType: "meta",
      type: "warning",
      code: "META_AFTER_SECTION",
      message:
        "meta: block appears after a section: — it will be treated as content, not metadata",
    });
  }

  // v2.9: Print layout warnings
  const hasPage = allBlocks.some((b) => b.type === "page");
  const headerBlocks = allBlocks.filter((b) => b.type === "header");
  const footerBlocks = allBlocks.filter((b) => b.type === "footer");
  const watermarkBlocks = allBlocks.filter((b) => b.type === "watermark");

  if (headerBlocks.length > 0 && !hasPage) {
    for (const hb of headerBlocks) {
      issues.push({
        blockId: hb.id,
        blockType: "header",
        type: "warning",
        code: "HEADER_WITHOUT_PAGE",
        message:
          "header: block present but no page: block found — header will have no effect",
      });
    }
  }
  if (footerBlocks.length > 0 && !hasPage) {
    for (const fb of footerBlocks) {
      issues.push({
        blockId: fb.id,
        blockType: "footer",
        type: "warning",
        code: "FOOTER_WITHOUT_PAGE",
        message:
          "footer: block present but no page: block found — footer will have no effect",
      });
    }
  }
  if (watermarkBlocks.length > 0 && !hasPage) {
    for (const wb of watermarkBlocks) {
      issues.push({
        blockId: wb.id,
        blockType: "watermark",
        type: "warning",
        code: "WATERMARK_WITHOUT_PAGE",
        message:
          "watermark: block present but no page: block found — watermark will have no effect",
      });
    }
  }
  if (watermarkBlocks.length > 1) {
    for (let i = 0; i < watermarkBlocks.length - 1; i++) {
      issues.push({
        blockId: watermarkBlocks[i].id,
        blockType: "watermark",
        type: "warning",
        code: "MULTIPLE_WATERMARKS",
        message:
          "Multiple watermark: blocks found — only the last one will be used",
      });
    }
  }

  // ── v2.11: ref: validation ──────────────────────────────────────────────
  const refBlocks = allBlocks.filter((b) => b.type === "ref");
  for (const rb of refBlocks) {
    const hasFile = rb.properties?.file != null;
    const hasUrl = rb.properties?.url != null;
    if (!hasFile && !hasUrl) {
      issues.push({
        blockId: rb.id,
        blockType: "ref",
        type: "error",
        code: "REF_MISSING_TARGET",
        message:
          "ref: block has no file: or url: property — target is required",
      });
    }
    if (!rb.properties?.rel) {
      issues.push({
        blockId: rb.id,
        blockType: "ref",
        type: "warning",
        code: "REF_MISSING_REL",
        message:
          "ref: block has no rel: property — relationship type recommended",
      });
    }
  }

  // ── v2.11: def: validation ──────────────────────────────────────────────
  const defBlocks = allBlocks.filter((b) => b.type === "def");
  const seenTerms = new Map<string, IntentBlock>();
  for (const db of defBlocks) {
    if (!db.properties?.meaning) {
      issues.push({
        blockId: db.id,
        blockType: "def",
        type: "error",
        code: "DEF_MISSING_MEANING",
        message: `def: "${db.content}" has no meaning: property`,
      });
    }
    const termKey = db.content.toLowerCase().trim();
    if (seenTerms.has(termKey)) {
      issues.push({
        blockId: db.id,
        blockType: "def",
        type: "warning",
        code: "DEF_DUPLICATE_TERM",
        message: `def: "${db.content}" is defined more than once`,
      });
    } else {
      seenTerms.set(termKey, db);
    }
  }

  // ── v2.11: metric: validation ───────────────────────────────────────────
  const metricBlocks = allBlocks.filter((b) => b.type === "metric");
  const validTrends = new Set(["up", "down", "stable", "at-risk"]);
  for (const mb of metricBlocks) {
    if (mb.properties?.value == null) {
      issues.push({
        blockId: mb.id,
        blockType: "metric",
        type: "error",
        code: "METRIC_MISSING_VALUE",
        message: `metric: "${mb.content}" has no value: property`,
      });
    }
    if (
      mb.properties?.trend != null &&
      !validTrends.has(String(mb.properties.trend))
    ) {
      issues.push({
        blockId: mb.id,
        blockType: "metric",
        type: "warning",
        code: "METRIC_INVALID_TREND",
        message: `metric: "${mb.content}" has unknown trend "${mb.properties.trend}" — expected up, down, stable, or at-risk`,
      });
    }
  }

  // ── v2.11: amendment: validation ────────────────────────────────────────
  const amendmentBlocks = allBlocks.filter((b) => b.type === "amendment");
  const hasFreezeBlock = freezeBlocks.length > 0;
  for (const ab of amendmentBlocks) {
    if (!hasFreezeBlock) {
      issues.push({
        blockId: ab.id,
        blockType: "amendment",
        type: "error",
        code: "AMENDMENT_WITHOUT_FREEZE",
        message:
          "amendment: block in a document with no freeze: — amendments require a frozen document",
      });
    }
    if (!ab.properties?.ref) {
      issues.push({
        blockId: ab.id,
        blockType: "amendment",
        type: "error",
        code: "AMENDMENT_MISSING_REF",
        message: `amendment: "${ab.content}" has no ref: property`,
      });
    }
    if (!ab.properties?.now) {
      issues.push({
        blockId: ab.id,
        blockType: "amendment",
        type: "error",
        code: "AMENDMENT_MISSING_NOW",
        message: `amendment: "${ab.content}" has no now: property`,
      });
    }
  }

  // ── v2.11: figure: validation ───────────────────────────────────────────
  const figureBlocks = allBlocks.filter((b) => b.type === "figure");
  for (const fb of figureBlocks) {
    if (!fb.properties?.src) {
      issues.push({
        blockId: fb.id,
        blockType: "figure",
        type: "error",
        code: "FIGURE_MISSING_SRC",
        message: `figure: "${fb.content}" has no src: property`,
      });
    }
    if (!fb.properties?.caption) {
      issues.push({
        blockId: fb.id,
        blockType: "figure",
        type: "warning",
        code: "FIGURE_MISSING_CAPTION",
        message: `figure: "${fb.content}" has no caption: property — figures should have captions`,
      });
    }
  }

  // ── v2.11: contact: validation ──────────────────────────────────────────
  const contactBlocks = allBlocks.filter((b) => b.type === "contact");
  for (const cb of contactBlocks) {
    const hasEmail = cb.properties?.email != null;
    const hasPhone = cb.properties?.phone != null;
    const hasUrl2 = cb.properties?.url != null;
    if (!hasEmail && !hasPhone && !hasUrl2) {
      issues.push({
        blockId: cb.id,
        blockType: "contact",
        type: "warning",
        code: "CONTACT_NO_REACH",
        message: `contact: "${cb.content}" has no email:, phone:, or url: — how do you reach them?`,
      });
    }
  }

  // ── v2.11: deadline: validation ─────────────────────────────────────────
  const deadlineBlocks = allBlocks.filter((b) => b.type === "deadline");
  for (const dl of deadlineBlocks) {
    if (!dl.properties?.date) {
      issues.push({
        blockId: dl.id,
        blockType: "deadline",
        type: "error",
        code: "DEADLINE_MISSING_DATE",
        message: `deadline: "${dl.content}" has no date: property`,
      });
    } else {
      const dateVal = new Date(String(dl.properties.date));
      if (!isNaN(dateVal.getTime()) && dateVal.getTime() < Date.now()) {
        issues.push({
          blockId: dl.id,
          blockType: "deadline",
          type: "warning",
          code: "DEADLINE_PAST",
          message: `deadline: "${dl.content}" has a past date (${dl.properties.date})`,
        });
      }
    }
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
