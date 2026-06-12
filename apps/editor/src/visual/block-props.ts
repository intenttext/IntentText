// Block-level core properties as first-class TipTap attributes.
//
// Word-parity paragraph controls (line spacing, space before/after) and the
// two-sided row (`end:`) are CORE `.it` properties — never editor-only styling.
// This module makes them editable in the visual editor while guaranteeing they
// serialize back onto the block line (see bridge.ts), so the PDF (rendered from
// the same source) always matches the screen.
//
//  - `leading`       → core `leading:`       → CSS line-height
//  - `spaceBefore`   → core `space-before:`  → CSS margin-top
//  - `spaceAfter`    → core `space-after:`   → CSS margin-bottom
//  - `end`           → core `end:`           → two-sided flex row (`.it-split`)
//
// Plain paragraphs (core `text:`/prose) carry these as real node attributes on
// an extended Paragraph node; IT nodes that already round-trip a `props` JSON
// attribute (title/section/sub/summary/quote/callout/generic) store them there
// and render via extensions.ts buildStyle().

import { Extension } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import { mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

/** Core property keys managed by the paragraph-level commands. */
export type BlockPropKey = "leading" | "space-before" | "space-after" | "end";

/** Core property key → paragraph attribute name. */
const PARA_ATTR: Record<BlockPropKey, string> = {
  leading: "leading",
  "space-before": "spaceBefore",
  "space-after": "spaceAfter",
  end: "end",
};

// Node types that keep ALL their line properties in a JSON `props` attribute
// (serialized back by bridge.ts mergeProps). Spacing is portable on all of
// them — core's STYLE_PROPERTIES applies to every block type.
const PROPS_JSON_SPACING = new Set([
  "itTitle",
  "itSummary",
  "itSection",
  "itSub",
  "itQuote",
  "itCallout",
  "itGenericBlock",
]);
// Core renders `end:` (two-sided rows) on title/section/sub/text/prose only —
// the editor offers it exactly there so screen and PDF never diverge.
const PROPS_JSON_END = new Set(["itTitle", "itSection", "itSub"]);

function safeParseProps(val: unknown): Record<string, string> {
  try {
    return typeof val === "string" ? JSON.parse(val) : (val as Record<string, string>) || {};
  } catch {
    return {};
  }
}

function supportsKey(typeName: string, key: BlockPropKey): boolean {
  if (typeName === "paragraph") return true;
  if (key === "end") return PROPS_JSON_END.has(typeName);
  return PROPS_JSON_SPACING.has(typeName);
}

/**
 * Extended Paragraph: a core `text:`/prose block. Adds the four core block
 * properties as attributes and renders the `end:` value as the second side of
 * a flex split row (matching core's `.it-split` / `.it-split-main` CSS).
 */
export const ITParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      leading: {
        default: null,
        parseHTML: (el) => el.style.lineHeight || null,
        renderHTML: (attrs) =>
          attrs.leading ? { style: `line-height: ${attrs.leading}` } : {},
      },
      spaceBefore: {
        default: null,
        parseHTML: (el) => el.style.marginTop || null,
        renderHTML: (attrs) =>
          attrs.spaceBefore ? { style: `margin-top: ${attrs.spaceBefore}` } : {},
      },
      spaceAfter: {
        default: null,
        parseHTML: (el) => el.style.marginBottom || null,
        renderHTML: (attrs) =>
          attrs.spaceAfter
            ? { style: `margin-bottom: ${attrs.spaceAfter}` }
            : {},
      },
      end: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-it-end"),
        renderHTML: (attrs) =>
          attrs.end ? { "data-it-end": attrs.end } : {},
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    // Two-sided row: wrap the editable content in `.it-split-main` so it is a
    // single flex item; the `end:` value renders as CSS generated content from
    // data-it-end (non-editable, exactly like core's split-end span).
    if (node.attrs.end) {
      return [
        "p",
        mergeAttributes(HTMLAttributes),
        ["span", { class: "it-split-main" }, 0],
      ];
    }
    return ["p", mergeAttributes(HTMLAttributes), 0];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockProps: {
      /**
       * Set (or clear, with null) a core block property on every block in the
       * current selection that supports it. Writes through to the `.it` source
       * via the bridge — paragraph attrs or the node's `props` JSON.
       */
      setBlockProp: (key: BlockPropKey, value: string | null) => ReturnType;
    };
  }
}

export const BlockProps = Extension.create({
  name: "blockProps",

  addCommands() {
    return {
      setBlockProp:
        (key: BlockPropKey, value: string | null) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            const name = node.type.name;
            // Don't descend into lists/tables — list items serialize without
            // block props, so styling them would silently not round-trip.
            if (name === "bulletList" || name === "orderedList") return false;
            if (!node.isBlock || node.isAtom) return false;
            if (!supportsKey(name, key)) return true;

            if (name === "paragraph") {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                [PARA_ATTR[key]]: value,
              });
            } else {
              const props = safeParseProps(node.attrs.props);
              if (value == null || value === "") delete props[key];
              else props[key] = value;
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                props: JSON.stringify(props),
              });
            }
            changed = true;
            return false;
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});

/** Read a core block property from the first supporting block in the selection. */
export function getBlockProp(
  editor: Editor | null,
  key: BlockPropKey,
): string | null {
  if (!editor) return null;
  const { state } = editor;
  const { from, to } = state.selection;
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (found !== null) return false;
    const name = node.type.name;
    if (!supportsKey(name, key)) return true;
    if (name === "paragraph") {
      const v = node.attrs[PARA_ATTR[key]];
      found = v != null ? String(v) : "";
    } else {
      found = safeParseProps(node.attrs.props)[key] ?? "";
    }
    return false;
  });
  return found;
}
