export {
  parseIntentText,
  _resetIdCounter,
  parseIntentTextSafe,
} from "./parser";
export type {
  SafeParseOptions,
  SafeParseResult,
  ParseWarning,
  ParseError,
} from "./parser";
export { renderHTML, renderPrint } from "./renderer";
export { mergeData, parseAndMerge } from "./merge";
export { convertMarkdownToIntentText } from "./markdown";
export { convertHtmlToIntentText } from "./html-to-it";
export {
  queryBlocks,
  parseQuery,
  formatQueryResult,
  queryDocument,
} from "./query";
export type { SimpleQueryOptions } from "./query";
export {
  validateDocument,
  createSchema,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
} from "./schema";
export { documentToSource } from "./source";
export { validateDocumentSemantic } from "./validate";
export type { SemanticIssue, SemanticValidationResult } from "./validate";
export { diffDocuments } from "./diff";
export type { DocumentDiff, BlockModification } from "./diff";
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
