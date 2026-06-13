// Trust lifecycle hook for the app shell. The pure trust-state extraction
// lives in @dotit/editor (extractTrustState) — this hook adds the app's
// source-mutating actions (track / approve / sign / seal / amend).

import { useMemo, useCallback, useRef } from "react";
import {
  parseIntentText,
  sealDocument,
  verifyDocument,
  isTemplate,
} from "@dotit/core";
import { extractTrustState } from "@dotit/editor";
import type { TrustState } from "@dotit/editor";

export { extractTrustState };
export type { TrustState };

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

  // A template (.it blueprint) is OUTSIDE the trust workflow — Sign/Seal are
  // refused (the hash would cover placeholder text). Merge it with data first.
  const isTemplateDoc = useMemo(() => isTemplate(content), [content]);

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
      // Refuse to seal a template — merge first. (Defensive: the UI also
      // disables the seal action, but never let the source-mutating path run.)
      if (isTemplate(contentRef.current)) {
        return {
          success: false,
          error: "Templates can't be sealed — merge first.",
        };
      }
      try {
        // Seal must NEVER add a signature — signing is the separate
        // addSignature() action. skipSign:true writes only the freeze: line, so
        // sealing after signing never duplicates the signer's sign: line.
        const result = sealDocument(contentRef.current, {
          signer,
          role: role || undefined,
          skipSign: true,
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
    isTemplate: isTemplateDoc,
    startTracking,
    addApproval,
    addSignature,
    seal,
    verify,
    addAmendment,
  };
}
