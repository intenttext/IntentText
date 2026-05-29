import type * as Monaco from "monaco-editor";

interface HoverInfo {
  keyword: string;
  category: string;
  description: string;
  syntax: string;
}

const HOVER_DB: HoverInfo[] = [
  // Trust
  {
    keyword: "track",
    category: "Trust",
    description: "Enable change tracking for the document.",
    syntax: "track: Description | by: Author",
  },
  {
    keyword: "approve",
    category: "Trust",
    description: "Record an approval on the document.",
    syntax: "approve: Label | by: Name | role: Role",
  },
  {
    keyword: "sign",
    category: "Trust",
    description: "Add an integrity hash seal to the document.",
    syntax: "sign: Full Name | role: Title | at: Date",
  },
  {
    keyword: "freeze",
    category: "Trust",
    description:
      "Seal the document with a content hash. No further edits allowed without amendment.",
    syntax: "freeze: Label",
  },
  {
    keyword: "revision",
    category: "Trust",
    description: "Mark a revision point in the document.",
    syntax: "revision: Version | date: Date | by: Author",
  },
  {
    keyword: "policy",
    category: "Trust",
    description: "Define a policy rule or constraint.",
    syntax: "policy: Rule | always: rule | action: block",
  },
  {
    keyword: "amendment",
    category: "Trust",
    description: "Amend a frozen document. Requires prior freeze.",
    syntax: "amendment: Description | section: S | was: Old | now: New",
  },

  // Identity
  {
    keyword: "title",
    category: "Identity",
    description: "Set the document title.",
    syntax: "title: Document Title",
  },
  {
    keyword: "summary",
    category: "Identity",
    description: "Set the document summary.",
    syntax: "summary: Brief description",
  },
  {
    keyword: "meta",
    category: "Identity",
    description: "Add document metadata.",
    syntax: "meta: key | value",
  },
  {
    keyword: "context",
    category: "Identity",
    description: "Provide contextual background information.",
    syntax: "context: Background",
  },

  // Structure
  {
    keyword: "section",
    category: "Structure",
    description: "Create a section heading.",
    syntax: "section: Title",
  },
  {
    keyword: "sub",
    category: "Structure",
    description: "Create a sub-section heading.",
    syntax: "sub: Title",
  },
  {
    keyword: "break",
    category: "Structure",
    description: "Insert a page or section break.",
    syntax: "break: page",
  },
  {
    keyword: "group",
    category: "Structure",
    description: "Group related blocks.",
    syntax: "group: Name",
  },
  {
    keyword: "ref",
    category: "Structure",
    description: "Cross-reference another document or section.",
    syntax: "ref: Name | file: ./path.it | rel: relates-to",
  },
  {
    keyword: "deadline",
    category: "Structure",
    description: "Set a deadline or milestone.",
    syntax: "deadline: Description | date: YYYY-MM-DD",
  },
  {
    keyword: "divider",
    category: "Structure",
    description: "Insert a visual divider.",
    syntax: "divider:",
  },

  // Content
  {
    keyword: "text",
    category: "Content",
    description:
      "Text content block — the canonical paragraph keyword (v3.3). Bare prose lines that do not start with a keyword are implicitly treated as `text:` blocks.",
    syntax: "text: Content text",
  },
  {
    keyword: "note",
    category: "Content",
    description: "Write a text paragraph.",
    syntax: "note: Content text",
  },
  {
    keyword: "quote",
    category: "Content",
    description: "Insert a block quote.",
    syntax: "quote: Text | by: Author",
  },
  {
    keyword: "warning",
    category: "Content",
    description: "Display a warning callout.",
    syntax: "warning: Message",
  },
  {
    keyword: "tip",
    category: "Content",
    description: "Display a tip callout.",
    syntax: "tip: Message",
  },
  {
    keyword: "info",
    category: "Content",
    description: "Display an info callout.",
    syntax: "info: Message",
  },
  {
    keyword: "success",
    category: "Content",
    description: "Display a success callout.",
    syntax: "success: Message",
  },
  {
    keyword: "code",
    category: "Content",
    description: "Insert a code block.",
    syntax: "code: code | lang: javascript",
  },
  {
    keyword: "image",
    category: "Content",
    description: "Embed an image.",
    syntax: "image: Alt text | src: ./image.png",
  },
  {
    keyword: "link",
    category: "Content",
    description: "Create a hyperlink.",
    syntax: "link: Text | to: https://...",
  },
  {
    keyword: "def",
    category: "Content",
    description: "Define a term or glossary entry.",
    syntax: "def: Term | meaning: Definition",
  },
  {
    keyword: "figure",
    category: "Content",
    description: "Insert a figure with caption.",
    syntax: "figure: Caption | src: ./img.png",
  },
  {
    keyword: "contact",
    category: "Content",
    description: "Add contact information.",
    syntax: "contact: Name | role: Title | email: ...",
  },

  // Data
  {
    keyword: "input",
    category: "Data",
    description: "Define an input field.",
    syntax: "input: name | type: text | label: Label",
  },
  {
    keyword: "output",
    category: "Data",
    description: "Define an output field.",
    syntax: "output: name | value: ...",
  },
  {
    keyword: "table",
    category: "Data",
    description: "Start a data table.",
    syntax: "table: Title",
  },
  {
    keyword: "metric",
    category: "Data",
    description: "Display a KPI or metric.",
    syntax: "metric: Name | value: 0 | unit: USD",
  },

  // Agent
  {
    keyword: "step",
    category: "Agent",
    description: "Define a workflow step.",
    syntax: "step: Name | owner: agent",
  },
  {
    keyword: "gate",
    category: "Agent",
    description: "Define an approval gate.",
    syntax: "gate: Label | approver: role",
  },
  {
    keyword: "trigger",
    category: "Agent",
    description: "Define an event trigger.",
    syntax: "trigger: Event | on: condition",
  },
  {
    keyword: "emit",
    category: "Agent",
    description: "Emit an event or status.",
    syntax: "emit: event | data: payload",
  },
  {
    keyword: "decision",
    category: "Agent",
    description: "Define a decision point.",
    syntax: "decision: Question | yes: A | no: B",
  },
  {
    keyword: "task",
    category: "Agent",
    description: "Define a task item.",
    syntax: "task: Description | owner: assignee",
  },
  {
    keyword: "done",
    category: "Agent",
    description: "Mark a task or step as complete.",
    syntax: "done: Description",
  },
  {
    keyword: "error",
    category: "Agent",
    description: "Handle an error condition.",
    syntax: "error: Message | retry: 3",
  },
  {
    keyword: "audit",
    category: "Agent",
    description: "Log an audit entry.",
    syntax: "audit: Action",
  },

  // Layout
  {
    keyword: "page",
    category: "Layout",
    description: "Set page dimensions and margins.",
    syntax: "page: A4 | margin: 1in",
  },
  {
    keyword: "font",
    category: "Layout",
    description: "Set font properties.",
    syntax: "font: Inter | size: 12pt",
  },
  {
    keyword: "header",
    category: "Layout",
    description: "Set the page header.",
    syntax: "header: Text",
  },
  {
    keyword: "footer",
    category: "Layout",
    description: "Set the page footer.",
    syntax: "footer: Text",
  },
  {
    keyword: "watermark",
    category: "Layout",
    description: "Add a watermark.",
    syntax: "watermark: DRAFT",
  },
  {
    keyword: "signline",
    category: "Layout",
    description: "Add a signature line.",
    syntax: "signline: Name | role: Title",
  },
];

const categoryBadge: Record<string, string> = {
  Trust: "🔒",
  Identity: "📄",
  Structure: "📐",
  Content: "📝",
  Data: "📊",
  Agent: "🤖",
  Layout: "🖨️",
};

export function registerHoverProvider(monaco: typeof Monaco) {
  monaco.languages.registerHoverProvider("intenttext", {
    provideHover(model, position) {
      const line = model.getLineContent(position.lineNumber);
      const kwMatch = line.match(/^(\w[\w-]*):/);
      if (!kwMatch) return null;

      const kw = kwMatch[1];
      const info = HOVER_DB.find((h) => h.keyword === kw);
      if (!info) return null;

      // Check if the cursor is on the keyword
      if (position.column > kw.length + 1) return null;

      const badge = categoryBadge[info.category] ?? "";

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: 1,
          endColumn: kw.length + 2,
        },
        contents: [
          {
            value: `**${info.keyword}:** ${badge} ${info.category}`,
          },
          {
            value: info.description,
          },
          {
            value: `\`${info.syntax}\``,
          },
          {
            value: `[→ Full reference](https://itdocs.vercel.app/docs/keywords/${info.keyword})`,
          },
        ],
      };
    },
  });
}
