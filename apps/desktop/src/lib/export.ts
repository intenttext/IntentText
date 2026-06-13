// export.ts — Tauri-native export/print for the desktop app.
//
// The browser export path (@dotit/editor's iframe-print + blob-download) does
// not work inside Tauri's WKWebView: a sandboxed iframe can't drive the OS
// print panel, and there is no anchor-download. So we render through core's
// renderPrint and:
//   • print  → inject the rendered body into the MAIN document and call
//              window.print() (WKWebView surfaces the native print / Save-as-PDF
//              panel only for the top window, not an iframe).
//   • HTML   → save the print HTML string via the dialog + write_file command.
//   • DOCX   → convert to bytes and write via the binary file command.
//   • import → open a .docx, convert to IntentText source, hand back to the app.

import { save, open, message } from "@tauri-apps/plugin-dialog";
import {
  parseIntentText,
  renderPrint,
  convertIntentTextToDocx,
  convertDocxToIntentText,
} from "@dotit/core";
import { writeFile, writeBinaryFile, readBinaryFile } from "./backend";

/** Full standalone HTML document for the given source + theme. */
function buildPrintHTML(content: string, theme: string): string {
  return renderPrint(parseIntentText(content), { theme });
}

/** A filesystem-safe default filename (no extension) from the doc title/meta. */
function defaultName(content: string, fallback = "document"): string {
  try {
    const doc = parseIntentText(content);
    const raw =
      doc.metadata?.title?.trim() ||
      doc.metadata?.meta?.id?.trim() ||
      fallback;
    const safe = raw.replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim();
    return safe || fallback;
  } catch {
    return fallback;
  }
}

const PRINT_ROOT_ID = "it-print-root";
const PRINT_STYLE_ID = "it-print-style";

/**
 * Open the OS print / Save-as-PDF panel for the document.
 *
 * We render the document body into a hidden container appended to the MAIN
 * document, install an `@media print` sheet that hides everything except that
 * container, then call window.print(). The native panel appears (WKWebView only
 * exposes it for the top window). Cleanup runs on `afterprint`, with a timeout
 * fallback in case the event never fires.
 */
export function printDocument(content: string, theme: string): void {
  const html = buildPrintHTML(content, theme);

  // Pull the <body>…</body> and any inline <style> out of the standalone doc so
  // the rendered styles + content live inside our print container.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleBlocks = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n");
  // Preserve the body's classes (e.g. `it-print`) — core's print CSS keys off them.
  const bodyClass = (html.match(/<body[^>]*class="([^"]*)"/i)?.[1] ?? "").trim();
  const bodyInner = bodyMatch ? bodyMatch[1] : html;

  cleanupPrint(); // belt-and-braces: remove any stale container/style

  const container = document.createElement("div");
  container.id = PRINT_ROOT_ID;
  container.setAttribute("aria-hidden", "true");
  if (bodyClass) container.className = bodyClass;
  container.innerHTML = `${styleBlocks}${bodyInner}`;
  document.body.appendChild(container);

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    /* Off-screen on-screen; only visible at print time. */
    #${PRINT_ROOT_ID} { position: absolute; left: -10000px; top: 0; }
    @media print {
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} {
        position: static !important;
        left: auto !important;
        display: block !important;
      }
    }
  `;
  document.head.appendChild(style);

  const done = () => {
    window.removeEventListener("afterprint", done);
    cleanupPrint();
  };
  window.addEventListener("afterprint", done);
  // Fallback in case afterprint doesn't fire (some platforms/cancel paths).
  setTimeout(done, 60_000);

  // Let layout/styles settle before invoking the panel.
  setTimeout(() => window.print(), 50);
}

function cleanupPrint(): void {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

/** Save the document as a standalone .html file via the native save dialog. */
export async function exportHTML(content: string, theme: string): Promise<void> {
  try {
    const html = buildPrintHTML(content, theme);
    const path = await save({
      defaultPath: `${defaultName(content)}.html`,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (!path) return;
    await writeFile(path, html);
  } catch (err) {
    await reportError("HTML export failed", err);
  }
}

/** Save the document as a Word .docx file via the native save dialog. */
export async function exportDOCX(content: string): Promise<void> {
  try {
    const bytes = convertIntentTextToDocx(content);
    const path = await save({
      defaultPath: `${defaultName(content)}.docx`,
      filters: [{ name: "Word", extensions: ["docx"] }],
    });
    if (!path) return;
    await writeBinaryFile(path, Array.from(bytes));
  } catch (err) {
    await reportError("Word export failed", err);
  }
}

export interface ImportedDoc {
  source: string;
  suggestedName: string; // base name (no extension)
}

/**
 * Open a .docx, convert it to IntentText source, and hand it back so the app
 * can open it as a new untitled document. Returns null if cancelled/failed.
 */
export async function importDOCX(): Promise<ImportedDoc | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Word", extensions: ["docx"] }],
    });
    if (typeof selected !== "string") return null;
    const bytes = await readBinaryFile(selected);
    const source = convertDocxToIntentText(Uint8Array.from(bytes));
    const base =
      selected.split(/[\\/]/).pop()?.replace(/\.docx$/i, "") || "Imported";
    return { source, suggestedName: base };
  } catch (err) {
    await reportError("Word import failed", err);
    return null;
  }
}

async function reportError(title: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(title, err);
  try {
    await message(msg, { title, kind: "error" });
  } catch {
    /* dialog unavailable (e.g. plain vite dev) — console is enough */
  }
}
