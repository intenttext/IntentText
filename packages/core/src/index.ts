export { parseIntentText, _resetIdCounter } from "./parser";
export { renderHTML, renderPrint } from "./renderer";
export { mergeData, parseAndMerge } from "./merge";
export { convertMarkdownToIntentText } from "./markdown";
export { convertHtmlToIntentText } from "./html-to-it";
export { queryBlocks, parseQuery, formatQueryResult } from "./query";
export {
  validateDocument,
  createSchema,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
} from "./schema";
export type {
  IntentBlock,
  IntentDocument,
  BlockType,
  InlineNode,
  IntentExtension,
  ParseOptions,
  Diagnostic,
  AgenticStatus,
  VariableRef,
  QueryOptions,
  QueryResult,
  QueryClause,
  QuerySort,
  DocumentSchema,
  BlockSchema,
  PropertySchema,
  ValidationResult,
  ValidationError,
} from "./types";
