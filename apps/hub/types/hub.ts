import type { IntentDocument } from "@intenttext/core";

// ── Domain & Status types ──

export type TemplateDomain =
  | "business"
  | "editorial"
  | "book"
  | "personal"
  | "agent"
  | "organization"
  | "developer"
  | "other";

export type PublishStatus =
  | "draft"
  | "community"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "rejected";

// Legacy statuses kept for backwards compat with existing data
export type LegacyStatus = "pending" | "approved" | "rejected";

// ── User model ──

export interface HubUser {
  _id?: string;
  id: string;
  github_id: number;
  username: string;
  name: string;
  avatar_url: string;
  role: "user" | "reviewer" | "admin";
  joined_at: Date;
  published_templates: number;
  published_themes: number;
}

// ── Template model ──

export interface HubTemplate {
  _id?: string;
  slug: string;
  name: string;
  description: string;
  category: "agent" | "workflow" | "document";
  domain?: TemplateDomain;
  tags: string[];
  author: string;
  owner_id?: string;
  source: string;
  example_data?: string;
  document: IntentDocument;
  recommended_theme?: string;
  core_version?: string;
  status: PublishStatus | LegacyStatus;
  tier?: "community" | "curated";
  autoApproved?: boolean;
  downloads: number;
  stars?: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewed_at?: Date;
  review_feedback?: string;
  rejectionReason?: string;
  trust?: {
    tracked: boolean;
    frozen: boolean;
    frozenAt?: string;
    signers?: string[];
  };
}

// ── Theme model ──

export interface HubTheme {
  _id?: string;
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  theme_json: string;
  web_css?: string;
  print_css?: string;
  preview_image_url?: string;
  status: PublishStatus;
  tier: "community" | "curated";
  installs: number;
  stars: number;
  created_at: Date;
  updated_at: Date;
}

// ── Session type ──

export interface SessionData {
  user_id: string;
  username: string;
  avatar_url: string;
  role: "user" | "reviewer" | "admin";
}
