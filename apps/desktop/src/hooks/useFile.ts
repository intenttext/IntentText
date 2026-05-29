import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { WorkspaceState } from "./useWorkspace";
import { addRecentFile } from "./useWorkspace";

export function useFile(
  workspace: WorkspaceState,
  openFileByPath: (path: string) => Promise<void>,
) {
  const { content, setContent, filename, setFilename, isUnsaved, markSaved } =
    workspace;
  const activeFilePath = (workspace as WorkspaceState).activeFilePath;

  const openFile = useCallback(async () => {
    // Use Tauri dialog to pick a file, or delegate to workspace openFileByPath
    const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Dotit", extensions: ["it"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected;
    await openFileByPath(path);
  }, [openFileByPath]);

  const saveFile = useCallback(async () => {
    if (activeFilePath) {
      // Save in place
      try {
        await invoke("write_file", { path: activeFilePath, content });
        markSaved();
        return;
      } catch (err) {
        console.error("Failed to save:", err);
      }
    }

    // Save as — pick location
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "Dotit", extensions: ["it"] }],
    });
    if (!path) return;

    try {
      await invoke("write_file", { path, content });
      const name = path.split("/").pop() ?? path.split("\\").pop() ?? path;
      setFilename(name);
      markSaved();
      addRecentFile(path);
    } catch (err) {
      console.error("Failed to save as:", err);
    }
  }, [activeFilePath, content, filename, setFilename, markSaved]);

  const newFile = useCallback(
    (welcome: string) => {
      if (isUnsaved && !confirm("You have unsaved changes. Continue?")) return;
      setContent(welcome);
      setFilename("untitled.it");
      markSaved();
    },
    [isUnsaved, setContent, setFilename, markSaved],
  );

  return { openFile, saveFile, newFile };
}
