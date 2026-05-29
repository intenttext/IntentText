import { useMemo, useCallback, useRef } from "react";
import {
  parseIntentText,
  sealDocument,
  verifyDocument,
} from "@intenttext/core";
import type { IntentDocument } from "@intenttext/core";

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

  const signBlocks = blocks.filter((b) => b.type === "sign");
  for (const s of signBlocks) {
    base.signatures.push({
      by: prop(s, "by", s.content ?? ""),
      role: prop(s, "role"),
      at: prop(s, "at"),
    });
  }
  if (base.signatures.length > 0) base.lifecycle = "signed";

  const freeze = blocks.find((b) => b.type === "freeze");
  if (freeze) {
    base.isSealed = true;
    base.lifecycle = "sealed";
    base.sealedBy = prop(freeze, "by", freeze.content ?? "");
    base.sealedAt = prop(freeze, "at");
    base.sealHash = prop(freeze, "hash");
  }

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

export function useTrustState(
  content: string,
  setContent: (s: string) => void,
) {
  const doc = useMemo(() => {
    try {
      return parseIntentText(content);
    } catch {
      return null;
    }
  }, [content]);

  const trust = useMemo(() => extractTrustState(doc), [doc]);

  const contentRef = useRef(content);
  contentRef.current = content;

  const startTracking = useCallback(
    (docId?: string) => {
      const id = docId || `doc-${Date.now()}`;
      const now = new Date().toISOString().split("T")[0];
      const line = `track: ${id} | at: ${now}`;
      const src = contentRef.current;
      const lines = src.split("\n");
      let insertAt = 0;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(\w[\w-]*)\s*:/);
        if (
          m &&
          [
            "font",
            "page",
            "header",
            "footer",
            "watermark",
            "meta",
            "title",
            "summary",
            "byline",
            "toc",
          ].includes(m[1])
        ) {
          insertAt = i + 1;
        }
      }
      lines.splice(insertAt, 0, line);
      setContent(lines.join("\n"));
    },
    [setContent],
  );

  const addApproval = useCallback(
    (by: string, role: string, note?: string) => {
      const now = new Date().toISOString().split("T")[0];
      let line = `approve: ${by} | role: ${role} | at: ${now}`;
      if (note) line += ` | note: ${note}`;
      const src = contentRef.current;
      const lines = src.split("\n");
      let insertAt = lines.length;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(\w[\w-]*)\s*:/);
        if (m && (m[1] === "history" || m[1] === "freeze")) {
          insertAt = i;
          break;
        }
      }
      lines.splice(insertAt, 0, line);
      setContent(lines.join("\n"));
    },
    [setContent],
  );

  const addSignature = useCallback(
    (by: string, role: string) => {
      const now = new Date().toISOString().split("T")[0];
      const line = `sign: ${by} | role: ${role} | at: ${now}`;
      const src = contentRef.current;
      const lines = src.split("\n");
      let insertAt = lines.length;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(\w[\w-]*)\s*:/);
        if (m && (m[1] === "history" || m[1] === "freeze")) {
          insertAt = i;
          break;
        }
      }
      lines.splice(insertAt, 0, line);
      setContent(lines.join("\n"));
    },
    [setContent],
  );

  const seal = useCallback(
    (signer: string, role?: string) => {
      try {
        const result = sealDocument(contentRef.current, {
          signer,
          role: role || undefined,
        });
        if (result.success) {
          setContent(result.source);
          return { success: true, error: null };
        }
        return { success: false, error: "Seal failed" };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [setContent],
  );

  const verify = useCallback(() => {
    try {
      return verifyDocument(contentRef.current);
    } catch {
      return null;
    }
  }, []);

  const addAmendment = useCallback(
    (section: string, was: string, now: string, by: string, ref?: string) => {
      const timestamp = new Date().toISOString().split("T")[0];
      let line = `amendment: ${section} | was: ${was} | now: ${now} | by: ${by} | at: ${timestamp}`;
      if (ref) line += ` | ref: ${ref}`;
      setContent(contentRef.current.trimEnd() + "\n" + line + "\n");
    },
    [setContent],
  );

  return {
    trust,
    startTracking,
    addApproval,
    addSignature,
    seal,
    verify,
    addAmendment,
  };
}
