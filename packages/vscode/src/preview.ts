import * as vscode from "vscode";
import { renderHTML, parseIntentText } from "./parser-bridge";

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
  return [
    vscode.commands.registerCommand("intenttext.preview", () =>
      openPreview(false),
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
    html = renderHTML(doc);
  } catch {
    html = `<html><body><p style="color:red;">Parse error — fix syntax and save again.</p></body></html>`;
  }

  panel.webview.html = wrapHtml(html);
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Force isolated light document look regardless of VS Code theme */
    html {
      background: #f4f4f5;
      min-height: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      background: #ffffff;
      max-width: 780px;
      margin: 2rem auto;
      padding: 2.5rem 3rem;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.10);
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.25rem; color: #111; letter-spacing: -0.02em; }
    h2 { font-size: 1.2rem; font-weight: 600; margin: 2rem 0 0.5rem; color: #222; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.25rem; }
    h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.35rem; color: #333; }
    p { margin: 0.4rem 0 0.75rem; color: #333; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 1.5rem 0; }
    pre {
      background: #f6f8fa;
      border: 1px solid #e5e5e5;
      border-radius: 5px;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.5;
    }
    code {
      font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", "Menlo", monospace;
      font-size: 0.875em;
      background: #f0f0f0;
      padding: 0.1em 0.35em;
      border-radius: 3px;
    }
    pre code { background: none; padding: 0; font-size: inherit; }
    blockquote {
      border-left: 3px solid #d0d0d0;
      margin: 0.75rem 0;
      padding: 0.25rem 1rem;
      color: #555;
      font-style: italic;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; font-size: 13px; }
    th, td { border: 1px solid #e0e0e0; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f6f8fa; font-weight: 600; color: #222; }
    tr:nth-child(even) td { background: #fafafa; }
    ul, ol { margin: 0.25rem 0 0.75rem 1.5rem; padding: 0; }
    li { margin: 0.2rem 0; }
    /* Callout blocks */
    .callout {
      padding: 0.7rem 1rem;
      border-radius: 5px;
      margin: 0.75rem 0;
      font-size: 13.5px;
    }
    .callout-warning, .callout-alert {
      background: #fffbea;
      border-left: 4px solid #f59e0b;
      color: #78350f;
    }
    .callout-danger, .callout-critical {
      background: #fff1f2;
      border-left: 4px solid #ef4444;
      color: #7f1d1d;
    }
    .callout-tip, .callout-hint {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      color: #14532d;
    }
    .callout-info {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      color: #1e3a5f;
    }
    .callout-success {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      color: #14532d;
    }
    .callout-note, .callout-text {
      background: #f8f8f8;
      border-left: 4px solid #a0a0a0;
      color: #333;
    }
    /* Task/done items */
    .task-item { display: flex; gap: 0.5rem; align-items: baseline; margin: 0.2rem 0; }
    .task-checkbox { color: #aaa; flex-shrink: 0; }
    .task-checkbox.done { color: #16a34a; }
    /* Trust blocks */
    .sign-block, .freeze-block, .approve-block {
      background: #f6f8fa;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      padding: 0.6rem 1rem;
      font-size: 12.5px;
      color: #555;
      margin: 0.5rem 0;
    }
    /* Metadata strip at top */
    .doc-meta { font-size: 12.5px; color: #888; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
