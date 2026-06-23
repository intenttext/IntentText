import * as vscode from "vscode";
import { renderPrint, parseIntentText } from "./parser-bridge";

let panel: vscode.WebviewPanel | undefined;

function openPreview(side: boolean): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "intenttext") {
    vscode.window.showWarningMessage("Open an IntentText (.it) file first.");
    return;
  }

  if (panel) {
    panel.reveal(side ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active);
  } else {
    panel = vscode.window.createWebviewPanel(
      "intenttextPreview",
      "IntentText Preview",
      side ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
      { enableScripts: false },
    );
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }

  updatePreview(editor.document);
}

export function createPreviewCommands(): vscode.Disposable[] {
  // One preview action, opened beside the source. Both command ids open the same
  // side-by-side preview so older keybindings keep working.
  return [
    vscode.commands.registerCommand("intenttext.preview", () =>
      openPreview(true),
    ),
    vscode.commands.registerCommand("intenttext.previewToSide", () =>
      openPreview(true),
    ),
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
    // renderPrint returns a COMPLETE themed HTML document — base DOCUMENT_CSS +
    // theme CSS + per-document style: rules, all inline. It is the EXACT output the
    // web editor (editor.uts.qa), @dotit/pdf and the desktop app render, so this
    // preview matches them 1:1 (same renderer, same CSS, same page layout).
    html = renderPrint(doc, { theme });
  } catch {
    html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:2rem;color:#b00020">IntentText preview — parse error. Fix the syntax and save again.</body></html>`;
  }

  panel.webview.html = html;
}
