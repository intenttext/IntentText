import * as vscode from "vscode";
import { createDiagnosticsProvider } from "./diagnostics";
import { createHoverProvider } from "./hover";
import { createCompletionProvider } from "./completion";
import { createPreviewCommands, updatePreview } from "./preview";
import { execSync } from "child_process";

const LANGUAGE_ID = "intenttext";

export function activate(context: vscode.ExtensionContext) {
  // Diagnostics
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  const updateDiagnostics = createDiagnosticsProvider(diagnosticCollection);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  context.subscriptions.push(
    diagnosticCollection,

    // Run diagnostics on open
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === LANGUAGE_ID) {
        updateDiagnostics(doc);
      }
    }),

    // Run diagnostics on change (debounced 500ms) + update preview
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === LANGUAGE_ID) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          updateDiagnostics(event.document);
          updatePreview(event.document);
        }, 500);
      }
    }),

    // Hover
    vscode.languages.registerHoverProvider(
      { language: LANGUAGE_ID },
      createHoverProvider(),
    ),

    // Completion
    vscode.languages.registerCompletionItemProvider(
      { language: LANGUAGE_ID },
      createCompletionProvider(),
      "|", // trigger on pipe
    ),

    // Preview commands
    ...createPreviewCommands(),

    // Seal command
    vscode.commands.registerCommand("intenttext.seal", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        vscode.window.showWarningMessage("No IntentText file is open.");
        return;
      }
      const signer = await vscode.window.showInputBox({
        prompt: "Signer full name",
        placeHolder: "e.g. Ahmed Al-Rashid",
      });
      if (!signer) return;
      const role = await vscode.window.showInputBox({
        prompt: "Role (optional)",
        placeHolder: "e.g. CEO, Acme Corp",
      });
      try {
        const filePath = editor.document.uri.fsPath;
        const args = [`seal`, `"${filePath}"`, `--signer`, `"${signer}"`];
        if (role) args.push(`--role`, `"${role}"`);
        execSync(`intenttext ${args.join(" ")}`, { encoding: "utf-8" });
        // Reload the document
        const doc = await vscode.workspace.openTextDocument(
          editor.document.uri,
        );
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`Document sealed by ${signer}.`);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Seal failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),

    // Verify command
    vscode.commands.registerCommand("intenttext.verify", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        vscode.window.showWarningMessage("No IntentText file is open.");
        return;
      }
      try {
        const filePath = editor.document.uri.fsPath;
        const output = execSync(`intenttext verify "${filePath}"`, {
          encoding: "utf-8",
        });
        vscode.window.showInformationMessage(
          output.trim().split("\n")[0] || "Verification complete.",
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Verify failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),

    // History command
    vscode.commands.registerCommand("intenttext.history", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        vscode.window.showWarningMessage("No IntentText file is open.");
        return;
      }
      try {
        const filePath = editor.document.uri.fsPath;
        const output = execSync(`intenttext history "${filePath}"`, {
          encoding: "utf-8",
        });
        const panel = vscode.window.createOutputChannel("IntentText History");
        panel.clear();
        panel.appendLine(output);
        panel.show();
      } catch (err) {
        vscode.window.showErrorMessage(
          `History failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  // Run diagnostics for already-open documents
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === LANGUAGE_ID) {
      updateDiagnostics(doc);
    }
  }
}

export function deactivate() {}
