export { ALIASES } from "./aliases";
export {
  LANGUAGE_REGISTRY,
  CANONICAL_KEYWORDS,
  ALIAS_MAP,
  DEPRECATED_ALIASES,
  COMPAT_ONLY_ALIASES,
  BOUNDARY_KEYWORDS,
  PUBLIC_KEYWORDS,
  KEYWORD_TIERS,
  CORE_KEYWORDS,
  tierOf,
} from "./language-registry";
export type {
  KeywordDefinition,
  KeywordCategory,
  KeywordStatus,
  KeywordTier,
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
} from "./parser";
export { renderHTML } from "./renderer";
export { validateDocumentSemantic } from "./validate";
export { documentToSource, blockToSource } from "./source";
export type {
  SafeParseOptions,
  SafeParseResult,
  ParseWarning,
  ParseError,
} from "./parser";
export {
  renderPrint,
  collectPrintLayout,
  cssContentValue,
  resolvePageSize,
} from "./renderer";
export {
  collectDocumentStyles,
  documentStyleCSS,
  DOC_STYLE_TARGETS,
} from "./renderer";
export type { DocumentStyleRule } from "./renderer";
export { mergeData, parseAndMerge } from "./merge";
export type { MergeOptions } from "./merge";
export { convertMarkdownToIntentText } from "./markdown";
export { convertHtmlToIntentText } from "./html-to-it";
export { convertXlsxToIntentText } from "./xlsx-to-it";
export type { XlsxToItOptions } from "./xlsx-to-it";
export { convertIntentTextToXlsx } from "./it-to-xlsx";
export type { ItToXlsxOptions } from "./it-to-xlsx";
export { convertDocxToIntentText } from "./docx-to-it";
export type { DocxToItOptions } from "./docx-to-it";
export { convertIntentTextToDocx } from "./it-to-docx";
export type { ItToDocxOptions } from "./it-to-docx";
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
  computeDocumentHashLegacy,
  hashMatches,
  findHistoryBoundaryInSource,
  sealDocument,
  signDocument,
  verifyDocument,
  unsealDocument,
  isSealed,
  isSignedBy,
  generateBlockId,
  blockFingerprint,
  matchBlocksToRegistry,
  computeTrustDiff,
  incrementVersion,
} from "./trust";
export { upsertMetaProperty, getMetaProperty, flattenBlocks } from "./utils";
export {
  toStorageRecord,
  fromStorageRecord,
  verifyStorageRecord,
} from "./storage";
export type { StoredDocument } from "./storage";
export {
  renderSeal,
  sealForDocument,
  detectTrustState,
  contentHashOf,
  TIER_STYLES,
} from "./seal";
export {
  isTemplate,
  hasUnresolvedMergeVars,
  assertNotTemplate,
} from "./template";
export {
  isForm,
  isFormComplete,
  extractFormFields,
  formAnswers,
  missingRequiredFields,
  setFieldValue,
  applyAnswers,
  FORM_FIELD_TYPES,
} from "./forms";
export type { FormField, FormFieldType } from "./forms";
export {
  hasTrackedChanges,
  extractChanges,
  acceptChanges,
  rejectChanges,
  extractComments,
  commentAnchors,
} from "./redline";
export type { TrackedChange, Comment, ChangeType } from "./redline";
export { compareVersions } from "./compare";
export type { CompareOptions } from "./compare";
export type {
  TrustTier,
  TierStyle,
  TrustState,
  SealRenderOptions,
  DocumentSeal,
} from "./seal";
export type {
  SealOptions,
  SealResult,
  VerifyResult,
  BlockSnapshot,
  TrustDiff,
} from "./trust";
export { updateHistory, parseHistorySection } from "./history";
export type { SaveHistoryOptions } from "./history";
export { detectHistoryBoundary } from "./trust";
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
