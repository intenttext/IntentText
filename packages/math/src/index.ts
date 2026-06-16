/**
 * @dotit/math — math/equation rendering for IntentText.
 *
 * `@dotit/core` stays dependency-free: it only MARKS math, emitting placeholder
 * elements `<span class="it-math" data-tex="…">` (inline) and
 * `<div class="it-math-block" data-tex="…">` (display). This package turns those
 * into real math:
 *
 *   • mathToMathML(tex)      — a dependency-free LaTeX→MathML LITE renderer covering
 *                              the common business/science subset (fractions, powers,
 *                              roots, Greek, operators). Always available, sync.
 *   • renderMath(tex, opts)  — async; uses KaTeX (optional peer) for FULL LaTeX when
 *                              installed/requested, else falls back to lite MathML.
 *   • renderMathInHtml(html) — replace the core placeholders in an HTML string
 *                              (server/print path).
 *   • hydrateMath(root)      — upgrade the placeholders in a live DOM (the editor).
 */

const NS = "http://www.w3.org/1998/Math/MathML";

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν",
  xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", chi: "χ",
  psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", div: "÷", pm: "±", mp: "∓", cdot: "⋅", ast: "∗", star: "⋆",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", equiv: "≡", sim: "∼",
  ll: "≪", gg: "≫", propto: "∝",
  infty: "∞", partial: "∂", nabla: "∇", forall: "∀", exists: "∃",
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩",
  emptyset: "∅", angle: "∠", degree: "°", prime: "′",
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
  leftrightarrow: "↔", Leftrightarrow: "⇔", to: "→", mapsto: "↦",
  sum: "∑", prod: "∏", int: "∫", oint: "∮", coprod: "∐",
  ldots: "…", cdots: "⋯", vdots: "⋮", dots: "…",
  langle: "⟨", rangle: "⟩", lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋",
};

const BIG_OPS = new Set(["sum", "prod", "int", "oint", "coprod"]);

