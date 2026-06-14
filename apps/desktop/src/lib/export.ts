// export.ts — Tauri-native export/print for the desktop app.
//
// The browser export path (@dotit/editor's iframe-print + blob-download) does
// not work inside Tauri's WKWebView: no anchor-download, and window.print() is
// unreliable in WKWebView. So we render through core's renderPrint and:
//   • print  → write the print HTML to a temp file and open it in the system
//              default browser, where Cmd+P / Save-as-PDF work reliably.
//   • HTML   → save the print HTML string via the dialog + write_file command.
//   • DOCX   → convert to bytes and write via the binary file command.
//   • import → open a .docx, convert to IntentText source, hand back to the app.

import { save, open, message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { tempDir, join } from "@tauri-apps/api/path";
import {
  parseIntentText,
  renderPrint,
  convertIntentTextToDocx,
  convertDocxToIntentText,
} from "@dotit/core";
import {
  writeFile,
  writeBinaryFile,
  readBinaryFile,
  openExternal,
} from "./backend";

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

/** Isolate the rendered document into the main webview's DOM so a native print
 *  of the webview shows only the document (everything else hidden at print time). */
function injectPrintDom(content: string, theme: string): void {
  const html = buildPrintHTML(content, theme);
  const bodyInner = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const styleBlocks = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n");
  const bodyClass = (html.match(/<body[^>]*class="([^"]*)"/i)?.[1] ?? "").trim();

  cleanupPrintDom();
  const container = document.createElement("div");
  container.id = PRINT_ROOT_ID;
  if (bodyClass) container.className = bodyClass;
  container.innerHTML = `${styleBlocks}${bodyInner}`;
  document.body.appendChild(container);

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    #${PRINT_ROOT_ID}{position:absolute;left:-10000px;top:0;}
    @media print{
      html,body{background:#fff !important;}
      body > *:not(#${PRINT_ROOT_ID}){display:none !important;}
      #${PRINT_ROOT_ID}{position:static !important;left:auto !important;display:block !important;}
    }`;
  document.head.appendChild(style);
}

function cleanupPrintDom(): void {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

/**
 * Print / Save-as-PDF. Tries the NATIVE macOS print panel first (NSPrintOperation
 * via the WKWebView handle — the real system dialog); if that's unavailable or
 * fails, falls back to opening the print HTML in the system browser (reliable
 * everywhere). Either way the user gets a working print + Save-as-PDF.
 */
export async function printDocument(
  content: string,
  theme: string,
): Promise<void> {
  injectPrintDom(content, theme);
  // Let layout/fonts settle before the print snapshot.
  await new Promise((r) => setTimeout(r, 120));
  try {
    await invoke("native_print"); // blocks until the native panel is dismissed
    cleanupPrintDom();
  } catch {
    cleanupPrintDom();
    await browserPrint(content, theme);
  }
}

/** Fallback: render to a temp .html and open it in the default browser, where
 *  Cmd+P / Save-as-PDF work. Auto-opens the dialog so it's a single action. */
async function browserPrint(content: string, theme: string): Promise<void> {
  try {
    const html = buildPrintHTML(content, theme);
    const autoPrint =
      `<script>window.addEventListener("load",function(){` +
      `setTimeout(function(){window.print();},350);});</script>`;
    const withPrint = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${autoPrint}</body>`)
      : html + autoPrint;
    const dir = await tempDir();
    const file = await join(dir, `intenttext-print-${Date.now()}.html`);
    await writeFile(file, withPrint);
    await openExternal(file);
  } catch (err) {
    await reportError("Print failed", err);
  }
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
  const selected = await open({
    multiple: false,
    filters: [{ name: "Word", extensions: ["docx"] }],
  });
  if (typeof selected !== "string") return null;
  return importDOCXFromPath(selected);
}

/** Convert a specific .docx path (e.g. a drag-dropped file) to IntentText. */
export async function importDOCXFromPath(
  selected: string,
): Promise<ImportedDoc | null> {
  try {
    const bytes = await readBinaryFile(selected);
    if (!bytes || bytes.length === 0) {
      await message(
        `Read 0 bytes from:\n${selected}\n\nThe file may be unreadable or the binary read command failed.`,
        { title: "Word import — empty read", kind: "warning" },
      );
      return null;
    }

    const source = convertDocxToIntentText(Uint8Array.from(bytes));
    // Distinguish "read OK but couldn't extract text" (converter gap on a real
    // Word file) from a clean import — so the failure is visible, not silent.
    if (!source || source.replace(/\s/g, "").length < 3) {
      await message(
        `Read ${bytes.length.toLocaleString()} bytes, but extracted no document text.\n\n` +
          `This .docx likely uses a structure the converter doesn't handle yet. ` +
          `Send me this file and I'll extend the converter.`,
        { title: "Word import — nothing extracted", kind: "warning" },
      );
      return null;
    }

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
