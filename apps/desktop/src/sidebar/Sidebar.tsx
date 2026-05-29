import { ExplorerPanel } from "./ExplorerPanel";
import type { ItFileEntry } from "../hooks/useWorkspace";

interface SidebarProps {
  visible: boolean;
  files: ItFileEntry[];
  activeFilePath: string | null;
  folderPath: string | null;
  folderName: string | null;
  isFileUnsaved: boolean;
  onFileOpen: (path: string) => void;
  onRefresh: () => void;
}

export function Sidebar({
  visible,
  files,
  activeFilePath,
  folderPath,
  folderName,
  isFileUnsaved,
  onFileOpen,
  onRefresh,
}: SidebarProps) {
  if (!visible) return null;

  return (
    <div className="sidebar-container sidebar-container-simple">
      <div className="sidebar-panel">
        <div className="sidebar-panel-header">FILES</div>
        <ExplorerPanel
          files={files}
          activeFilePath={activeFilePath}
          folderPath={folderPath}
          folderName={folderName}
          isFileUnsaved={isFileUnsaved}
          onFileOpen={onFileOpen}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
