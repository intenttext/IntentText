// Trust state extraction — reads the document's trust blocks (track/approve/
// sign/freeze/amendment) into a structured lifecycle snapshot. Pure function
// over the parsed document; the TrustBanner and the sealed read-only behavior
// are driven from this.

import type { IntentDocument } from "@dotit/core";

export interface TrustState {
  lifecycle: "draft" | "tracked" | "approved" | "signed" | "sealed";
  isTracked: boolean;
  trackBlock: { id: string; by: string; at: string } | null;
  approvals: { by: string; role: string; at: string; note?: string }[];
  signatures: { by: string; role: string; at: string }[];
  isSealed: boolean;
  sealedBy: string | null;
  sealedAt: string | null;
  sealHash: string | null;
  amendments: {
    section: string;
    was: string;
    now: string;
    by: string;
    ref: string;
    at: string;
  }[];
}

function prop(
  block: { properties?: Record<string, string | number> } | null,
  key: string,
  fallback = "",
): string {
  const v = block?.properties?.[key];
  return v != null ? String(v) : fallback;
}

export function extractTrustState(doc: IntentDocument | null): TrustState {
  const base: TrustState = {
    lifecycle: "draft",
    isTracked: false,
    trackBlock: null,
    approvals: [],
    signatures: [],
    isSealed: false,
    sealedBy: null,
    sealedAt: null,
    sealHash: null,
    amendments: [],
  };

  if (!doc) return base;

  const blocks = doc.blocks;

  // Track
  const track = blocks.find((b) => b.type === "track");
  if (track) {
    base.isTracked = true;
    base.lifecycle = "tracked";
    base.trackBlock = {
      id: prop(track, "id", track.content ?? ""),
      by: prop(track, "by"),
      at: prop(track, "at"),
    };
  }

  // Approvals
  const approveBlocks = blocks.filter((b) => b.type === "approve");
  for (const a of approveBlocks) {
    base.approvals.push({
      by: prop(a, "by", a.content ?? ""),
      role: prop(a, "role"),
      at: prop(a, "at"),
      note: prop(a, "note") || undefined,
    });
  }
  if (base.approvals.length > 0) base.lifecycle = "approved";

  // Signatures
  const signBlocks = blocks.filter((b) => b.type === "sign");
  for (const s of signBlocks) {
    base.signatures.push({
      by: prop(s, "by", s.content ?? ""),
      role: prop(s, "role"),
      at: prop(s, "at"),
    });
  }
  if (base.signatures.length > 0) base.lifecycle = "signed";

  // Sealed
  const freeze = blocks.find((b) => b.type === "freeze");
  if (freeze) {
    base.isSealed = true;
    base.lifecycle = "sealed";
    // The sealer's identity lives on the sign: block added during sealing — the
    // freeze: block carries only at/hash/status. Fall back to any freeze content.
    const lastSig = base.signatures[base.signatures.length - 1];
    base.sealedBy = lastSig?.by || prop(freeze, "by", freeze.content ?? "");
    base.sealedAt = prop(freeze, "at") || lastSig?.at || "";
    base.sealHash = prop(freeze, "hash");
  }

  // Amendments
  const amendBlocks = blocks.filter((b) => b.type === "amendment");
  for (const am of amendBlocks) {
    base.amendments.push({
      section: prop(am, "section", am.content ?? ""),
      was: prop(am, "was"),
      now: prop(am, "now"),
      by: prop(am, "by"),
      ref: prop(am, "ref"),
      at: prop(am, "at"),
    });
  }

  return base;
}
