// @dotit/pdf — server-side PDF generation for IntentText documents.
//
// Opt-in companion to @dotit/core (which stays zero-dependency). Use it when a
// machine — not a person with a browser — must produce the document: emailing an
// invoice, archiving for compliance, batch statement runs.
//
// Chrome resolution (first match wins):
//   1. `puppeteer` if installed (bundles its own Chromium)
//   2. `puppeteer-core` + a Chrome/Chromium binary, found via
//      options.executablePath → $PUPPETEER_EXECUTABLE_PATH → $CHROME_PATH →
//      common install locations (macOS / Linux / Windows)
//
// The pure pieces (merge → seal → print-HTML) are exported separately as
// `issueDocument()`, so you can also feed the HTML to your own renderer
// (e.g. a Gotenberg sidecar) without Chrome in this process.

import { existsSync } from "fs";
import {
  parseIntentText,
  parseAndMerge,
  documentToSource,
  renderPrint,
  sealDocument,
} from "@dotit/core";

/* ── Types ────────────────────────────────────────────────────────────────── */

/** Minimal structural types so puppeteer stays an optional dependency. */
interface ChromePage {
  setContent(html: string, opts?: Record<string, unknown>): Promise<void>;
  pdf(opts?: Record<string, unknown>): Promise<Buffer | Uint8Array>;
  close(): Promise<void>;
}
interface ChromeBrowser {
  newPage(): Promise<ChromePage>;
  close(): Promise<void>;
}

export interface PdfRenderOptions {
  /** Theme name (corporate | legal | editorial | …). Default: corporate. */
  theme?: string;
  /** Path to a Chrome/Chromium binary (for puppeteer-core). */
  executablePath?: string;
  /** Extra args passed to Chrome (e.g. ["--no-sandbox"] in containers). */
  launchArgs?: string[];
  /**
   * Options forwarded to page.pdf(). Defaults: printBackground: true,
   * preferCSSPageSize: true — so the document's `page:` size/margins are honored.
   */
  pdf?: Record<string, unknown>;
}

export interface IssueOptions extends PdfRenderOptions {
  /** Who issues/signs the document (company or system identity). */
  signer: string;
  /** Optional role recorded on the sign: line (e.g. "Billing"). */
  role?: string;
  /** How to render unresolved {{fields}}. Default "blank" (finished documents). */
  missing?: "keep" | "blank";
}

export interface IssuedDocument {
  /** The sealed `.it` source — store THIS on the record; it is the legal artifact. */
  source: string;
  /** The seal hash (sha256:…) — recompute later with verifyDocument() to prove integrity. */
  hash: string;
  /** ISO timestamp recorded on the seal. */
  at: string;
  /** Print-ready HTML of the sealed document (feed to Chrome/Gotenberg for a PDF). */
  html: string;
}

/* ── Chrome resolution ────────────────────────────────────────────────────── */

const CHROME_PATHS = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findChrome(explicit?: string): string | null {
  const candidates = [
    explicit,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    ...CHROME_PATHS,
  ].filter((p): p is string => !!p);
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function tryRequire(id: string): { launch(opts: Record<string, unknown>): Promise<ChromeBrowser> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(id);
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

async function launchBrowser(opts: PdfRenderOptions): Promise<ChromeBrowser> {
  const launchOpts: Record<string, unknown> = {
    headless: true,
    args: opts.launchArgs ?? [],
  };

  // 1) Full puppeteer (ships its own Chromium) — works with zero configuration.
  const puppeteer = tryRequire("puppeteer");
  if (puppeteer) return puppeteer.launch(launchOpts);

  // 2) puppeteer-core + a system Chrome.
  const core = tryRequire("puppeteer-core");
  if (core) {
    const executablePath = findChrome(opts.executablePath);
    if (!executablePath) {
      throw new Error(
        "@dotit/pdf: puppeteer-core is installed but no Chrome/Chromium binary was found. " +
          "Pass { executablePath } or set PUPPETEER_EXECUTABLE_PATH / CHROME_PATH.",
      );
    }
    return core.launch({ ...launchOpts, executablePath });
  }

  throw new Error(
    "@dotit/pdf needs a PDF engine. Install one of:\n" +
      "  npm i puppeteer        (bundles Chromium — zero config)\n" +
      "  npm i puppeteer-core   (uses your system Chrome — set executablePath or CHROME_PATH)\n" +
      "Or render without Chrome in this process: use issueDocument() and send its .html " +
      "to your own renderer (e.g. a Gotenberg sidecar).",
  );
}

/* ── Pure pipeline (no Chrome) ────────────────────────────────────────────── */

/**
 * The enterprise "issue" flow with no Chrome involved:
 *   merge data into the template → seal the merged document (tamper-evident
 *   SHA-256) → render print HTML.
 *
 * Store `source` (the sealed .it text) on your record — it is the queryable,
 * verifiable legal artifact. `html` is ready for any HTML→PDF renderer.
 */
export function issueDocument(
  templateSource: string,
  data: Record<string, unknown>,
  options: IssueOptions,
): IssuedDocument {
  const merged = parseAndMerge(templateSource, data, {
    missing: options.missing ?? "blank",
  });
  const mergedSource = documentToSource(merged);
  const seal = sealDocument(mergedSource, {
    signer: options.signer,
    role: options.role,
  });
  if (!seal.success) {
    throw new Error(`@dotit/pdf: sealing failed: ${seal.error ?? "unknown error"}`);
  }
  const html = renderPrint(parseIntentText(seal.source), {
    theme: options.theme ?? "corporate",
  });
  return { source: seal.source, hash: seal.hash, at: seal.at, html };
}

/* ── PDF rendering ────────────────────────────────────────────────────────── */

async function pageToPdf(
  browser: ChromeBrowser,
  html: string,
  opts: PdfRenderOptions,
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const bytes = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      ...(opts.pdf ?? {}),
    });
    return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  } finally {
    await page.close();
  }
}

