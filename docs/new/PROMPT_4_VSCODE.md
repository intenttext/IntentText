# IntentText VS Code Extension — Migration & Upgrade Prompt
# From: packages/vscode-extension/ in IntentText repo
# To: github.com/intenttext/intenttext-vscode (new repo)
# Marketplace: VS Code Marketplace (publisher: intenttext)
# Do this LAST — after core hardening, MCP, Action, and Python are done.

---

## MISSION

Move the VS Code extension from its current location inside the IntentText
monorepo into its own dedicated repo, then upgrade it to use the hardened
`@intenttext/core` v2.2.0 API — adding inline validation diagnostics,
hover documentation for keywords, and auto-completion via the new block schemas.

---

## PART 1 — MIGRATION STEPS

### 1. Create new repo

Create `github.com/intenttext/intenttext-vscode` as an empty repo.

### 2. Copy extension files

From `IntentText/vscode-extension/` copy everything into the new repo root.
The new repo structure should be:

```
intenttext-vscode/
├── src/
│   ├── extension.ts          Main extension entry point
│   ├── parser-bridge.ts      Bridge to @intenttext/core
│   ├── diagnostics.ts        NEW — validation diagnostics provider
│   ├── hover.ts              NEW — hover documentation provider
│   ├── completion.ts         NEW — auto-completion provider
│   └── preview.ts            Existing preview panel
├── syntaxes/
│   └── intenttext.tmLanguage.json    Existing syntax grammar
├── snippets/
│   └── intenttext.json               Existing snippets
├── package.json
├── tsconfig.json
├── .vscodeignore
├── .github/
│   └── workflows/
│       └── publish.yml       Auto-publish to Marketplace on tag
└── README.md
```

### 3. Update package.json

```json
{
  "name": "intenttext",
  "displayName": "IntentText (.it)",
  "description": "Syntax highlighting, live preview, and validation for IntentText documents",
  "version": "2.2.0",
  "publisher": "intenttext",
  "repository": {
    "type": "git",
    "url": "https://github.com/intenttext/intenttext-vscode"
  },
  "dependencies": {
    "@intenttext/core": ">=2.2.0"
  }
}
```

### 4. Remove from IntentText repo

After the new repo is working and published, remove `vscode-extension/` from
the IntentText repo and add a note in that folder's old location pointing to
the new repo.

---

## PART 2 — DIAGNOSTICS PROVIDER (main upgrade)

File: `src/diagnostics.ts`

Uses `validateDocument()` from `@intenttext/core` to show inline errors
and warnings as VS Code diagnostics (red/yellow squiggles).

```typescript
import * as vscode from 'vscode';
import { parseIntentText, validateDocument } from '@intenttext/core';

export function createDiagnosticsProvider(
  collection: vscode.DiagnosticCollection
) {
  return function updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'intenttext') return;

    const source = document.getText();
    let doc;
    try {
      doc = parseIntentText(source);
    } catch {
      collection.set(document.uri, []);
      return;
    }

    const result = validateDocument(doc);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const issue of result.issues) {
      // Find the line in the source that corresponds to this block
      const blockLine = findBlockLine(source, issue.blockId, doc);
      if (blockLine === -1) continue;

      const range = new vscode.Range(
        new vscode.Position(blockLine, 0),
        new vscode.Position(blockLine, 10000)
      );

      const severity = issue.type === 'error'
        ? vscode.DiagnosticSeverity.Error
        : issue.type === 'warning'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
      diagnostic.code = issue.code;
      diagnostic.source = 'IntentText';
      diagnostics.push(diagnostic);
    }

    collection.set(document.uri, diagnostics);
  };
}

function findBlockLine(
  source: string,
  blockId: string,
  doc: any
): number {
  // Map block ID back to line number by matching block content to source lines
  const block = doc.blocks.find((b: any) => b.id === blockId);
  if (!block) return -1;

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(block.originalContent || block.content)) {
      return i;
    }
  }
  return -1;
}
```

Wire in `extension.ts`:

```typescript
const diagnosticCollection = vscode.languages.createDiagnosticCollection('intenttext');
const updateDiagnostics = createDiagnosticsProvider(diagnosticCollection);

// Run on open and on every change (debounced 500ms)
let debounceTimer: NodeJS.Timeout;
vscode.workspace.onDidChangeTextDocument(event => {
  if (event.document.languageId === 'intenttext') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateDiagnostics(event.document), 500);
  }
});
vscode.workspace.onDidOpenTextDocument(updateDiagnostics);
```

---

## PART 3 — HOVER DOCUMENTATION PROVIDER

File: `src/hover.ts`

When a user hovers over a keyword (e.g. `gate:`, `step:`, `decision:`),
show a tooltip with the keyword's purpose and its available properties.

