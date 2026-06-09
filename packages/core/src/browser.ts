// Browser entry point — exports what runs in the browser.
export { parseIntentText, parseIntentTextSafe } from "./parser";
export { renderHTML, renderPrint } from "./renderer";
export { mergeData, parseAndMerge } from "./merge";
export { convertMarkdownToIntentText } from "./markdown";
export {
  queryBlocks,
  parseQuery,
  formatQueryResult,
  queryDocument,
} from "./query";
export {
  validateDocument,
  createSchema,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
} from "./schema";
export { documentToSource } from "./source";
export { validateDocumentSemantic } from "./validate";
export { diffDocuments } from "./diff";
export { extractWorkflow } from "./workflow";
export type { WorkflowStep, WorkflowGraph } from "./workflow";
export type {
  IntentDocument,
  IntentBlock,
  BlockType,
  InlineNode,
  ParseOptions,
  Diagnostic,
  AgenticStatus,
  IntentDocumentMetadata,
} from "./types";
