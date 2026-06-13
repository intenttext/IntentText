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

/**
 * Print / Save-as-PDF: render the document to a standalone HTML file in the OS
 * temp dir and open it in the system default browser, where Cmd+P → Print /
 * Save-as-PDF works reliably. WKWebView's own window.print() is unreliable, so
 * we deliberately hand off to the browser's mature print pipeline (core's @page
 * CSS gives the correct physical page size there).
 */
export async function printDocument(
  content: string,
  theme: string,
): Promise<void> {
  try {
    const html = buildPrintHTML(content, theme);
    const dir = await tempDir();
    const file = await join(dir, `intenttext-print-${Date.now()}.html`);
    await writeFile(file, html);
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
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Word", extensions: ["docx"] }],
    });
    if (typeof selected !== "string") return null;

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
