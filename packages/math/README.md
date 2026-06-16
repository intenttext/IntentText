# @dotit/math

Math/equation rendering for IntentText. `@dotit/core` stays dependency-free and
only **marks** math — emitting placeholders `<span class="it-math" data-tex="…">`
(inline) and `<div class="it-math-block" data-tex="…">` (display). This package
turns those into real math.

Author math in `.it`:

```
math: E = mc^2                          # a display equation
text: mass-energy [E = mc^2]{math: tex} # inline
```

Render it:

```ts
import { mathToMathML, renderMath, renderMathInHtml, hydrateMath } from "@dotit/math";

mathToMathML("\\frac{a}{b}");           // dependency-free LITE MathML (sync)
await renderMath("\\sum_{i=0}^n x_i");  // KaTeX if installed, else lite MathML

// server / print: replace core's placeholders in an HTML string
const html2 = await renderMathInHtml(coreHtml);

// editor (browser): upgrade placeholders in a live DOM
await hydrateMath(document.querySelector(".intent-document")!);
```

## Lite vs KaTeX

- **Lite** (built in, zero deps): fractions, powers/subscripts, roots, Greek,
  big operators (∑ ∏ ∫) and common relations — the math business and most science
  documents use. Always available, sync, → MathML.
- **KaTeX** (optional peer — `npm i katex`): full LaTeX. `renderMath` uses it
  automatically when installed; otherwise falls back to lite, never throwing.

Install KaTeX only if you need full LaTeX; otherwise lite keeps your bundle lean.
