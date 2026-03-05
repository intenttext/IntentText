// Browser entry point — exports what runs in the browser.
export { parseIntentText } from "./parser";
export { renderHTML, renderPrint } from "./renderer";
export { mergeData, parseAndMerge } from "./merge";
export { convertMarkdownToIntentText } from "./markdown";
export { queryBlocks, parseQuery, formatQueryResult } from "./query";
export {
  validateDocument,
  createSchema,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
} from "./schema";
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
