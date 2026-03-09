export { ALIASES } from "./aliases";
export {
  LANGUAGE_REGISTRY,
  CANONICAL_KEYWORDS,
  ALIAS_MAP,
  DEPRECATED_ALIASES,
  COMPAT_ONLY_ALIASES,
  BOUNDARY_KEYWORDS,
  PUBLIC_KEYWORDS,
} from "./language-registry";
export type {
  KeywordDefinition,
  KeywordCategory,
  KeywordStatus,
} from "./language-registry";
export {
  getBuiltinTheme,
  listBuiltinThemes,
  registerBuiltinTheme,
  generateThemeCSS,
} from "./theme";
export type {
  IntentTheme,
  ThemeFonts,
  ThemeColors,
  ThemeSpacing,
} from "./theme";
export type { RenderOptions } from "./renderer";
export {
  parseIntentText,
  _resetIdCounter,
  parseIntentTextSafe,
  renderHTML,
  validateDocumentSemantic,
  documentToSource,
} from "./rust-core";
export type {
  SafeParseOptions,
  SafeParseResult,
  ParseWarning,
  ParseError,
} from "./parser";
export { renderPrint, collectPrintLayout } from "./renderer";
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
export type { SemanticIssue, SemanticValidationResult } from "./validate";
export { diffDocuments } from "./diff";
export type { DocumentDiff, BlockModification } from "./diff";
export { extractWorkflow } from "./workflow";
export type { WorkflowStep, WorkflowGraph } from "./workflow";
export { executeWorkflow } from "./executor";
export type {
  WorkflowRuntime,
  ToolHandler,
  ExecutionContext,
  ExecutionResult,
  ExecutionLogEntry,
  ExecutionOptions,
} from "./executor";
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
// v2.10 index builder
export {
  buildShallowIndex,
  buildIndexEntry,
  checkStaleness,
  updateIndex,
  composeIndexes,
  queryComposed,
  formatTable,
  formatJSON,
  formatCSV,
} from "./index-builder";
export type {
  ItIndex,
  IndexFileEntry,
  IndexBlockEntry,
  ComposedResult,
} from "./index-builder";
// v2.10 natural language query
export { askDocuments, serializeContext } from "./ask";
export type { AskOptions } from "./ask";
export { KEYWORDS } from "./types";
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
  PrintLayout,
} from "./types";
