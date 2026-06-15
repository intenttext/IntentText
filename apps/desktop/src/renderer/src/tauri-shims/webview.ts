// Shim for @tauri-apps/api/webview — drag & drop. Electron exposes File.path on
// dropped files, so we implement the Tauri onDragDropEvent shape with DOM events.
type DragDropEvent =
  | { payload: { type: "enter" | "over"; paths: string[]; position: { x: number; y: number } } }
  | { payload: { type: "drop"; paths: string[]; position: { x: number; y: number } } }
  | { payload: { type: "leave" } };

export function getCurrentWebview() {
  return {
    onDragDropEvent(cb: (e: DragDropEvent) => void): Promise<() => void> {
      const over = (ev: DragEvent) => {
        ev.preventDefault();
        cb({ payload: { type: "over", paths: [], position: { x: ev.clientX, y: ev.clientY } } });
      };
      const drop = (ev: DragEvent) => {
        ev.preventDefault();
        const paths: string[] = [];
        const files = ev.dataTransfer?.files;
        if (files) for (const f of Array.from(files)) {
          const p = (f as File & { path?: string }).path;
          if (p) paths.push(p);
        }
        cb({ payload: { type: "drop", paths, position: { x: ev.clientX, y: ev.clientY } } });
      };
      const leave = () => cb({ payload: { type: "leave" } });
      window.addEventListener("dragover", over);
      window.addEventListener("drop", drop);
      window.addEventListener("dragleave", leave);
      return Promise.resolve(() => {
        window.removeEventListener("dragover", over);
        window.removeEventListener("drop", drop);
        window.removeEventListener("dragleave", leave);
      });
    },
  };
}
