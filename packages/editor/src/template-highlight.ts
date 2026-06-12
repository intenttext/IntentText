// Template placeholder highlighting for the visual editor.
//
// Decorates every `{{path.to.value}}` in text content as an inline chip, so
// template authors SEE their variables at a glance. Pure view decoration —
// the document text is untouched, so round-trip and merge are unaffected.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

const key = new PluginKey("template-highlight");
const VAR_RE = /\{\{[^}]+\}\}/g;

function buildDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    VAR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VAR_RE.exec(node.text))) {
      decos.push(
        Decoration.inline(pos + m.index, pos + m.index + m[0].length, {
          class: "it-doc-var",
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

export const TemplateHighlight = Extension.create({
  name: "templateHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_cfg, state) => buildDecorations(state.doc),
          apply: (tr, old) =>
            tr.docChanged ? buildDecorations(tr.doc) : old,
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});

/**
 * Extract the template variables used in `.it` source — unique, in order of
 * first appearance. Runtime print tokens ({{page}}/{{pages}}) and system
 * variables are excluded; they resolve at print/merge time on their own.
 */
export function extractTemplateVariables(source: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  VAR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAR_RE.exec(source))) {
    const name = m[0].slice(2, -2).trim();
    if (/^(page|pages|date|time|year)$/i.test(name)) continue;
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Build a sample-data skeleton for a set of variable paths:
 * ["customer.name", "items.0.qty"] → { customer: { name: "" }, items: [{ qty: "" }] }
 */
export function buildSampleSkeleton(vars: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const path of vars) {
    const parts = path.split(".");
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const last = i === parts.length - 1;
      // `each:` loop variables bind as item.* — represent as a one-element array
      // under a plural-ish key the author can rename.
      if (last) {
        if (!(p in cur)) cur[p] = "";
      } else {
        if (!(p in cur) || typeof cur[p] !== "object" || cur[p] === null)
          cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
    }
  }
  return root;
}
