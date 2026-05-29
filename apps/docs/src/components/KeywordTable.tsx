import React, { useState, useMemo } from "react";
import Link from "@docusaurus/Link";

interface Keyword {
  name: string;
  category: string;
  since: string;
  description: string;
  properties: string;
  link: string;
}

const ALL_KEYWORDS: Keyword[] = [
  // ── Document Identity (7) ────────────────────────────────────────────────
  {
    name: "title",
    category: "Identity",
    since: "v1.0",
    description: "Document title — renders as H1",
    properties: "—",
    link: "/docs/reference/keywords/document-identity#title",
  },
  {
    name: "summary",
    category: "Identity",
    since: "v1.0",
    description: "Brief document description",
    properties: "—",
    link: "/docs/reference/keywords/document-identity#summary",
  },
  {
    name: "meta",
    category: "Identity",
    since: "v2.8.1",
    description: "Free-form document metadata key-value pairs",
    properties: "type, author, date, version, lang, license, domain, tags",
    link: "/docs/reference/keywords/document-identity#meta",
  },
  {
    name: "context",
    category: "Identity",
    since: "v2.0",
    description: "Agent execution context and scoped variables",
    properties: "agent, goal, constraints",
    link: "/docs/reference/keywords/document-identity#context",
  },
  {
    name: "track",
    category: "Identity",
    since: "v2.8",
    description: "Activate document history tracking",
    properties: "version, by",
    link: "/docs/reference/keywords/document-identity#track",
  },
  {
    name: "agent",
    category: "Identity",
    since: "v2.0",
    description: "Agent name/identifier — pre-section metadata",
    properties: "—",
    link: "/docs/reference/keywords/document-identity#agent",
  },
  {
    name: "model",
    category: "Identity",
    since: "v2.0",
    description: "Default AI model for this document",
    properties: "—",
    link: "/docs/reference/keywords/document-identity#model",
  },

  // ── Content (19) ─────────────────────────────────────────────────────────
  {
    name: "text",
    category: "Content",
    since: "v1.0",
    description: "General body text — the default block type",
    properties: "style properties",
    link: "/docs/reference/keywords/content#text",
  },
  {
    name: "quote",
    category: "Content",
    since: "v1.0",
    description: "Block quotation with optional attribution",
    properties: "—",
    link: "/docs/reference/keywords/content#quote",
  },
  {
    name: "cite",
    category: "Content",
    since: "v1.0",
    description: "Bibliographic citation with author, date, and URL",
    properties: "url, author, date",
    link: "/docs/reference/keywords/content#cite",
  },
  {
    name: "warning",
    category: "Content",
    since: "v1.0",
    description: "Warning or caution callout block",
    properties: "—",
    link: "/docs/reference/keywords/content#warning",
  },
  {
    name: "danger",
    category: "Content",
    since: "v1.0",
    description: "Danger callout — irreversible actions or data loss risk",
    properties: "—",
    link: "/docs/reference/keywords/content#danger",
  },
  {
    name: "tip",
    category: "Content",
    since: "v1.0",
    description: "Helpful tip or suggestion",
    properties: "—",
    link: "/docs/reference/keywords/content#tip",
  },
  {
    name: "info",
    category: "Content",
    since: "v1.0",
    description: "Informational callout block",
    properties: "—",
    link: "/docs/reference/keywords/content#info",
  },
  {
    name: "success",
    category: "Content",
    since: "v1.0",
    description: "Success or confirmation callout block",
    properties: "—",
    link: "/docs/reference/keywords/content#success",
  },
  {
    name: "code",
    category: "Content",
    since: "v1.0",
    description: "Code block with optional language",
    properties: "lang",
    link: "/docs/reference/keywords/content#code",
  },
  {
    name: "image",
    category: "Content",
    since: "v1.0",
    description: "Inline image — no caption, no number",
    properties: "src, alt, width",
    link: "/docs/reference/keywords/content#image",
  },
  {
    name: "link",
    category: "Content",
    since: "v1.0",
    description: "Hyperlink to an external resource",
    properties: "url, title",
    link: "/docs/reference/keywords/content#link",
  },
  {
    name: "def",
    category: "Content",
    since: "v2.11",
    description: "Term definition — inline or glossary entry",
    properties: "meaning, abbr",
    link: "/docs/reference/keywords/content#def",
  },
  {
    name: "figure",
    category: "Content",
    since: "v2.11",
    description: "Numbered, captioned figure",
    properties: "src, caption, num, width, align, alt",
    link: "/docs/reference/keywords/content#figure",
  },
  {
    name: "contact",
    category: "Content",
    since: "v2.11",
    description: "Person or organization contact information",
    properties: "role, email, phone, org, address, url, preferred",
    link: "/docs/reference/keywords/content#contact",
  },
  {
    name: "byline",
    category: "Content",
    since: "v2.5",
    description: "Author byline with date and publication",
    properties: "—",
    link: "/docs/reference/keywords/content#byline",
  },
  {
    name: "epigraph",
    category: "Content",
    since: "v2.5",
    description: "Introductory quotation at the start of a document",
    properties: "—",
    link: "/docs/reference/keywords/content#epigraph",
  },
  {
    name: "caption",
    category: "Content",
    since: "v2.5",
    description: "Figure or table caption",
    properties: "—",
    link: "/docs/reference/keywords/content#caption",
  },
  {
    name: "footnote",
    category: "Content",
    since: "v2.5",
    description: "Numbered footnote",
    properties: "—",
    link: "/docs/reference/keywords/content#footnote",
  },
  {
    name: "dedication",
    category: "Content",
    since: "v2.5",
    description: "Document dedication page",
    properties: "—",
    link: "/docs/reference/keywords/content#dedication",
  },

  // ── Structure (8) ────────────────────────────────────────────────────────
  {
    name: "section",
    category: "Structure",
    since: "v1.0",
    description: "Section heading — renders as H2",
    properties: "—",
    link: "/docs/reference/keywords/structure#section",
  },
  {
    name: "sub",
    category: "Structure",
    since: "v1.0",
    description: "Subsection heading — renders as H3",
    properties: "—",
    link: "/docs/reference/keywords/structure#sub",
  },
  {
    name: "break",
    category: "Structure",
    since: "v1.0",
    description: "Page break for print — invisible in web",
    properties: "before, keep",
    link: "/docs/reference/keywords/structure#break",
  },
  {
    name: "ref",
    category: "Structure",
    since: "v2.11",
    description: "Cross-document reference with typed relationship",
    properties: "file, url, rel, section, at",
    link: "/docs/reference/keywords/structure#ref",
  },
  {
    name: "deadline",
    category: "Structure",
    since: "v2.11",
    description: "Date-bound milestone or due date",
    properties: "date, consequence, authority, ref, owner, reminder",
    link: "/docs/reference/keywords/structure#deadline",
  },
  {
    name: "embed",
    category: "Structure",
    since: "v1.0",
    description: "Embed a referenced external resource",
    properties: "—",
    link: "/docs/reference/keywords/structure#embed",
  },
  {
    name: "toc",
    category: "Structure",
    since: "v2.5",
    description: "Auto-generated table of contents",
    properties: "—",
    link: "/docs/reference/keywords/structure#toc",
  },

  // ── Data (5) ─────────────────────────────────────────────────────────────
  {
    name: "columns",
    category: "Data",
    since: "v1.0",
    description:
      "Table column definitions — declares column names for row: blocks",
    properties: "—",
    link: "/docs/reference/keywords/data#columns",
  },
  {
    name: "row",
    category: "Data",
    since: "v1.0",
    description: "Table data row — pipe-separated cell values",
    properties: "—",
    link: "/docs/reference/keywords/data#row",
  },
  {
    name: "input",
    category: "Data",
    since: "v1.3",
    description: "Declared input parameter for templates and workflows",
    properties: "type, required, default",
    link: "/docs/reference/keywords/data#input",
  },
  {
    name: "output",
    category: "Data",
    since: "v1.3",
    description: "Declared output parameter for templates and workflows",
    properties: "type, format",
    link: "/docs/reference/keywords/data#output",
  },
  {
    name: "metric",
    category: "Data",
    since: "v2.11",
    description: "Quantitative measurement or KPI",
    properties: "value, unit, period, as-of, target, trend, owner, source",
    link: "/docs/reference/keywords/data#metric",
  },

  // ── Agent (27) ───────────────────────────────────────────────────────────
  {
    name: "step",
    category: "Agent",
    since: "v2.0",
    description: "Workflow step — the basic unit of agent work",
    properties: "id, tool, input, output, depends, timeout, retry",
    link: "/docs/reference/keywords/agent#step",
  },
  {
    name: "gate",
    category: "Agent",
    since: "v2.2",
    description: "Conditional checkpoint — blocks until condition is met",
    properties: "condition, timeout, fallback",
    link: "/docs/reference/keywords/agent#gate",
  },
  {
    name: "trigger",
    category: "Agent",
    since: "v2.0",
    description: "Event-based workflow activation",
    properties: "event, source, filter",
    link: "/docs/reference/keywords/agent#trigger",
  },
  {
    name: "signal",
    category: "Agent",
    since: "v2.2",
    description: "Emit a named workflow signal or event",
    properties: "event, data",
    link: "/docs/reference/keywords/agent#signal",
  },
  {
    name: "decision",
    category: "Agent",
    since: "v2.0",
    description: "Conditional branching",
    properties: "if, then, else",
    link: "/docs/reference/keywords/agent#decision",
  },
  {
    name: "memory",
    category: "Agent",
    since: "v2.0",
    description: "Agent memory or persistent state declaration",
    properties: "scope, ttl",
    link: "/docs/reference/keywords/agent#memory",
  },
  {
    name: "prompt",
    category: "Agent",
    since: "v2.0",
    description: "LLM prompt template",
    properties: "model, temperature",
    link: "/docs/reference/keywords/agent#prompt",
  },
  {
    name: "tool",
    category: "Agent",
    since: "v2.0",
    description: "External tool or API declaration",
    properties: "api, method, auth",
    link: "/docs/reference/keywords/agent#tool",
  },
  {
    name: "audit",
    category: "Agent",
    since: "v2.0",
    description: "Audit log entry",
    properties: "by, at, action",
    link: "/docs/reference/keywords/agent#audit",
  },
  {
    name: "done",
    category: "Agent",
    since: "v2.0",
    description: "Completed task item — the resolved state of a task: block",
    properties: "status, output",
    link: "/docs/reference/keywords/agent#done",
  },
  {
    name: "error",
    category: "Agent",
    since: "v2.0",
    description: "Error record with severity and retry metadata",
    properties: "code, severity, retry",
    link: "/docs/reference/keywords/agent#error",
  },
  {
    name: "result",
    category: "Agent",
    since: "v2.1",
    description: "Terminal workflow result — final output block",
    properties: "—",
    link: "/docs/reference/keywords/agent#result",
  },
  {
    name: "handoff",
    category: "Agent",
    since: "v2.1",
    description: "Transfer control to another agent",
    properties: "—",
    link: "/docs/reference/keywords/agent#handoff",
  },
  {
    name: "wait",
    category: "Agent",
    since: "v2.1",
    description: "Pause execution until an event or timeout",
    properties: "—",
    link: "/docs/reference/keywords/agent#wait",
  },
  {
    name: "parallel",
    category: "Agent",
    since: "v2.1",
    description: "Run multiple steps concurrently",
    properties: "—",
    link: "/docs/reference/keywords/agent#parallel",
  },
  {
    name: "retry",
    category: "Agent",
    since: "v2.1",
    description: "Retry a failed step with backoff",
    properties: "—",
    link: "/docs/reference/keywords/agent#retry",
  },
  {
    name: "call",
    category: "Agent",
    since: "v2.2",
    description: "Invoke a sub-workflow by file reference",
    properties: "—",
    link: "/docs/reference/keywords/agent#call",
  },
  {
    name: "loop",
    category: "Agent",
    since: "v2.0",
    description: "Iterate over a collection",
    properties: "—",
    link: "/docs/reference/keywords/agent#loop",
  },
  {
    name: "checkpoint",
    category: "Agent",
    since: "v2.0",
    description: "Named workflow checkpoint for resume and rollback",
    properties: "—",
    link: "/docs/reference/keywords/agent#checkpoint",
  },
  {
    name: "import",
    category: "Agent",
    since: "v2.0",
    description: "Import a workflow from a file",
    properties: "—",
    link: "/docs/reference/keywords/agent#import",
  },
  {
    name: "export",
    category: "Agent",
    since: "v2.0",
    description: "Export data or workflow output",
    properties: "—",
    link: "/docs/reference/keywords/agent#export",
  },
  {
    name: "progress",
    category: "Agent",
    since: "v2.0",
    description: "Progress indicator for long-running operations",
    properties: "—",
    link: "/docs/reference/keywords/agent#progress",
  },
  {
    name: "task",
    category: "Agent",
    since: "v1.0",
    description: "Actionable task item with owner and due date",
    properties: "—",
    link: "/docs/reference/keywords/agent#task",
  },
  {
    name: "ask",
    category: "Agent",
    since: "v1.0",
    description: "Question or open item requiring a response",
    properties: "—",
    link: "/docs/reference/keywords/agent#ask",
  },
  {
    name: "policy",
    category: "Agent",
    since: "v2.7",
    description: "Enforceable constraint or rule",
    properties: "scope, enforce",
    link: "/docs/reference/keywords/agent#policy",
  },
  {
    name: "assert",
    category: "Agent",
    since: "v2.13",
    description: "Testable assertion — condition that must be true",
    properties: "—",
    link: "/docs/reference/keywords/agent#assert",
  },
  {
    name: "secret",
    category: "Agent",
    since: "v2.13",
    description: "Secret or credential reference — never rendered",
    properties: "—",
    link: "/docs/reference/keywords/agent#secret",
  },

  // ── Trust (6) ────────────────────────────────────────────────────────────
  {
    name: "approve",
    category: "Trust",
    since: "v2.8",
    description: "Approval stamp with signatory and role",
    properties: "by, role, at, ref",
    link: "/docs/reference/keywords/trust#approve",
  },
  {
    name: "sign",
    category: "Trust",
    since: "v2.8",
    description: "Cryptographic digital signature",
    properties: "role, at, hash",
    link: "/docs/reference/keywords/trust#sign",
  },
  {
    name: "freeze",
    category: "Trust",
    since: "v2.8",
    description: "Seal document — prevents further edits",
    properties: "at, hash, status",
    link: "/docs/reference/keywords/trust#freeze",
  },
  {
    name: "revision",
    category: "Trust",
    since: "v2.8",
    description: "Auto-generated revision record in history section",
    properties: "version, at, by, change, id, block, section, was, now",
    link: "/docs/reference/keywords/trust#revision",
  },
  {
    name: "amendment",
    category: "Trust",
    since: "v2.11",
    description: "Formal change record for a frozen document",
    properties: "section, was, now, ref, by, at, approved-by, hash",
    link: "/docs/reference/keywords/trust#amendment",
  },
  {
    name: "history",
    category: "Trust",
    since: "v2.12",
    description: "History boundary — separates document from revision log",
    properties: "—",
    link: "/docs/reference/keywords/trust#history",
  },

  // ── Layout (7) ───────────────────────────────────────────────────────────
  {
    name: "page",
    category: "Layout",
    since: "v2.5",
    description: "Page size, margins, and orientation for print",
    properties: "size, margins, orientation, columns, numbering",
    link: "/docs/reference/keywords/layout#page",
  },
  {
    name: "font",
    category: "Layout",
    since: "v2.5",
    description: "Typography settings for print",
    properties: "family, size, leading, weight, heading, mono",
    link: "/docs/reference/keywords/layout#font",
  },
  {
    name: "header",
    category: "Layout",
    since: "v2.9",
    description: "Page header for print output",
    properties: "left, center, right, skip-first",
    link: "/docs/reference/keywords/layout#header",
  },
  {
    name: "footer",
    category: "Layout",
    since: "v2.9",
    description: "Page footer for print output",
    properties: "left, center, right, skip-first",
    link: "/docs/reference/keywords/layout#footer",
  },
  {
    name: "watermark",
    category: "Layout",
    since: "v2.9",
    description: "Background watermark for print output",
    properties: "color, angle, size",
    link: "/docs/reference/keywords/layout#watermark",
  },
  {
    name: "signline",
    category: "Layout",
    since: "v2.11",
    description: "Physical signature line for print",
    properties: "name, role, date-line, org, width, label",
    link: "/docs/reference/keywords/layout#signline",
  },
  {
    name: "divider",
    category: "Layout",
    since: "v2.12",
    description: "Visible horizontal rule — also written as ---",
    properties: "style",
    link: "/docs/reference/keywords/layout#divider",
  },
];

