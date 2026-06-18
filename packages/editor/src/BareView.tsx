// BareView — the document "as signed".
//
// Renders ONLY the content and its emphasis (bold / italic / underline / strike)
// with plain theme typography — every authored decoration (colour, size, font,
// background, alignment, `style:` rules) and every box/border is dropped by core's
// bare renderer. It runs through the SAME paginated page-sheet engine as the print
// path (DocumentView → renderPrint with { bare: true }), so it splits into real
// pages and prints exactly as shown. Read-only by nature: the canonical,
// tamper-proof surface a court or counterparty checks a contract against.

import { DocumentView } from "./DocumentView";

export interface BareViewProps {
  /** The `.it` source to render. */
  value: string;
  /** Theme name — only its typography is used; document styling is ignored. */
  theme?: string;
  /** Zoom factor (1 = 100%). */
  zoom?: number;
}

export function BareView({ value, theme = "corporate", zoom = 1 }: BareViewProps) {
  return <DocumentView value={value} theme={theme} zoom={zoom} bare />;
}
