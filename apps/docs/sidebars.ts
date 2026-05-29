import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  guideSidebar: [
    { type: "doc", id: "guide/index", label: "Overview" },
    { type: "doc", id: "guide/quick-start", label: "Quick Start" },
    { type: "doc", id: "guide/concepts", label: "Core Concepts" },
    { type: "doc", id: "guide/first-document", label: "Your First Document" },
    { type: "doc", id: "guide/first-template", label: "Your First Template" },
    {
      type: "category",
      label: "By Audience",
      collapsed: false,
      items: [
        "guide/for-organizations",
        "guide/for-agents",
        "guide/for-writers",
      ],
    },
    { type: "doc", id: "guide/trust-and-signing", label: "Trust & Signing" },
  ],

  referenceSidebar: [
    { type: "doc", id: "reference/index", label: "Overview" },
    {
      type: "category",
      label: "Keywords",
      collapsed: false,
      items: [
        "reference/keywords/index",
        "reference/keywords/document-identity",
        "reference/keywords/content",
        "reference/keywords/structure",
        "reference/keywords/data",
        "reference/keywords/agent",
        "reference/keywords/trust",
        "reference/keywords/layout",
        "reference/keywords/aliases",
      ],
    },
    "reference/pipe-properties",
    "reference/style-properties",
    "reference/templates",
    "reference/query",
    "reference/index-file",
    "reference/cli",
  ],

  cookbookSidebar: [
    { type: "doc", id: "cookbook/index", label: "Overview" },
    {
      type: "category",
      label: "Documents",
      items: [
        "cookbook/documents/invoice",
        "cookbook/documents/contract",
        "cookbook/documents/report",
        "cookbook/documents/newsletter",
      ],
    },
    {
      type: "category",
      label: "Templates",
      items: [
        "cookbook/templates/building-templates",
        "cookbook/templates/dynamic-tables",
        "cookbook/templates/merge-data",
        "cookbook/templates/template-library",
      ],
    },
    {
      type: "category",
      label: "Trust",
      items: [
        "cookbook/trust/approval-workflow",
        "cookbook/trust/sealing-contracts",
        "cookbook/trust/amending-frozen-docs",
        "cookbook/trust/audit-trail",
      ],
    },
    {
      type: "category",
      label: "Agents",
      items: [
        "cookbook/agents/task-planning",
        "cookbook/agents/pipeline-definition",
        "cookbook/agents/agent-handoff",
        "cookbook/agents/mcp-integration",
      ],
    },
    {
      type: "category",
      label: "Organizations",
      items: [
        "cookbook/organizations/folder-structure",
        "cookbook/organizations/querying-documents",
        "cookbook/organizations/indexing-folders",
        "cookbook/organizations/multi-folder-query",
        "cookbook/organizations/contact-directory",
        "cookbook/organizations/deadline-tracking",
      ],
    },
    {
      type: "category",
      label: "Print & PDF",
      items: [
        "cookbook/print/print-ready-documents",
        "cookbook/print/watermarks",
        "cookbook/print/pdf-export",
      ],
    },
    {
      type: "category",
      label: "Data",
      items: [
        "cookbook/data/metrics-and-dashboards",
        "cookbook/data/definitions-and-glossaries",
        "cookbook/data/cross-document-refs",
        "cookbook/data/figures-and-captions",
      ],
    },
  ],

  ecosystemSidebar: [
    { type: "doc", id: "ecosystem/index", label: "Overview" },
    "ecosystem/hub",
    "ecosystem/themes",
    "ecosystem/editor",
    "ecosystem/cli",
    "ecosystem/mcp-server",
    "ecosystem/vscode-extension",
    "ecosystem/python",
    "ecosystem/core-api",
  ],
};

export default sidebars;
