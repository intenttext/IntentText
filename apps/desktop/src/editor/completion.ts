import type * as Monaco from "monaco-editor";
import { ALIASES } from "@intenttext/core";

interface KwInfo {
  keyword: string;
  category: string;
  detail: string;
  snippet: string;
}

const KEYWORD_DB: KwInfo[] = [
  // Trust
  {
    keyword: "track",
    category: "trust",
    detail: "Enable change tracking",
    snippet: "track: ${1:Description} | by: ${2:Author}",
  },
  {
    keyword: "approve",
    category: "trust",
    detail: "Record approval",
    snippet: "approve: ${1:Reviewed} | by: ${2:Name} | role: ${3:Role}",
  },
  {
    keyword: "sign",
    category: "trust",
    detail: "Integrity hash seal",
    snippet: "sign: ${1:Full Name} | role: ${2:Title} | at: ${3:$CURRENT_DATE}",
  },
  {
    keyword: "freeze",
    category: "trust",
    detail: "Seal/freeze document",
    snippet: "freeze: ${1:Document sealed}",
  },
  {
    keyword: "revision",
    category: "trust",
    detail: "Revision marker",
    snippet: "revision: ${1:1.0} | date: ${2:$CURRENT_DATE} | by: ${3:Author}",
  },
  {
    keyword: "policy",
    category: "trust",
    detail: "Policy/rule constraint",
    snippet:
      "policy: ${1:Rule description} | always: ${2:rule} | action: ${3:block}",
  },
  {
    keyword: "amendment",
    category: "trust",
    detail: "Amendment to frozen doc",
    snippet:
      "amendment: ${1:Change description} | section: ${2:Section} | was: ${3:old} | now: ${4:new}",
  },

  // Identity
  {
    keyword: "title",
    category: "identity",
    detail: "Document title",
    snippet: "title: ${1:Document Title}",
  },
  {
    keyword: "summary",
    category: "identity",
    detail: "Document summary",
    snippet: "summary: ${1:Brief description}",
  },
  {
    keyword: "meta",
    category: "identity",
    detail: "Document metadata",
    snippet: "meta: ${1:key} | ${2:value}",
  },
  {
    keyword: "context",
    category: "identity",
    detail: "Contextual information",
    snippet: "context: ${1:Background information}",
  },

  // Structure
  {
    keyword: "section",
    category: "structure",
    detail: "Section heading",
    snippet: "section: ${1:Section Title}",
  },
  {
    keyword: "sub",
    category: "structure",
    detail: "Sub-section heading",
    snippet: "sub: ${1:Sub-section}",
  },
  {
    keyword: "break",
    category: "structure",
    detail: "Page/section break",
    snippet: "break: ${1:page}",
  },
  {
    keyword: "group",
    category: "structure",
    detail: "Group of blocks",
    snippet: "group: ${1:Group Name}",
  },
  {
    keyword: "ref",
    category: "structure",
    detail: "Cross-reference",
    snippet:
      "ref: ${1:Document name} | file: ${2:./path.it} | rel: ${3:relates-to}",
  },
  {
    keyword: "deadline",
    category: "structure",
    detail: "Deadline/milestone",
    snippet:
      "deadline: ${1:Description} | date: ${2:YYYY-MM-DD} | consequence: ${3:}",
  },
  {
    keyword: "divider",
    category: "structure",
    detail: "Visual divider",
    snippet: "divider:",
  },

  // Content
  {
    keyword: "note",
    category: "content",
    detail: "Text paragraph",
    snippet: "note: ${1:content}",
  },
  {
    keyword: "quote",
    category: "content",
    detail: "Block quote",
    snippet: "quote: ${1:quoted text} | by: ${2:Author}",
  },
  {
    keyword: "warning",
    category: "content",
    detail: "Warning callout",
    snippet: "warning: ${1:Warning message}",
  },
  {
    keyword: "tip",
    category: "content",
    detail: "Tip callout",
    snippet: "tip: ${1:Helpful tip}",
  },
  {
    keyword: "info",
    category: "content",
    detail: "Info callout",
    snippet: "info: ${1:Information}",
  },
  {
    keyword: "success",
    category: "content",
    detail: "Success callout",
    snippet: "success: ${1:Success message}",
  },
  {
    keyword: "code",
    category: "content",
    detail: "Code block",
    snippet: "code: ${1:code} | lang: ${2:javascript}",
  },
  {
    keyword: "image",
    category: "content",
    detail: "Image embed",
    snippet: "image: ${1:Alt text} | src: ${2:./image.png}",
  },
  {
    keyword: "link",
    category: "content",
    detail: "Hyperlink",
    snippet: "link: ${1:Link text} | to: ${2:https://}",
  },
  {
    keyword: "def",
    category: "content",
    detail: "Definition/term",
    snippet: "def: ${1:Term} | meaning: ${2:Definition}",
  },
  {
    keyword: "figure",
    category: "content",
    detail: "Figure with caption",
    snippet: "figure: ${1:Caption} | src: ${2:./image.png}",
  },
  {
    keyword: "contact",
    category: "content",
    detail: "Contact information",
    snippet: "contact: ${1:Full Name} | role: ${2:Title} | email: ${3:}",
  },
  {
    keyword: "toc",
    category: "content",
    detail: "Table of contents",
    snippet: "toc: ${1:auto}",
  },
  {
    keyword: "caption",
    category: "content",
    detail: "Caption text",
    snippet: "caption: ${1:Caption}",
  },
  {
    keyword: "footnote",
    category: "content",
    detail: "Footnote",
    snippet: "footnote: ${1:Note text}",
  },
  {
    keyword: "dedication",
    category: "content",
    detail: "Book dedication",
    snippet: "dedication: ${1:To someone special}",
  },
  {
    keyword: "epigraph",
    category: "content",
    detail: "Opening quote",
    snippet: "epigraph: ${1:Quote} | by: ${2:Author}",
  },
  {
    keyword: "byline",
    category: "content",
    detail: "Author byline",
    snippet: "byline: ${1:Author Name}",
  },

  // Data
  {
    keyword: "input",
    category: "data",
    detail: "Input field",
    snippet: "input: ${1:field_name} | type: ${2:text} | label: ${3:Label}",
  },
  {
    keyword: "output",
    category: "data",
    detail: "Output field",
    snippet: "output: ${1:field_name} | value: ${2:}",
  },
  {
    keyword: "table",
    category: "data",
    detail: "Table header",
    snippet: "table: ${1:Table Title}",
  },
  {
    keyword: "headers",
    category: "data",
    detail: "Table column headers",
    snippet: "headers: ${1:Col1} | ${2:Col2} | ${3:Col3}",
  },
  {
    keyword: "row",
    category: "data",
    detail: "Table row",
    snippet: "row: ${1:val1} | ${2:val2} | ${3:val3}",
  },
  {
    keyword: "metric",
    category: "data",
    detail: "KPI/metric value",
    snippet:
      "metric: ${1:Name} | value: ${2:0} | unit: ${3:USD} | target: ${4:0}",
  },

  // Agent
  {
    keyword: "step",
    category: "agent",
    detail: "Workflow step",
    snippet: "step: ${1:Step name} | owner: ${2:agent}",
  },
  {
    keyword: "gate",
    category: "agent",
    detail: "Approval gate",
    snippet: "gate: ${1:Approval needed} | approver: ${2:role}",
  },
  {
    keyword: "trigger",
    category: "agent",
    detail: "Event trigger",
    snippet: "trigger: ${1:Event name} | on: ${2:condition}",
  },
  {
    keyword: "emit",
    category: "agent",
    detail: "Emit event/status",
    snippet: "emit: ${1:event_name} | data: ${2:payload}",
  },
  {
    keyword: "decision",
    category: "agent",
    detail: "Decision point",
    snippet: "decision: ${1:Question?} | yes: ${2:action} | no: ${3:action}",
  },
  {
    keyword: "prompt",
    category: "agent",
    detail: "LLM prompt",
    snippet: "prompt: ${1:Instructions}",
  },
  {
    keyword: "tool",
    category: "agent",
    detail: "Tool invocation",
    snippet: "tool: ${1:tool_name} | input: ${2:params}",
  },
  {
    keyword: "audit",
    category: "agent",
    detail: "Audit log entry",
    snippet: "audit: ${1:Action taken}",
  },
  {
    keyword: "done",
    category: "agent",
    detail: "Completion marker",
    snippet: "done: ${1:Task completed}",
  },
  {
    keyword: "error",
    category: "agent",
    detail: "Error handling",
    snippet: "error: ${1:Error message} | retry: ${2:3}",
  },
  {
    keyword: "task",
    category: "agent",
    detail: "Task item",
    snippet:
      "task: ${1:Task description} | owner: ${2:assignee} | due: ${3:date}",
  },
  {
    keyword: "ask",
    category: "agent",
    detail: "Question/prompt",
    snippet: "ask: ${1:Question}",
  },
  {
    keyword: "result",
    category: "agent",
    detail: "Result output",
    snippet: "result: ${1:Result}",
  },
  {
    keyword: "handoff",
    category: "agent",
    detail: "Handoff to agent",
    snippet: "handoff: ${1:Target agent} | context: ${2:}",
  },
  {
    keyword: "wait",
    category: "agent",
    detail: "Wait/pause step",
    snippet: "wait: ${1:Condition} | timeout: ${2:30s}",
  },
  {
    keyword: "parallel",
    category: "agent",
    detail: "Parallel execution",
    snippet: "parallel: ${1:Tasks}",
  },
  {
    keyword: "retry",
    category: "agent",
    detail: "Retry logic",
    snippet: "retry: ${1:Action} | max: ${2:3}",
  },
  {
    keyword: "call",
    category: "agent",
    detail: "Function/API call",
    snippet: "call: ${1:function_name} | args: ${2:}",
  },
  {
    keyword: "loop",
    category: "agent",
    detail: "Loop construct",
    snippet: "loop: ${1:Items} | each: ${2:item}",
  },
  {
    keyword: "checkpoint",
    category: "agent",
    detail: "State checkpoint",
    snippet: "checkpoint: ${1:Checkpoint name}",
  },
  {
    keyword: "import",
    category: "agent",
    detail: "Import resource",
    snippet: "import: ${1:resource}",
  },
  {
    keyword: "export",
    category: "agent",
    detail: "Export data",
    snippet: "export: ${1:data}",
  },
  {
    keyword: "progress",
    category: "agent",
    detail: "Progress indicator",
    snippet: "progress: ${1:50%}",
  },

  // Layout
  {
    keyword: "page",
    category: "layout",
    detail: "Page settings",
    snippet: "page: ${1:A4} | margin: ${2:1in}",
  },
  {
    keyword: "font",
    category: "layout",
    detail: "Font settings",
    snippet: "font: ${1:Inter} | size: ${2:12pt}",
  },
  {
    keyword: "header",
    category: "layout",
    detail: "Page header",
    snippet: "header: ${1:Header text}",
  },
  {
    keyword: "footer",
    category: "layout",
    detail: "Page footer",
    snippet: "footer: ${1:Footer text}",
  },
  {
    keyword: "watermark",
    category: "layout",
    detail: "Watermark text",
    snippet: "watermark: ${1:DRAFT}",
  },
  {
    keyword: "signline",
    category: "layout",
    detail: "Signature line",
    snippet: "signline: ${1:Name} | role: ${2:Title}",
  },
  {
    keyword: "end",
    category: "layout",
    detail: "End marker",
    snippet: "end: ${1:document}",
  },
];

