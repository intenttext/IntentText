import * as vscode from "vscode";
import { renderPrint, parseIntentText } from "./parser-bridge";

let panel: vscode.WebviewPanel | undefined;

// Make the webview show the document as a page on a surface — a white "page" card
// centered on a soft gray background — so it matches the web editor and desktop app,
// instead of a bare column on white. Appended LAST so it wins over the theme CSS.
const PAGE_SURFACE_CSS = `<style>
  html, body { background: #eef0f3 !important; margin: 0 !important; }
  body { padding: 28px clamp(12px, 4vw, 56px) !important; }
  .intent-document {
    background: #ffffff !important;
    box-shadow: 0 2px 18px rgba(15, 23, 42, 0.12) !important;
    border-radius: 8px !important;
  }
</style>`;

function openPreview(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "intenttext") {
    vscode.window.showWarningMessage("Open an IntentText (.it) file first.");
    return;
  }

  if (panel) {
    panel.reveal();
  } else {
    panel = vscode.window.createWebviewPanel(
      "intenttextPreview",
      "IntentText Preview",
      // Open as a full-width tab in the active group (NOT a half-width side split).
      vscode.ViewColumn.Active,
      { enableScripts: false, retainContextWhenHidden: true },
    );
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }

  updatePreview(editor.document);
}

export function createPreviewCommands(): vscode.Disposable[] {
  // Both ids open the same full-width preview (older keybindings keep working).
  return [
    vscode.commands.registerCommand("intenttext.preview", () => openPreview()),
    vscode.commands.registerCommand("intenttext.previewToSide", () => openPreview()),
  ];
}

export function updatePreview(document: vscode.TextDocument): void {
  if (!panel) return;
  if (document.languageId !== "intenttext") return;

  const source = document.getText();
  let html: string;
  try {
    const doc = parseIntentText(source);
    // The document's own theme (meta: | theme: …), defaulting to corporate.
    const theme =
      (doc.metadata as Record<string, unknown> | undefined)?.theme?.toString() ||
      "corporate";
    // renderPrint returns a COMPLETE themed HTML document — base DOCUMENT_CSS + theme
    // CSS + per-document style: rules, all inline. It is the EXACT output the web editor
    // (editor.uts.qa), @dotit/pdf and the desktop app render, so this preview matches
    // them 1:1. We only add a page-surface wrapper so it reads as a page, not a column.
    const rendered = renderPrint(doc, { theme });
    html = rendered.includes("</head>")
      ? rendered.replace("</head>", `${PAGE_SURFACE_CSS}</head>`)
      : rendered;
  } catch {
    html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:2rem;color:#b00020">IntentText preview — parse error. Fix the syntax and save again.</body></html>`;
  }

  panel.webview.html = html;
}
