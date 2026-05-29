import * as vscode from "vscode";
import { parseIntentText, validateDocumentSemantic } from "./parser-bridge";
import type { IntentDocument } from "./parser-bridge";

export function createDiagnosticsProvider(
  collection: vscode.DiagnosticCollection,
) {
  return function updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== "intenttext") return;

    const source = document.getText();
    let doc: IntentDocument;
    try {
      doc = parseIntentText(source);
    } catch {
      collection.set(document.uri, []);
      return;
    }

    const result = validateDocumentSemantic(doc);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const issue of result.issues) {
      const blockLine = findBlockLine(source, issue.blockId, doc);
      if (blockLine === -1) continue;

      const range = new vscode.Range(
        new vscode.Position(blockLine, 0),
        new vscode.Position(blockLine, 10000),
      );

      const severity =
        issue.type === "error"
          ? vscode.DiagnosticSeverity.Error
          : issue.type === "warning"
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
      diagnostic.source = "IntentText";
      diagnostics.push(diagnostic);
    }

    // Surface parser-level diagnostics (e.g. deprecated property warnings)
    for (const pd of doc.diagnostics ?? []) {
      const lineIdx = Math.max(0, pd.line - 1);
      const range = new vscode.Range(
        new vscode.Position(lineIdx, 0),
        new vscode.Position(lineIdx, 10000),
      );
      const severity =
        pd.severity === "error"
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;
      const diagnostic = new vscode.Diagnostic(range, pd.message, severity);
      diagnostic.source = "IntentText";
      diagnostics.push(diagnostic);
    }

    collection.set(document.uri, diagnostics);
  };
}

function findBlockLine(
  source: string,
  blockId: string,
  doc: IntentDocument,
): number {
  const block = doc.blocks.find((b) => b.id === blockId);
  if (!block) return -1;

  const lines = source.split("\n");
  const content = block.content;
  if (!content) return -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(content)) {
      return i;
    }
  }
  return -1;
}
