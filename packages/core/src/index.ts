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
export { extractWorkflow } from "./workflow";
export type { WorkflowStep, WorkflowGraph } from "./workflow";
// v2.8 trust and history
export {
  computeDocumentHash,
  findHistoryBoundaryInSource,
  sealDocument,
  verifyDocument,
  generateBlockId,
  blockFingerprint,
  matchBlocksToRegistry,
  computeTrustDiff,
  incrementVersion,
} from "./trust";
export type {
  SealOptions,
  SealResult,
  VerifyResult,
  BlockSnapshot,
  TrustDiff,
} from "./trust";
export { updateHistory, parseHistorySection } from "./history";
export type { SaveHistoryOptions } from "./history";
export { detectHistoryBoundary } from "./parser";
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
  HistorySection,
  RegistryEntry,
  RevisionEntry,
} from "./types";