```typescript
import * as vscode from 'vscode';

const KEYWORD_DOCS: Record<string, { description: string; properties: string[] }> = {
  step: {
    description: 'Execute a tool or action in a workflow.',
    properties: ['tool', 'input', 'output', 'depends', 'id', 'status', 'timeout'],
  },
  gate: {
    description: 'Pause workflow for human approval before continuing.',
    properties: ['approver', 'timeout', 'fallback'],
  },
  decision: {
    description: 'Conditional branch — evaluate a condition and route to different steps.',
    properties: ['if', 'then', 'else'],
  },
  task: {
    description: 'An action item for a human to complete.',
    properties: ['owner', 'due', 'priority', 'status'],
  },
  parallel: {
    description: 'Execute multiple steps concurrently and wait for completion.',
    properties: ['steps', 'join'],
  },
  retry: {
    description: 'Retry a failed step with configurable backoff.',
    properties: ['max', 'delay', 'backoff'],
  },
  handoff: {
    description: 'Transfer execution from one agent to another.',
    properties: ['from', 'to'],
  },
  byline: {
    description: 'Author attribution for articles, reports, or books.',
    properties: ['date', 'publication', 'role'],
  },
  footnote: {
    description: 'A reference note. Use [^N] inline to reference it.',
    properties: ['text'],
  },
  toc: {
    description: 'Auto-generated table of contents from section and sub headings.',
    properties: ['depth', 'title'],
  },
  font: {
    description: 'Document typography settings.',
    properties: ['family', 'size', 'leading', 'weight', 'heading', 'mono'],
  },
  page: {
    description: 'Page layout settings for print output.',
    properties: ['size', 'margins', 'header', 'footer', 'columns', 'numbering', 'orientation'],
  },
  // Add all other keywords...
};

export function createHoverProvider(): vscode.HoverProvider {
  return {
    provideHover(document, position) {
      const line = document.lineAt(position).text;
      const keywordMatch = line.match(/^(\w+):/);
      if (!keywordMatch) return null;

      const keyword = keywordMatch[1].toLowerCase();
      const docs = KEYWORD_DOCS[keyword];
      if (!docs) return null;

      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**\`${keyword}:\`** — ${docs.description}\n\n`);
      if (docs.properties.length > 0) {
        md.appendMarkdown(`**Properties:** ${docs.properties.map(p => `\`${p}:\``).join(', ')}`);
      }
      md.appendMarkdown(`\n\n[IntentText Spec](https://github.com/intenttext/IntentText/blob/main/docs/SPEC.md)`);

      return new vscode.Hover(md);
    }
  };
}
```

---

## PART 4 — COMPLETION PROVIDER

File: `src/completion.ts`

Auto-complete for:
1. Keywords at the start of a line (type `st` → suggest `step:`, `sub:`, `success:`)
2. Property keys after `|` (type `| ow` on a `task:` line → suggest `| owner:`)

```typescript
import * as vscode from 'vscode';
import { ALL_KEYWORDS, BLOCK_SCHEMAS } from './schemas';

export function createCompletionProvider(): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(document, position) {
      const linePrefix = document.lineAt(position).text.slice(0, position.character);
      const items: vscode.CompletionItem[] = [];

      // Keyword completion — at start of line
      if (/^\s*\w*$/.test(linePrefix)) {
        for (const keyword of ALL_KEYWORDS) {
          const item = new vscode.CompletionItem(
            `${keyword}:`,
            vscode.CompletionItemKind.Keyword
          );
          item.insertText = new vscode.SnippetString(`${keyword}: $1`);
          item.detail = 'IntentText keyword';
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
              vscode.CompletionItemKind.Property
            );
            item.insertText = new vscode.SnippetString(
              `${prop.key}: ${prop.placeholder ? `\${1:${prop.placeholder}}` : '$1'}`
            );
            item.detail = prop.label;
            if (prop.options) {
              item.documentation = `Options: ${prop.options.join(', ')}`;
            }
            items.push(item);
          }
        }
        return items;
      }

      return null;
    }
  };
}
```

---

## PART 5 — CI/CD

File: `.github/workflows/publish.yml`

```yaml
name: Publish to VS Code Marketplace

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run compile
      - run: npx vsce publish --pat ${{ secrets.VSCE_PAT }}
```

To publish, you need a VS Code Marketplace Personal Access Token (PAT).
Create one at: https://marketplace.visualstudio.com/manage
Publisher name: `intenttext`
Store the PAT as `VSCE_PAT` in the repo's GitHub Secrets.

---

## PART 6 — README

Update the extension README to reflect the new capabilities:

- Syntax highlighting for all 36 keywords
- Live preview panel (`Cmd+Shift+V` / `Ctrl+Shift+V`)
- **NEW:** Inline validation — red squiggles for broken step references and errors
- **NEW:** Hover documentation — hover any keyword to see its description and properties
- **NEW:** Auto-completion — `Tab` after `|` to complete property names
- Snippets for common patterns

---

## CONSTRAINTS

- Keep all existing functionality — syntax highlighting, preview, snippets
- Diagnostics must be debounced (500ms) — do not run on every keystroke
- Extension must activate only for `intenttext` language ID, not globally
- No network calls from the extension
- Bundle size should stay under 5MB (use webpack/esbuild to bundle @intenttext/core)

*IntentText VS Code Extension — Migration & Upgrade Prompt v1.0 — March 2026*
