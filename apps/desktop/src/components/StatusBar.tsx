// StatusBar — workspace, document stats, trust lifecycle, save state.

import { useMemo } from "react";
import { parseIntentText } from "@dotit/core";
import { extractTrustState } from "@dotit/editor";
import type { OpenDocument } from "../hooks/useOpenDocument";
import type { Workspace } from "../hooks/useWorkspace";

export function StatusBar(props: {
  workspace: Workspace | null;
  doc: OpenDocument | null;
  onChooseWorkspace: () => void;
}) {
  const { workspace, doc, onChooseWorkspace } = props;

  const stats = useMemo(() => {
    if (!doc) return null;
    const words = doc.content.split(/\s+/).filter(Boolean).length;
    try {
      const parsed = parseIntentText(doc.content);
      const trust = extractTrustState(parsed);
      return {
        blocks: parsed.blocks.length,
        words,
        issues: parsed.diagnostics?.length ?? 0,
        lifecycle: trust.lifecycle,
      };
    } catch {
      return { blocks: 0, words, issues: 1, lifecycle: "draft" as const };
    }
  }, [doc]);

  return (
    <footer className="statusbar">
      <button
        className="status-item clickable"
        title={workspace?.path ?? "Choose a workspace folder"}
        onClick={onChooseWorkspace}
      >
        {workspace ? workspace.name : "No workspace"}
        {workspace ? ` · ${workspace.itFiles.length} docs` : ""}
      </button>

      <span className="status-spacer" />

      {stats && (
        <>
          {stats.issues > 0 && (
            <span className="status-item warn">
              {stats.issues} issue{stats.issues === 1 ? "" : "s"}
            </span>
          )}
          <span className="status-item">{stats.blocks} blocks</span>
          <span className="status-item">{stats.words} words</span>
          <span className={`status-item lifecycle-${stats.lifecycle}`}>
            {stats.lifecycle}
          </span>
        </>
      )}

      {doc && (
        <span className={`status-item ${doc.dirty ? "warn" : "ok"}`}>
          {doc.dirty
            ? "Unsaved changes"
            : doc.savedAt
              ? `Saved ${new Date(doc.savedAt).toLocaleTimeString()}`
              : doc.path
                ? "Saved"
                : "Not saved to disk"}
        </span>
      )}
    </footer>
  );
}