// Property suggestions per keyword
const PIPE_PROPERTIES: Record<string, string[]> = {
  note: ["style", "id"],
  section: ["id", "class"],
  task: ["owner", "due", "status", "priority"],
  step: ["owner", "timeout", "retry", "input", "output"],
  decision: ["yes", "no", "default"],
  sign: ["role", "at", "id"],
  approve: ["by", "role", "at"],
  track: ["by", "version"],
  freeze: ["hash", "at"],
  amendment: ["section", "was", "now", "ref", "at"],
  metric: ["value", "unit", "target", "trend"],
  contact: ["role", "email", "phone", "org"],
  deadline: ["date", "consequence", "owner"],
  image: ["src", "alt", "width", "caption"],
  link: ["to", "title"],
  code: ["lang", "title"],
  quote: ["by", "source"],
  ref: ["file", "rel", "section"],
  table: ["id", "class"],
  input: ["type", "label", "default", "required"],
  output: ["value", "format"],
  trigger: ["on", "condition"],
  emit: ["data", "to"],
  gate: ["approver", "timeout"],
  def: ["meaning", "source"],
  figure: ["src", "caption", "width"],
  signline: ["role", "date"],
  revision: ["date", "by", "changes"],
  policy: ["enforce", "scope"],
  page: ["margin", "orientation", "size"],
  font: ["size", "weight", "family"],
  meta: ["domain", "author", "version", "date", "lang"],
};

