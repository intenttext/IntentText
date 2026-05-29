import * as vscode from "vscode";

const KEYWORD_DOCS: Record<
  string,
  { description: string; properties: string[] }
> = {
  title: {
    description: "Document title — rendered as the main heading.",
    properties: [],
  },
  summary: {
    description: "Brief document summary or abstract.",
    properties: [],
  },
  section: {
    description: "Major section heading — creates structure and enables TOC.",
    properties: [],
  },
  sub: {
    description: "Subsection heading — nested under the current section.",
    properties: [],
  },
  note: {
    description: "Informational callout (alias for text).",
    properties: [],
  },
  text: {
    description:
      "Text content block — the canonical type for callouts and body text.",
    properties: [],
  },
  info: {
    description: "Info-level callout box.",
    properties: [],
  },
  warning: {
    description: "Warning callout — highlights important cautions.",
    properties: [],
  },
  danger: {
    description: "Danger callout — critical or destructive warning.",
    properties: [],
  },
  tip: {
    description: "Tip callout — helpful suggestion or best practice.",
    properties: [],
  },
  success: {
    description: "Success callout — positive outcome or confirmation.",
    properties: [],
  },
  quote: {
    description: "Block quote — attributed text from a source.",
    properties: [],
  },
  cite: {
    description: "Citation — reference a source with attribution.",
    properties: [],
  },
  image: {
    description: "Embed an image in the document.",
    properties: ["src", "alt", "caption", "width"],
  },
  link: {
    description: "External reference link.",
    properties: ["href", "title"],
  },
  ref: {
    description:
      "Cross-document reference — records a structural relationship between this document and another by file path or URL.",
    properties: ["file", "url", "rel", "section", "at"],
  },
  embed: {
    description: "Embed external content (iframe, video, audio).",
    properties: ["src", "type"],
  },
  code: {
    description:
      "Code block — wrap value in triple backticks. Use `lang:` property for syntax highlighting.",
    properties: ["lang"],
  },
  headers: {
    description: "Define table column headers (alias for columns).",
    properties: [],
  },
  columns: {
    description: "Define table column headers (pipe-separated values).",
    properties: [],
  },
  row: {
    description: "Table data row (pipe-separated values).",
    properties: [],
  },
  task: {
    description: "An action item for a human to complete.",
    properties: ["owner", "due", "priority", "status"],
  },
  done: {
    description: "A completed task — its own canonical block type.",
    properties: ["owner", "due"],
  },
  ask: {
    description: "A question directed at a person or team.",
    properties: ["to", "priority"],
  },
  step: {
    description: "Execute a tool or action in a workflow.",
    properties: [
      "tool",
      "input",
      "output",
      "depends",
      "id",
      "status",
      "timeout",
    ],
  },
  decision: {
    description:
      "Conditional branch — evaluate a condition and route to different steps.",
    properties: ["if", "then", "else"],
  },
  trigger: {
    description: "Define an event trigger that starts a workflow step.",
    properties: ["event", "condition"],
  },
  loop: {
    description: "Iterate over a collection of items.",
    properties: ["over", "as", "max"],
  },
  checkpoint: {
    description: "Save workflow state for recovery.",
    properties: ["save"],
  },
  audit: {
    description: "Log an audit trail entry.",
    properties: [],
  },
  error: {
    description: "Declare an error handling path.",
    properties: [],
  },
  progress: {
    description: "Report progress of a long-running step.",
    properties: [],
  },
  context: {
    description: "Set key-value context data for the workflow.",
    properties: ["key", "value"],
  },
  result: {
    description: "Capture the final result of a workflow.",
    properties: ["depends"],
  },
  handoff: {
    description: "Transfer execution from one agent to another.",
    properties: ["from", "to"],
  },
  wait: {
    description: "Pause execution until a condition is met.",
    properties: ["for", "timeout"],
  },
  parallel: {
    description: "Execute multiple steps concurrently and wait for completion.",
    properties: ["steps", "join"],
  },
  retry: {
    description: "Retry a failed step with configurable backoff.",
    properties: ["max", "delay", "backoff"],
  },
  gate: {
    description: "Pause workflow for human approval before continuing.",
    properties: ["approver", "timeout", "fallback"],
  },
  call: {
    description: "Invoke a sub-workflow or external function.",
    properties: ["input", "output"],
  },
  emit: {
    description:
      "Emit an event or status update (deprecated alias for signal).",
    properties: [],
  },
  signal: {
    description: "Emit an event or status update in a workflow.",
    properties: ["event"],
  },
  policy: {
    description:
      "A standing behavioural rule for agents — what to always, never, or conditionally do.",
    properties: [
      "if",
      "always",
      "never",
      "action",
      "requires",
      "notify",
      "priority",
      "id",
      "scope",
      "after",
    ],
  },
  agent: {
    description: "Declare the AI agent executing this workflow.",
    properties: [],
  },
  model: {
    description: "Specify the AI model used by the agent.",
    properties: [],
  },
  font: {
    description: "Document typography settings.",
    properties: ["family", "size", "leading", "weight", "heading", "mono"],
  },
  page: {
    description: "Page layout settings for print output.",
    properties: [
      "size",
      "margins",
      "header",
      "footer",
      "columns",
      "numbering",
      "orientation",
    ],
  },
  byline: {
    description: "Author attribution for articles, reports, or books.",
    properties: ["date", "publication", "role"],
  },
  epigraph: {
    description: "Opening quotation or motto before the document body.",
    properties: [],
  },
  caption: {
    description: "Caption for images, tables, or figures.",
    properties: [],
  },
  footnote: {
    description: "A reference note. Use [^N] inline to reference it.",
    properties: ["text"],
  },
  toc: {
    description:
      "Auto-generated table of contents from section and sub headings.",
    properties: ["depth", "title"],
  },
  dedication: {
    description: "Book/report dedication page.",
    properties: [],
  },
  divider: {
    description: "Horizontal rule divider (written as `---`).",
    properties: [],
  },
  track: {
    description:
      "Activates history tracking for this document. Every save records what changed, who changed it, and when.",
    properties: ["version", "by"],
  },
  sign: {
    description:
      "Cryptographic signature — binds a named person to the exact document content at this moment. The hash: property is computed from document content and will invalidate if content changes.",
    properties: ["role", "at", "hash"],
  },
  approve: {
    description:
      "Workflow approval — records that a named person reviewed and approved this document at a specific time. Different from sign: — this is process approval, not legal binding.",
    properties: ["by", "role", "at", "ref"],
  },
  freeze: {
    description:
      "Seals the document as a final immutable record. Added by `intenttext seal` command. Run `intenttext verify` to check document integrity.",
    properties: ["at", "hash", "status"],
  },
  revision: {
    description:
      "System-generated change record in the history section. Shows what changed, who changed it, and when.",
    properties: [
      "version",
      "at",
      "by",
      "change",
      "id",
      "block",
      "section",
      "was",
      "now",
    ],
  },
  def: {
    description:
      "Term definition — machine-readable glossary entry. Groups into glossary when multiple defs appear in a section.",
    properties: ["meaning", "abbr", "context", "see"],
  },
  metric: {
    description:
      "Measurable value with optional target and trend. Renders as a metric card with color-coded comparison.",
    properties: ["value", "unit", "target", "trend", "period", "source"],
  },
  amendment: {
    description:
      "Formal change to a frozen document. Appears after freeze: block — preserves the original seal while recording what changed.",
    properties: ["section", "was", "now", "ref", "by", "at"],
  },
  figure: {
    description:
      "Numbered, captioned, referenceable visual. Different from image: — a figure floats in print, carries a number, and has a caption.",
    properties: ["src", "caption", "alt", "width", "align"],
  },
  signline: {
    description:
      "Physical signature placeholder for print output. Renders a line for handwritten signatures with name, role, and optional date.",
    properties: ["label", "name", "role", "date"],
  },
  contact: {
    description:
      "Structured contact information. Renders as a contact card with clickable email and phone links.",
    properties: ["role", "org", "email", "phone", "url"],
  },
  deadline: {
    description:
      "Temporal commitment with consequence. Renders with proximity color coding — red when < 7 days, amber < 30 days.",
    properties: ["date", "consequence", "owner", "status"],
  },
  input: {
    description: "Form input field — collects data from the user.",
    properties: ["type", "required", "placeholder", "default"],
  },
  output: {
    description: "Output variable or result data from a step.",
    properties: ["format"],
  },
  memory: {
    description: "Store or retrieve key-value data for agent memory.",
    properties: ["key", "value"],
  },
  prompt: {
    description: "Prompt text or instruction for an AI agent.",
    properties: [],
  },
  tool: {
    description: "Declare a tool available to an agent.",
    properties: ["input", "output"],
  },
  assert: {
    description: "Assertion — verify an expected condition in a workflow.",
    properties: ["expect", "actual"],
  },
  secret: {
    description: "Secret or credential reference — never rendered in output.",
    properties: ["env"],
  },
  history: {
    description: "Document change history section boundary.",
    properties: [],
  },
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

      // Only show hover when cursor is on the keyword portion
      if (position.character > keywordMatch[0].length) return null;

      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**\`${keyword}:\`** — ${docs.description}\n\n`);
      if (docs.properties.length > 0) {
        md.appendMarkdown(
          `**Properties:** ${docs.properties.map((p) => `\`${p}:\``).join(", ")}`,
        );
      }
      md.appendMarkdown(
        `\n\n[IntentText Docs](https://itdocs.vercel.app/docs/reference)`,
      );

      return new vscode.Hover(md);
    },
  };
}
