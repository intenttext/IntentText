// @dotit/editor — embeddable IntentText visual editor (browser-only).
//
// Import the stylesheet once in your app:
//   import "@dotit/editor/style.css";

export { IntentTextEditor } from "./IntentTextEditor";
export type { IntentTextEditorProps } from "./IntentTextEditor";
export type { TrustAction } from "./types";

// One component, every mode — the simplest way for a host (ERP page, portal) to
// embed: mount <IntentTextWorkbench mode="edit|fill|view|review|auto"> and switch
// behaviour by intent. The individual components below stay exported for hosts that
// want to import just one (smaller bundle).
export {
  IntentTextWorkbench,
  detectMode,
} from "./IntentTextWorkbench";
export type {
  IntentTextWorkbenchProps,
  WorkbenchMode,
} from "./IntentTextWorkbench";

// Intent-named aliases, so a host's imports read by purpose. TemplateEditor and
// FormDesigner are the SAME authoring surface (IntentTextEditor) — template
// authoring is typing `{{vars}}`, form design is Insert ▸ Fields; there is no
// separate component, just different content you author.
export {
  IntentTextEditor as TemplateEditor,
  IntentTextEditor as FormDesigner,
} from "./IntentTextEditor";
export { FormFill as FormFiller } from "./FormFill";
export { DocumentView as DocViewer } from "./DocumentView";

// Print / export (the same WYSIWYG path the ribbon uses)
export {
  exportDocumentPDF,
  exportDocumentHTML,
  downloadItFile,
  builtinThemes,
} from "./print";
export type { PrintMode } from "./print";
export { printHtmlViaIframe } from "./print-iframe";

// Source ↔ editor-document bridge (lossless round-trip)
export { sourceToDoc, docToSource } from "./bridge";

// Template helpers ({{variable}} authoring)
export {
  extractTemplateVariables,
  buildSampleSkeleton,
} from "./template-highlight";

// Trust lifecycle snapshot (track / approve / sign / seal / amend)
export { extractTrustState } from "./trust-state";
export type { TrustState } from "./trust-state";

// Page geometry (the document's own page:/header:/footer: blocks)
export {
  getPageGeometry,
  resolvePageTokens,
  setPageSize,
  setPageOrientation,
  PAGE_SIZE_OPTIONS,
} from "./page-geometry";
export type { PageGeometry } from "./page-geometry";

// Read-only "read like a PDF" paginated view (static page sheets — reliable
// pagination + the surface print renders).
export { DocumentView } from "./DocumentView";
export type { DocumentViewProps } from "./DocumentView";

// Fill an IntentText form (recipient experience) — renders fields as live controls,
// writes answers back to the `.it` source, reports completeness for signing.
export { FormFill } from "./FormFill";
export type { FormFillProps } from "./FormFill";

// Review tracked changes + comments (redline) — accept/reject per change or in bulk,
// rewriting the `.it` source. A document with no pending changes is final/sealable.
export { Redline } from "./Redline";
export type { RedlineProps } from "./Redline";
