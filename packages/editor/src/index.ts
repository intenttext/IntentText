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

// TemplateEditor reads by purpose — template authoring is typing `{{vars}}` in the
// main editor. (FormDesigner is now a REAL, separate visual builder — see below.)
export { IntentTextEditor as TemplateEditor } from "./IntentTextEditor";
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

// Trust status CHIP + document-properties popover — small header boxes a host can
// place in its own title bar (instead of the editor's built-in rows). Pass
// showTrustBanner={false} on the editor to suppress the built-in versions.
export { TrustBanner, DocPropsBar } from "./TrustBanner";

// Coordinated popovers — opening one menu/popover closes the others, across the
// editor and the host app (so a host title bar's menus play nicely with the editor's).
export { announcePopover, usePopoverExclusive, usePopover } from "./popover-bus";

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

// Bare / "as signed" view — content + emphasis only, all decoration stripped.
// The canonical, tamper-proof surface for courts/counterparties to read a contract.
export { BareView } from "./BareView";
export type { BareViewProps } from "./BareView";

// Live, EDITABLE source side-panel (draggable) — the raw .it beside any surface,
// trust-coloured (signed content vs styling vs seal), editable live. The tamper
// surface a host opens to inspect/edit bytes without leaving the visual view.
export { SourcePanel } from "./SourcePanel";
export type { SourcePanelProps } from "./SourcePanel";

// Fill an IntentText form (recipient experience) — renders fields as live controls,
// writes answers back to the `.it` source, reports completeness for signing.
export { FormFill } from "./FormFill";
export type { FormFillProps } from "./FormFill";

// Visual FORM DESIGNER — a separate authoring surface (fields as real boxes,
// inline edit, drag-reorder, Full/Half width). Shared by web + desktop + embedded.
export { FormDesigner } from "./FormDesigner";
export type { FormDesignerProps } from "./FormDesigner";
export { FIELD_PALETTE, buildFieldLine } from "./form-fields";
export type { FieldDef } from "./form-fields";
export {
  parseDesignRows,
  setRowLabel,
  setRowProp,
  removeRowLine,
  moveRowLine,
  insertRowAfter,
} from "./form-doc";
export type { DesignRow } from "./form-doc";

// Review tracked changes + comments (redline) — accept/reject per change or in bulk,
// rewriting the `.it` source. A document with no pending changes is final/sealable.
export { Redline } from "./Redline";
export type { RedlineProps } from "./Redline";
