import * as vscode from "vscode";
import { ALL_KEYWORDS, EXTENSION_NAMESPACES, BLOCK_SCHEMAS } from "./schemas";

export function createCompletionProvider(): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(document, position) {
      const linePrefix = document
        .lineAt(position)
        .text.slice(0, position.character);
      const items: vscode.CompletionItem[] = [];

      // Keyword completion — at start of line
      if (/^\s*\w*$/.test(linePrefix)) {
        for (const keyword of ALL_KEYWORDS) {
          const item = new vscode.CompletionItem(
            `${keyword}:`,
            vscode.CompletionItemKind.Keyword,
          );
          item.insertText = new vscode.SnippetString(`${keyword}: $1`);
          item.detail = "IntentText keyword";
          items.push(item);
        }

        // Extension namespace completions (x-writer:, x-agent:, etc.)
        for (const ns of EXTENSION_NAMESPACES) {
          const item = new vscode.CompletionItem(
            `${ns}:`,
            vscode.CompletionItemKind.Module,
          );
          item.insertText = new vscode.SnippetString(`${ns}: $1`);
          item.detail = "IntentText extension namespace";
          items.push(item);
        }

        return items;
      }

      // Property completion — after |
      const pipeMatch = linePrefix.match(/^(\w+):.*\|\s*(\w*)$/);
      if (pipeMatch) {
        const blockType = pipeMatch[1].toLowerCase();
        const schema = BLOCK_SCHEMAS[blockType];
        if (schema) {
          for (const prop of schema) {
            const item = new vscode.CompletionItem(
              `${prop.key}:`,
              vscode.CompletionItemKind.Property,
            );
            item.insertText = new vscode.SnippetString(
              `${prop.key}: ${prop.placeholder ? `\${1:${prop.placeholder}}` : "$1"}`,
            );
            item.detail = prop.label;
            if (prop.options) {
              item.documentation = `Options: ${prop.options.join(", ")}`;
            }
            items.push(item);
          }
        }
        return items;
      }

      return null;
    },
  };
}
