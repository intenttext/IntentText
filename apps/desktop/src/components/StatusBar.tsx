// StatusBar — workspace, document stats, trust lifecycle, save state.

import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { parseIntentText } from "@dotit/core";
import { extractTrustState } from "@dotit/editor";
import { isTauri } from "../lib/backend";
import type { OpenDocument } from "../hooks/useOpenDocument";

// Count PROSE words — the content of body lines only, skipping keywords, pipe
// properties, comments, and structural/trust lines (so it matches what a reader
// sees, not the source markup).
const SKIP_LINE =
  /^(meta|page|header|footer|watermark|style|toc|break|divider|sign|freeze|certify|approve|track|history|revision|cite|input):/i;
function proseWordCount(source: string): number {
  let words = 0;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || SKIP_LINE.test(line)) continue;
    let content = line;
    if (/^[\p{L}\p{N}_-]+:/u.test(line)) content = line.slice(line.indexOf(":") + 1);
    const pipe = content.indexOf(" | ");
    if (pipe >= 0) content = content.slice(0, pipe);
    content = content.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
    if (content) words += (content.match(/\S+/g) || []).length;
  }
  return words;
}

export function StatusBar(props: {
  scopeLabel: string;
  docCount: number;
  doc: OpenDocument | null;
  mode: "view" | "edit";
  onAddFolder: () => void;
}) {
  const { scopeLabel, docCount, doc, mode, onAddFolder } = props;

  // App version — always visible so the user knows which build they're on.
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri) return;
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    if (!doc) return null;
    const words = proseWordCount(doc.content);
    const readMin = words > 0 ? Math.max(1, Math.round(words / 200)) : 0;
    try {
      const parsed = parseIntentText(doc.content);
      const trust = extractTrustState(parsed);
      return {
        blocks: parsed.blocks.length,
        words,
        readMin,
        issues: parsed.diagnostics?.length ?? 0,
        lifecycle: trust.lifecycle,
      };
    } catch {
      return { blocks: 0, words, readMin, issues: 1, lifecycle: "draft" as const };
    }
  }, [doc]);

  return (
    <footer className="statusbar">
      <button
        className="status-item clickable"
        title="Add a folder to your library"
        onClick={onAddFolder}
      >
        {scopeLabel} · {docCount} docs
      </button>

      <span className="status-spacer" />

      {stats && (
        <>
          <span className="status-item">{mode === "view" ? "Viewing" : "Editing"}</span>
          {stats.issues > 0 && (
            <span className="status-item warn">
              {stats.issues} issue{stats.issues === 1 ? "" : "s"}
            </span>
          )}
          <span className="status-item">{stats.blocks} blocks</span>
          <span className="status-item">
            {stats.words.toLocaleString()} words
            {stats.readMin > 0 ? ` · ~${stats.readMin} min read` : ""}
          </span>
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

      {version && (
        <span className="status-item muted" title="App version">
          v{version}
        </span>
      )}
    </footer>
  );
}
