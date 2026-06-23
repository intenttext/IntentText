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
export { checkConformance } from "./conformance";
export type { ConformanceLevel, ConformanceReport } from "./conformance";
export { documentToSource, blockToSource } from "./source";
export {
  effectiveProperties,
  effectiveField,
  defaultFor,
} from "./defaults";
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
// In-file approval routing (derived, never stored) — the document carries its
// own workflow; workflowState() derives pending/next/complete from route:/require:
// + approve: lines, so the file is the single source of truth.
export { workflowState, deriveWorkflowState, extractRoute } from "./workflow-state";
export type {
  WorkflowState,
  ApprovalRoute,
  RequiredApprover,
} from "./workflow-state";
// Hash-chained audit trail — the approval SEQUENCE is tamper-evident (no insert/
// delete/reorder without detection). appendApproval chains each approval to the
// prior audit event via prev:; verifyAuditChain recomputes the chain.
export { appendApproval, verifyAuditChain, auditTrail, eventHash } from "./audit-chain";
export type { AuditEvent, AuditChainResult, AuditKind } from "./audit-chain";
// Source-preserving edit reconciliation — keep unchanged blocks' exact original
// bytes so an edit touches only what changed (a sealed doc keeps its hash).
export { reconcileEdit } from "./reconcile";
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
  SEAL_SPEC,
  computeDocumentHash,
  computeDocumentHashLegacy,
  computeSignatureHash,
  computeAppearanceHash,
  signatureIdentity,
  signatureMatchesContent,
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
  renderTrustBand,
  TRUST_BAND_CSS,
  trustBandPositionCss,
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
  formVisibility,
  computeFormValues,
  applyComputedValues,
  FORM_FIELD_TYPES,
} from "./forms";
export type { FormField, FormFieldType } from "./forms";
export {
  parseCondition,
  evalCondition,
  conditionHolds,
  computeValue,
  formatComputed,
} from "./field-logic";
export type { Condition, CompareOp } from "./field-logic";
export {
  extractAttachments,
  getAttachment,
  hasAttachment,
  addAttachment,
  removeAttachment,
  attachmentDataUri,
  safePreviewMime,
  MAX_EMBED_BYTES,
} from "./attachments";
export type { Attachment } from "./attachments";
export {
  canonicalFormStructure,
  formStructureHash,
  extractFormSeal,
  sealFormStructure,
  verifyFormStructure,
} from "./form-trust";
export type { FormSeal, FormStructureVerification } from "./form-trust";
export { submitForm, buildSubmission } from "./hub-client";
export type { SubmitOptions, SubmitResult, SubmissionPayload } from "./hub-client";
export {
  hasTrackedChanges,
  extractChanges,
  acceptChanges,
  rejectChanges,
  extractComments,
  commentAnchors,
} from "./redline";
export type { TrackedChange, Comment, ChangeType } from "./redline";
export { compareVersions, mergeThreeWay } from "./compare";
export type {
  CompareOptions,
  ThreeWayMergeOptions,
  ThreeWayMergeResult,
} from "./compare";
export {
  hasRedactions,
  extractRedactions,
  applyRedactions,
  verifyRedaction,
} from "./redaction";
export type {
  PendingRedaction,
  RedactionReceipt,
  RedactionResult,
} from "./redaction";
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
  extractDocumentMetadata,
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
  DocumentMetadata,
} from "./index-builder";

// E-invoicing (EN 16931 / UBL 2.1 — PEPPOL / ZATCA basis)
export { buildUBLInvoice, intentToUBL } from "./einvoice";
export type { UBLInvoiceInput, UBLParty, UBLLine } from "./einvoice";
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
