export { ALIASES } from "./aliases";
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
} from "./parser";
export type {
  SafeParseOptions,
  SafeParseResult,
  ParseWarning,
  ParseError,
} from "./parser";
export { renderHTML, renderPrint, collectPrintLayout } from "./renderer";
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
