import { parseIntentText } from "@intenttext/core";

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  depends: string;
}

export interface WorkflowRuntimeState {
  running: boolean;
  cursor: number;
  nodes: WorkflowNode[];
}

export interface WorkflowRuntimeAdapter {
  mode: "mock" | "tauri";
  getNodes: (source: string) => WorkflowNode[];
  advance: (state: WorkflowRuntimeState) => WorkflowRuntimeState;
  reset: (state: WorkflowRuntimeState) => WorkflowRuntimeState;
}

const EXEC_TYPES = new Set([
  "step",
  "decision",
  "gate",
  "result",
  "task",
  "ask",
]);

function createMockAdapter(): WorkflowRuntimeAdapter {
  return {
    mode: "mock",
    getNodes(source: string) {
      try {
        const doc = parseIntentText(source);
        return doc.blocks
          .filter((b) => EXEC_TYPES.has(b.type))
          .map((b) => ({
            id: String(b.properties?.id || b.id || b.type),
            type: b.type,
            label: b.content || b.type,
            depends: String(b.properties?.depends || ""),
          }));
      } catch {
        return [];
      }
    },
    advance(state: WorkflowRuntimeState) {
      if (state.nodes.length === 0) {
        return { ...state, running: false, cursor: 0 };
      }
      return {
        ...state,
        running: true,
        cursor: (state.cursor + 1) % state.nodes.length,
      };
    },
    reset(state: WorkflowRuntimeState) {
      return {
        ...state,
        running: false,
        cursor: 0,
      };
    },
  };
}

function hasTauriRuntime(): boolean {
  const g = globalThis as Record<string, unknown>;
  return Boolean(g.__TAURI_INTERNALS__ || g.__TAURI__ || g.__TAURI_IPC__);
}

export function createRuntimeAdapter(): WorkflowRuntimeAdapter {
  // Placeholder switch point for future tauri invoke adapter.
  if (hasTauriRuntime()) {
    return createMockAdapter();
  }
  return createMockAdapter();
}

export const runtimeAdapter = createRuntimeAdapter();