/** Render an HTML document (e.g. from issueDocument().html) to PDF bytes. */
export async function htmlToPDF(
  html: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  const browser = await launchBrowser(options);
  try {
    return await pageToPdf(browser, html, options);
  } finally {
    await browser.close();
  }
}

/** Render an `.it` source (already merged/finished) to PDF bytes. */
export async function renderPDF(
  source: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  const html = renderPrint(parseIntentText(source), {
    theme: options.theme ?? "corporate",
  });
  return htmlToPDF(html, options);
}

/**
 * The full issue flow in one call: merge → seal → PDF.
 * Returns the sealed source (store it), the hash, and the PDF bytes (email it).
 */
export async function issuePDF(
  templateSource: string,
  data: Record<string, unknown>,
  options: IssueOptions,
): Promise<IssuedDocument & { pdf: Buffer }> {
  const issued = issueDocument(templateSource, data, options);
  const pdf = await htmlToPDF(issued.html, options);
  return { ...issued, pdf };
}

/** A PAdES signing identity (cert + key PEM) — see @dotit/pades. */
export interface PdfSigner {
  certPem: string;
  privateKeyPem: string;
  /** Shown in the PDF signature properties. */
  reason?: string;
  name?: string;
}

// Dynamic-import the ESM @dotit/pades from this CommonJS package. tsc (module
// CommonJS) would down-level a literal import() to require() — which can't load an
// ESM-only package — so we resolve the path with the module-scoped require() and
// import() it by file URL via Function (which tsc leaves untouched).
const importByUrl = new Function("u", "return import(u)") as (
  u: string,
) => Promise<typeof import("@dotit/pades")>;
async function importPades(): Promise<typeof import("@dotit/pades")> {
  const { pathToFileURL } = require("node:url") as typeof import("node:url");
  const resolved = require.resolve("@dotit/pades");
  return importByUrl(pathToFileURL(resolved).href);
}

/**
 * Render an `.it` to PDF AND embed a PAdES (ETSI.CAdES.detached) digital
 * signature — a one-call "issue a legally-recognized signed PDF". The native .it
 * seal/signatures (Ed25519) live in the source; this adds the X.509/PAdES
 * signature the outside world (Adobe, courts, gov) recognizes.
 *
 * Requires the optional peer `@dotit/pades`.
 */
export async function renderSignedPDF(
  source: string,
  options: PdfRenderOptions & { signer: PdfSigner },
): Promise<Uint8Array> {
  const pdf = await renderPDF(source, options);
  let pades: typeof import("@dotit/pades");
  try {
    pades = await importPades();
  } catch {
    throw new Error(
      "@dotit/pdf: renderSignedPDF needs the optional peer @dotit/pades — `npm i @dotit/pades`.",
    );
  }
  return pades.signPdfWithPem(new Uint8Array(pdf), {
    certPem: options.signer.certPem,
    privateKeyPem: options.signer.privateKeyPem,
    reason: options.signer.reason,
    name: options.signer.name,
  });
}

/**
 * Batch renderer that reuses one Chrome instance — launching Chrome costs ~1s,
 * so for month-end runs (hundreds of statements) create one renderer, loop, close.
 */
export async function createPdfRenderer(options: PdfRenderOptions = {}): Promise<{
  renderPDF(source: string, opts?: PdfRenderOptions): Promise<Buffer>;
  htmlToPDF(html: string, opts?: PdfRenderOptions): Promise<Buffer>;
  issuePDF(
    templateSource: string,
    data: Record<string, unknown>,
    opts: IssueOptions,
  ): Promise<IssuedDocument & { pdf: Buffer }>;
  close(): Promise<void>;
}> {
  const browser = await launchBrowser(options);
  return {
    async renderPDF(source, opts = {}) {
      const merged = { ...options, ...opts };
      const html = renderPrint(parseIntentText(source), {
        theme: merged.theme ?? "corporate",
      });
      return pageToPdf(browser, html, merged);
    },
    async htmlToPDF(html, opts = {}) {
      return pageToPdf(browser, html, { ...options, ...opts });
    },
    async issuePDF(templateSource, data, opts) {
      const merged = { ...options, ...opts };
      const issued = issueDocument(templateSource, data, merged);
      const pdf = await pageToPdf(browser, issued.html, merged);
      return { ...issued, pdf };
    },
    async close() {
      await browser.close();
    },
  };
}