export function registerCompletionProvider(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider("intenttext", {
    triggerCharacters: ["|", "\n"],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber);
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // After pipe: suggest properties for current keyword
      const pipeIdx = line.lastIndexOf("|", position.column - 2);
      if (pipeIdx >= 0) {
        const kwMatch = line.match(/^(\w+):/);
        const kw = kwMatch?.[1];
        if (kw) {
          const props = PIPE_PROPERTIES[kw] || [];
          return {
            suggestions: props.map((p) => ({
              label: p,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: ` ${p}: \${1:}`,
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              detail: `property of ${kw}:`,
            })),
          };
        }
      }

      // At line start: suggest keywords
      const before = line.slice(0, position.column - 1).trim();
      if (before.length <= word.word.length) {
        const suggestions: Monaco.languages.CompletionItem[] = [];

        // Canonical keywords
        for (const kw of KEYWORD_DB) {
          suggestions.push({
            label: kw.keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw.snippet,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            detail: kw.category,
            documentation: kw.detail,
            sortText: `0_${kw.keyword}`,
          });
        }

        // Aliases
        for (const [alias, canonical] of Object.entries(ALIASES)) {
          const info = KEYWORD_DB.find((k) => k.keyword === canonical);
          if (info) {
            suggestions.push({
              label: alias,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: info.snippet.replace(`${canonical}:`, `${alias}:`),
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              detail: `alias → ${canonical}`,
              documentation: info.detail,
              sortText: `1_${alias}`,
            });
          }
        }

        return { suggestions };
      }

      return { suggestions: [] };
    },
  });
}
