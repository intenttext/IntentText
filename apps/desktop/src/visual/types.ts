// Shared types for the visual editor

export interface VisualBlock {
  id: string;
  type: string; // canonical keyword from core
  content: string; // main text content
  properties: Record<string, string>; // pipe properties
  originalLine?: string; // raw line for round-trip fidelity
}

export type EditorMode = "source" | "visual";

// Category metadata for UI grouping
export interface CategoryInfo {
  label: string;
  icon: string;
  color: string;
}

export const CATEGORY_META: Record<string, CategoryInfo> = {
  identity: { label: "Identity", icon: "ID", color: "#3b82f6" },
  content: { label: "Content", icon: "Tx", color: "#6b7280" },
  structure: { label: "Structure", icon: "##", color: "#22c55e" },
  data: { label: "Data", icon: "Dt", color: "#a855f7" },
  agent: { label: "Agent", icon: "Ag", color: "#f97316" },
  trust: { label: "Trust", icon: "Tr", color: "#eab308" },
  layout: { label: "Layout", icon: "Pg", color: "#64748b" },
};

// Keywords that are read-only in visual mode
export const READ_ONLY_KEYWORDS = new Set([
  "freeze",
  "revision",
  "history",
  "track",
]);

// Keywords that support inline content editing
export const INLINE_EDITABLE_KEYWORDS = new Set([
  "text",
  "title",
  "summary",
  "section",
  "sub",
  "quote",
  "tip",
  "warning",
  "info",
  "success",
  "danger",
  "code",
  "def",
  "byline",
  "epigraph",
  "caption",
  "footnote",
  "dedication",
]);