const CATEGORIES = [
  "All",
  "Identity",
  "Content",
  "Structure",
  "Data",
  "Agent",
  "Trust",
  "Layout",
];

export default function KeywordTable(): React.ReactElement {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortField, setSortField] = useState<"name" | "category" | "since">(
    "name",
  );
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let result = ALL_KEYWORDS;
    if (category !== "All") {
      result = result.filter((k) => k.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q) ||
          k.properties.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [search, category, sortField, sortAsc]);

  const handleSort = (field: "name" | "category" | "since") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const arrow = (field: string) =>
    sortField === field ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="keyword-table">
      <div className="keyword-table-filters">
        <input
          type="text"
          placeholder="Search keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span
          style={{
            alignSelf: "center",
            color: "var(--ifm-color-emphasis-600)",
            fontSize: "0.9rem",
          }}
        >
          {filtered.length} of {ALL_KEYWORDS.length} keywords
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort("name")}>Keyword{arrow("name")}</th>
            <th onClick={() => handleSort("category")}>
              Category{arrow("category")}
            </th>
            <th onClick={() => handleSort("since")}>Since{arrow("since")}</th>
            <th>Description</th>
            <th>Properties</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((k) => (
            <tr key={k.name}>
              <td>
                <Link to={k.link.split("#")[0]}>
                  <code>{k.name}:</code>
                </Link>
              </td>
              <td>
                <span
                  className={`keyword-badge keyword-badge--${k.category.toLowerCase()}`}
                >
                  {k.category}
                </span>
              </td>
              <td>{k.since}</td>
              <td>{k.description}</td>
              <td style={{ fontSize: "0.85rem" }}>{k.properties}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
