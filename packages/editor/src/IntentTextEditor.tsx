// IntentTextEditor — the embeddable IntentText visual editor.
//
// A controlled React component over `.it` source text: the host owns the
// document (value/onChange), the editor renders a Word-like WYSIWYG canvas
// with the formatting ribbon and trust banner. Everything styled here maps to
// core `.it` properties, so the printed PDF always matches the screen.

import { useCallback, useState } from "react";
import { VisualEditor } from "./VisualEditor";
import type { TrustAction } from "./types";

export interface IntentTextEditorProps {
  /** Current `.it` source text (controlled). */
  value: string;
  /** Called with the updated `.it` source on every edit. */
  onChange: (source: string) => void;
  /**
   * Document theme id (see builtinThemes()). When provided the theme is
   * controlled — pair it with onThemeChange so the ribbon's theme select
   * works. When omitted the editor manages it internally (default
   * "corporate").
   */
  theme?: string;
  /** Called when the user picks a theme in the ribbon. */
  onThemeChange?: (theme: string) => void;
  /**
   * Show the ribbon's theme picker. Default true (embedded/desktop have no other
   * theme control). Pass false when the host provides its own always-visible theme
   * control (e.g. the web app's title bar) to avoid a duplicate.
   */
  showThemePicker?: boolean;
  /** Force read-only. Sealed documents are read-only automatically. */
  readOnly?: boolean;
  /** Show the formatting ribbon. Default true. */
  showRibbon?: boolean;
  /** Show the trust status banner + document properties strip. Default true. */
  showTrustBanner?: boolean;
  /**
   * Handle the ribbon's Trust group (Seal / Sign / Verify). The editor only
   * reports the intent — wire it to your own dialogs/flows (e.g. core's
   * sealDocument / verifyDocument). The group is hidden when omitted.
   */
  onTrustAction?: (action: TrustAction) => void;
  /** Ribbon density. Pass with onRibbonModeChange to control it from the host
   *  (e.g. a toggle in your own title bar); the editor's built-in toggle hides. */
  ribbonMode?: "ribbon" | "simple";
  onRibbonModeChange?: (mode: "ribbon" | "simple") => void;
  /** Show the built-in change chip (default true). Set false to host your own. */
  showChangeIndicator?: boolean;
  /** Reports whether the document differs from the opened/saved version (doc-level;
   *  reaches false on full undo). Use to drive your own change indicator. */
  onChangeState?: (dirty: boolean) => void;
}

const DEFAULT_THEME = "corporate";

export function IntentTextEditor({
  value,
  onChange,
  theme,
  onThemeChange,
  showThemePicker = true,
  readOnly = false,
  showRibbon = true,
  showTrustBanner = true,
  onTrustAction,
  ribbonMode,
  onRibbonModeChange,
  showChangeIndicator = true,
  onChangeState,
}: IntentTextEditorProps) {
  // Theme is controlled when the host passes `theme`; self-managed otherwise.
  const [internalTheme, setInternalTheme] = useState(theme ?? DEFAULT_THEME);
  const activeTheme = theme ?? internalTheme;
  const handleThemeChange = useCallback(
    (t: string) => {
      setInternalTheme(t);
      onThemeChange?.(t);
    },
    [onThemeChange],
  );

  return (
    <VisualEditor
      value={value}
      onChange={onChange}
      theme={activeTheme}
      onThemeChange={handleThemeChange}
      showThemePicker={showThemePicker}
      readOnly={readOnly}
      showRibbon={showRibbon}
      showTrustBanner={showTrustBanner}
      onTrustAction={onTrustAction}
      ribbonMode={ribbonMode}
      onRibbonModeChange={onRibbonModeChange}
      showChangeIndicator={showChangeIndicator}
      onChangeState={onChangeState}
    />
  );
}
