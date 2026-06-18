// App-shell types (the visual editor's own types live in @dotit/editor).

/**
 * Which editor surface is active:
 *  - "visual" — the WYSIWYG editor (styled, editable)
 *  - "bare"   — read-only "as signed" view: content + emphasis only, no decoration
 *
 * There is no separate Source mode: the raw .it is edited live in the </> Source
 * side panel (editable, trust-coloured), toggled from the title bar.
 */
export type EditorMode = "visual" | "bare";