function xml(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

type Tok = { t: "cmd" | "num" | "ident" | "op" | "lbrace" | "rbrace" | "sup" | "sub"; v: string };

function tokenize(tex: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const re = /\\[a-zA-Z]+|\d+\.?\d*|[a-zA-Z]|\^|_|\{|\}|\s+|./y;
  while (i < tex.length) {
    re.lastIndex = i;
    const m = re.exec(tex);
    if (!m) break;
    i = re.lastIndex;
    const s = m[0];
    if (/^\s+$/.test(s)) continue;
    if (s[0] === "\\") out.push({ t: "cmd", v: s.slice(1) });
    else if (/^\d/.test(s)) out.push({ t: "num", v: s });
    else if (/^[a-zA-Z]$/.test(s)) out.push({ t: "ident", v: s });
    else if (s === "{") out.push({ t: "lbrace", v: s });
    else if (s === "}") out.push({ t: "rbrace", v: s });
    else if (s === "^") out.push({ t: "sup", v: s });
    else if (s === "_") out.push({ t: "sub", v: s });
    else out.push({ t: "op", v: s });
  }
  return out;
}

/** A tiny recursive-descent LaTeX-subset → MathML compiler. */
function compile(tokens: Tok[]): string {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  // An argument to \frac, \sqrt, ^ or _: a full {...} group, or a SINGLE atom (not
  // a scripted atom — so `x_i^2` attaches both scripts to x, not `i^2` to the sub).
  function group(): string {
    if (peek()?.t === "lbrace") {
      next();
      const parts: string[] = [];
      while (peek() && peek().t !== "rbrace") parts.push(scriptedAtom());
      if (peek()?.t === "rbrace") next();
      return parts.length === 1 ? parts[0] : `<mrow>${parts.join("")}</mrow>`;
    }
    return atom();
  }

  function atom(): string {
    const tk = next();
    if (!tk) return "";
    switch (tk.t) {
      case "num":
        return `<mn>${xml(tk.v)}</mn>`;
      case "ident":
        return `<mi>${xml(tk.v)}</mi>`;
      case "op":
        return `<mo>${xml(tk.v)}</mo>`;
      case "lbrace": {
        i--; // let group() consume the brace
        return group();
      }
      case "cmd": {
        if (tk.v === "frac") {
          const num = group();
          const den = group();
          return `<mfrac>${num}${den}</mfrac>`;
        }
        if (tk.v === "sqrt") {
          return `<msqrt>${group()}</msqrt>`;
        }
        if (tk.v === "text" || tk.v === "mathrm" || tk.v === "operatorname") {
          const g = group();
          return `<mtext>${g.replace(/<[^>]+>/g, "")}</mtext>`;
        }
        const sym = SYMBOLS[tk.v];
        if (sym) {
          const tag = BIG_OPS.has(tk.v) || /[+\-×÷±∓⋅=<>≤≥≠≈∈→←↔]/.test(sym) ? "mo" : "mi";
          return `<${tag}>${xml(sym)}</${tag}>`;
        }
        // unknown command → render its name as an operator (safe fallback)
        return `<mi>${xml(tk.v)}</mi>`;
      }
      default:
        return "";
    }
  }

  // an atom plus any ^/_ scripts attached to it
  function scriptedAtom(): string {
    let base = atom();
    let sup = "";
    let sub = "";
    while (peek()?.t === "sup" || peek()?.t === "sub") {
      const which = next().t;
      const s = group();
      if (which === "sup") sup = s;
      else sub = s;
    }
    if (sup && sub) return `<msubsup>${base}${sub}${sup}</msubsup>`;
    if (sup) return `<msup>${base}${sup}</msup>`;
    if (sub) return `<msub>${base}${sub}</msub>`;
    return base;
  }

  const parts: string[] = [];
  while (peek()) parts.push(scriptedAtom());
  return parts.join("");
}

export interface MathOptions {
  /** Display (block, centered) vs inline. Default inline. */
  display?: boolean;
}

/**
 * Dependency-free LaTeX-subset → MathML. Covers fractions, powers/subscripts,
 * roots, Greek letters, big operators and common relations/operators — the math
 * business and most science documents use. Full LaTeX → use renderMath with KaTeX.
 */
export function mathToMathML(tex: string, opts?: MathOptions): string {
  const body = compile(tokenize(tex ?? ""));
  const display = opts?.display ? ' display="block"' : ' display="inline"';
  return `<math xmlns="${NS}"${display}>${body || `<mtext>${xml(tex ?? "")}</mtext>`}</math>`;
}

export type MathEngine = "auto" | "lite" | "katex";

export interface RenderMathOptions extends MathOptions {
  /** "auto" (KaTeX if available, else lite), "lite" (always MathML), "katex". */
  engine?: MathEngine;
}

/** Load KaTeX if present (optional peer), else null. */
async function loadKatex(): Promise<{ renderToString: (t: string, o?: unknown) => string } | null> {
  try {
    const mod = (await import("katex")) as { default?: unknown } & Record<string, unknown>;
    const k = (mod.default ?? mod) as { renderToString?: (t: string, o?: unknown) => string };
    return typeof k.renderToString === "function" ? (k as { renderToString: (t: string, o?: unknown) => string }) : null;
  } catch {
    return null;
  }
}

/**
 * Render LaTeX to an HTML/MathML string. With KaTeX installed (and engine
 * "auto"/"katex") you get full LaTeX; otherwise the dependency-free lite MathML.
 */
export async function renderMath(tex: string, opts?: RenderMathOptions): Promise<string> {
  const engine = opts?.engine ?? "auto";
  if (engine !== "lite") {
    const katex = await loadKatex();
    if (katex) {
      try {
        return katex.renderToString(tex, {
          displayMode: !!opts?.display,
          throwOnError: false,
          output: "htmlAndMathml",
        });
      } catch {
        /* fall through to lite */
      }
    }
    if (engine === "katex") {
      // explicitly asked for katex but it isn't available → lite, but don't throw
    }
  }
  return mathToMathML(tex, opts);
}

function unescapeAttr(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Replace the math PLACEHOLDERS @dotit/core emits in an HTML string with rendered
 * math (server / print path). Inline: `<span class="it-math" data-tex="…">`,
 * display: `<div class="it-math-block" data-tex="…">`.
 */
export async function renderMathInHtml(html: string, opts?: RenderMathOptions): Promise<string> {
  const re = /<(span|div)\s+class="(it-math|it-math-block)"\s+data-tex="([^"]*)"[^>]*>[\s\S]*?<\/\1>/g;
  const jobs: Array<{ whole: string; rendered: Promise<string> }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const display = m[2] === "it-math-block";
    const tex = unescapeAttr(m[3]);
    jobs.push({ whole: m[0], rendered: renderMath(tex, { ...opts, display }) });
  }
  let out = html;
  for (const j of jobs) {
    out = out.replace(j.whole, await j.rendered);
  }
  return out;
}

/**
 * Upgrade math placeholders in a live DOM subtree (the editor). Browser-only.
 * Replaces each `.it-math[data-tex]` / `.it-math-block[data-tex]` element's content.
 */
export async function hydrateMath(root: ParentNode, opts?: RenderMathOptions): Promise<void> {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(".it-math[data-tex], .it-math-block[data-tex]"),
  );
  for (const el of nodes) {
    const tex = el.getAttribute("data-tex") ?? "";
    const display = el.classList.contains("it-math-block");
    el.innerHTML = await renderMath(tex, { ...opts, display });
    el.setAttribute("data-rendered", "1");
  }
}
