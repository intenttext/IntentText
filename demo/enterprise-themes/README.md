# Demo 3 — same `.it`, three themes

One source document, three enterprise looks. The `.it` file carries the document's
**intent** — sections, a service-level table, commercials as metrics, approvals and
signatures. The **theme** decides how it *looks*. No content is edited between renders.

```bash
pnpm demo:themes        # → demo/enterprise-themes/out.themes.html
open demo/enterprise-themes/out.themes.html
```

- **`contract.it`** — a Master Services Agreement (sections, table, metrics, sign/freeze).
- **`showcase.mjs`** — renders it with `renderHTML(doc, { theme })` for `corporate`,
  `legal`, and `editorial`, side by side in isolated iframes.
- **`out.themes.html`** — the generated comparison page (open in a browser).

Why it matters: the same file is a readable document, a queryable record, and a
signable artifact — and it renders enterprise-credible in whatever house style you
pick. Swap the theme name (any of `pnpm exec` `listBuiltinThemes()`: corporate, legal,
editorial, technical, minimal, warm, dark, print) to retheme without touching content.
