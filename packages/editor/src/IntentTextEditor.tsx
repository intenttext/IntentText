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
}

const DEFAULT_THEME = "corporate";

export function IntentTextEditor({
  value,
  onChange,
  theme,
  onThemeChange,
  readOnly = false,
  showRibbon = true,
  showTrustBanner = true,
  onTrustAction,
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
      readOnly={readOnly}
      showRibbon={showRibbon}
      showTrustBanner={showTrustBanner}
      onTrustAction={onTrustAction}
    />
  );
}
