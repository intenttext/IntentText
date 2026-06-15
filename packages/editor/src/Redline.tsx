// Redline — review tracked changes + comments on an IntentText document.
//
// It renders the document through core's renderPrint (so insertions/deletions show
// as the green-underline / red-strikethrough they print as, and comment anchors are
// highlighted) and pairs it with a REVIEW PANEL: every pending change is listed with
// Accept / Reject buttons, plus Accept-all / Reject-all, and the comment threads.
//
// Accepting an insertion keeps it as plain text; accepting a deletion removes it
// (reject is the inverse). Each action rewrites the `.it` source via core's
// acceptChanges / rejectChanges and reports it through onChange. A document with no
// pending changes is final — and only then sealable (see core template.ts).

import { useCallback, useMemo } from "react";
import {
  parseIntentText,
  renderPrint,
  extractChanges,
  extractComments,
  acceptChanges,
  rejectChanges,
  type TrackedChange,
  type Comment,
} from "@dotit/core";

export interface RedlineProps {
  /** The `.it` source. */
  value: string;
  /** Theme name. */
  theme?: string;
  /** Called with the rewritten source after an accept/reject. */
  onChange?: (source: string) => void;
  /** Show the document + changes but disable accept/reject. */
  readOnly?: boolean;
}

interface Extracted {
  styles: string;
  body: string;
  bodyClass: string;
}

function extractPrint(source: string, theme: string): Extracted {
  let html: string;
  try {
    html = renderPrint(parseIntentText(source), { theme });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      styles: "",
      body: `<p style="color:#b91c1c">Could not render: ${msg}</p>`,
      bodyClass: "",
    };
  }
  const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n")
    .replace(/body\.it-print/g, ".redline-page");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const bodyClass = (html.match(/<body[^>]*class="([^"]*)"/i)?.[1] ?? "").trim();
  return { styles, body, bodyClass };
}

function changeKey(c: TrackedChange, i: number): string {
  return c.id || `${c.type}:${i}:${c.text}`;
}

export function Redline({
  value,
  theme = "corporate",
  onChange,
  readOnly = false,
}: RedlineProps) {
  const changes = useMemo(() => extractChanges(value), [value]);
  const comments = useMemo(() => extractComments(value), [value]);
  const { styles, body, bodyClass } = useMemo(
    () => extractPrint(value, theme),
    [value, theme],
  );

  // Per-change accept/reject. A change with an id is targeted precisely; an
  // id-less change can only be resolved in bulk (accept/reject all of its type).
  const resolve = useCallback(
    (change: TrackedChange, accept: boolean) => {
      if (!change.id) return;
      const next = accept
        ? acceptChanges(value, [change.id])
        : rejectChanges(value, [change.id]);
      onChange?.(next);
    },
    [value, onChange],
  );

  const acceptAll = useCallback(
    () => onChange?.(acceptChanges(value)),
    [value, onChange],
  );
  const rejectAll = useCallback(
    () => onChange?.(rejectChanges(value)),
    [value, onChange],
  );

  const pending = changes.length;

  return (
    <div className="redline">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="redline-scroll">
        <div className={`redline-page ${bodyClass}`}>
          <div dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      </div>
      <aside className="redline-panel">
        <div className="redline-panel-head">
          <span className="redline-panel-title">
            {pending === 0
              ? "No pending changes"
              : `${pending} change${pending === 1 ? "" : "s"}`}
          </span>
          {!readOnly && pending > 0 && (
            <span className="redline-panel-actions">
              <button className="redline-btn" onClick={rejectAll}>
                Reject all
              </button>
              <button className="redline-btn primary" onClick={acceptAll}>
                Accept all
              </button>
            </span>
          )}
        </div>

        {pending > 0 && (
          <ul className="redline-list">
            {changes.map((c, i) => (
              <li
                key={changeKey(c, i)}
                className={`redline-item redline-item-${c.type}`}
              >
                <span className="redline-item-kind">
                  {c.type === "ins" ? "Insert" : "Delete"}
                </span>
                <span className="redline-item-text">{c.text}</span>
                {c.by && <span className="redline-item-by">{c.by}</span>}
                {!readOnly && c.id && (
                  <span className="redline-item-actions">
                    <button
                      className="redline-mini reject"
                      title="Reject"
                      onClick={() => resolve(c, false)}
                    >
                      ✕
                    </button>
                    <button
                      className="redline-mini accept"
                      title="Accept"
                      onClick={() => resolve(c, true)}
                    >
                      ✓
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {comments.length > 0 && (
          <div className="redline-comments">
            <div className="redline-comments-head">
              {comments.length} comment{comments.length === 1 ? "" : "s"}
            </div>
            <ul className="redline-comment-list">
              {comments.map((cm: Comment, i) => (
                <li
                  key={cm.id || i}
                  className={`redline-comment ${cm.resolved ? "resolved" : ""}`}
                >
                  <div className="redline-comment-body">{cm.body}</div>
                  <div className="redline-comment-meta">
                    {cm.by && <span>{cm.by}</span>}
                    {cm.at && <span>{cm.at}</span>}
                    {cm.resolved && <span className="resolved-tag">resolved</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
