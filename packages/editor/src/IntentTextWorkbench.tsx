// IntentTextWorkbench — ONE component, every editor mode.
//
// The whole editor surface behind a single `mode` prop, so a host (an ERP page, a
// portal) can mount one component and switch behaviour by intent instead of wiring
// up the four sub-components itself:
//
//   <IntentTextWorkbench mode="edit"   …/>   author a template / design a form
//   <IntentTextWorkbench mode="fill"   …/>   recipient fills a form (FormFill)
//   <IntentTextWorkbench mode="review" …/>   accept/reject redlines (Redline)
//   <IntentTextWorkbench mode="view"   …/>   read-only "read like a PDF" (DocumentView)
//   <IntentTextWorkbench mode="auto"   …/>   pick from the document (the default)
//
// "auto" is the same dispatch the desktop + web editor apps do by hand: a form ⇒
// fill, a doc with pending tracked changes ⇒ review, otherwise the full editor. The
// individual components stay exported, so a host that only needs one (e.g. a
// fill-only page) can import just that and keep its bundle small.

import { isForm, hasTrackedChanges } from "@dotit/core";
import { IntentTextEditor } from "./IntentTextEditor";
import { FormFill } from "./FormFill";
import { Redline } from "./Redline";
import { DocumentView } from "./DocumentView";
import type { TrustAction } from "./types";

export type WorkbenchMode = "auto" | "edit" | "fill" | "view" | "review";

export interface IntentTextWorkbenchProps {
  /** The `.it` source (controlled). */
  value: string;
  /** Called with the updated source. Required for every mode except "view". */
  onChange?: (source: string) => void;
  /** Which surface to show. "auto" (default) picks from the document. */
  mode?: WorkbenchMode;
  /** Document theme id. */
  theme?: string;
  /** Theme changes from the ribbon (edit mode). */
  onThemeChange?: (theme: string) => void;
  /** Force read-only (edit/view). */
  readOnly?: boolean;
  /** Fill mode: called when a COMPLETE form is submitted (enable signing). */
  onSubmit?: (source: string) => void;
  /** Edit mode: the ribbon's Trust group (Seal / Sign / Verify) intent. */
  onTrustAction?: (action: TrustAction) => void;
  /** Edit mode: show the formatting ribbon (default true). */
  showRibbon?: boolean;
  /** Edit mode: show the trust banner (default true). */
  showTrustBanner?: boolean;
}

/** The mode "auto" resolves to, from the document's own shape. */
export function detectMode(source: string): Exclude<WorkbenchMode, "auto"> {
  if (isForm(source)) return "fill";
  if (hasTrackedChanges(source)) return "review";
  return "edit";
}

export function IntentTextWorkbench({
  value,
  onChange,
  mode = "auto",
  theme,
  onThemeChange,
  readOnly,
  onSubmit,
  onTrustAction,
  showRibbon,
  showTrustBanner,
}: IntentTextWorkbenchProps) {
  const resolved = mode === "auto" ? detectMode(value) : mode;
  const change = onChange ?? (() => {});

  switch (resolved) {
    case "fill":
      return (
        <FormFill
          value={value}
          theme={theme}
          onChange={change}
          onSubmit={onSubmit}
          readOnly={readOnly}
        />
      );
    case "review":
      return (
        <Redline value={value} theme={theme} onChange={change} readOnly={readOnly} />
      );
    case "view":
      return <DocumentView value={value} theme={theme} />;
    case "edit":
    default:
      return (
        <IntentTextEditor
          value={value}
          onChange={change}
          theme={theme}
          onThemeChange={onThemeChange}
          readOnly={readOnly}
          onTrustAction={onTrustAction}
          showRibbon={showRibbon}
          showTrustBanner={showTrustBanner}
        />
      );
  }
}
