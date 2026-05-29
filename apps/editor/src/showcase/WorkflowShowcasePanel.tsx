import { useEffect, useMemo, useRef, useState } from "react";
import { runtimeAdapter, type WorkflowRuntimeState } from "./runtimeAdapter";

interface Props {
  content: string;
  mode: "search" | "trust" | "workflow";
  onModeChange: (mode: "search" | "trust" | "workflow") => void;
}

type NodeStatus = "pending" | "running" | "done" | "blocked" | "failed";

type LogEntry = {
  id: string;
  ts: string;
  label: string;
  type: string;
  detail?: string;
};

function nowStamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

export function WorkflowShowcasePanel({ content, mode, onModeChange }: Props) {
  const [state, setState] = useState<WorkflowRuntimeState>({
    running: false,
    cursor: 0,
    nodes: [],
  });
  const [pausedAtGate, setPausedAtGate] = useState(false);
  const [failed, setFailed] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [contextVars, setContextVars] = useState<Record<string, string>>({});
  const tickRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const nodes = useMemo(() => {
    return runtimeAdapter.getNodes(content);
  }, [content]);

  useEffect(() => {
    const fresh: Record<string, NodeStatus> = {};
    for (const n of nodes) fresh[n.id] = "pending";
    setStatuses(fresh);
    setLogs([]);
    setContextVars({});
    setPausedAtGate(false);
    setFailed(false);
    setState({ running: false, cursor: 0, nodes });
  }, [nodes]);

  const viewState: WorkflowRuntimeState = {
    ...state,
    nodes,
    cursor: nodes.length === 0 ? 0 : Math.min(state.cursor, nodes.length - 1),
  };

  const runWorkflow = () => {
    if (nodes.length === 0) return;
    if (failed || viewState.cursor >= nodes.length) {
      const fresh: Record<string, NodeStatus> = {};
      for (const n of nodes) fresh[n.id] = "pending";
      setStatuses(fresh);
      setLogs([]);
      setContextVars({});
      setFailed(false);
      setPausedAtGate(false);
      setState({ running: true, cursor: 0, nodes });
      return;
    }
    setState((prev) => ({ ...prev, running: true }));
  };

  const approveGate = () => {
    const gate = nodes[viewState.cursor];
    if (!gate) return;
    setStatuses((prev) => ({ ...prev, [gate.id]: "done" }));
    setLogs((prev) => [
      ...prev,
      {
        id: `${gate.id}-approved-${Date.now()}`,
        ts: nowStamp(),
        type: "gate",
        label: `Approved gate: ${gate.label}`,
      },
    ]);
    setPausedAtGate(false);
    setState((prev) => ({ ...prev, running: true, cursor: prev.cursor + 1 }));
  };

  const rejectGate = () => {
    const gate = nodes[viewState.cursor];
    if (!gate) return;
    setStatuses((prev) => ({ ...prev, [gate.id]: "failed" }));
    setLogs((prev) => [
      ...prev,
      {
        id: `${gate.id}-rejected-${Date.now()}`,
        ts: nowStamp(),
        type: "gate",
        label: `Rejected gate: ${gate.label}`,
        detail: "Workflow terminated at approval gate.",
      },
    ]);
    setPausedAtGate(false);
    setFailed(true);
    setState((prev) => ({ ...prev, running: false }));
  };

  const resetAll = () => {
    if (tickRef.current) window.clearTimeout(tickRef.current);
    inFlightRef.current = false;
    const fresh: Record<string, NodeStatus> = {};
    for (const n of nodes) fresh[n.id] = "pending";
    setStatuses(fresh);
    setLogs([]);
    setContextVars({});
    setPausedAtGate(false);
    setFailed(false);
    setState((prev) => runtimeAdapter.reset({ ...prev, nodes }));
  };

  useEffect(() => {
    if (!viewState.running || pausedAtGate || failed) return;
    if (viewState.cursor >= nodes.length) {
      setState((prev) => ({ ...prev, running: false }));
      return;
    }
    if (inFlightRef.current) return;

    const node = nodes[viewState.cursor];
    if (!node) return;

    if (node.type === "gate") {
      setStatuses((prev) => ({ ...prev, [node.id]: "blocked" }));
      setLogs((prev) => [
        ...prev,
        {
          id: `${node.id}-paused-${Date.now()}`,
          ts: nowStamp(),
          type: "gate",
          label: `Gate paused: ${node.label}`,
          detail: "Waiting for manual approval",
        },
      ]);
      setPausedAtGate(true);
      setState((prev) => ({ ...prev, running: false }));
      return;
    }

    inFlightRef.current = true;
    setStatuses((prev) => ({ ...prev, [node.id]: "running" }));

    const delay = 700 + Math.floor(Math.random() * 220);
    tickRef.current = window.setTimeout(() => {
      setStatuses((prev) => ({ ...prev, [node.id]: "done" }));
      setLogs((prev) => [
        ...prev,
        {
          id: `${node.id}-done-${Date.now()}`,
          ts: nowStamp(),
          type: node.type,
          label: node.label,
          detail: `Completed in ${delay}ms`,
        },
      ]);

      if (node.type === "step") {
        const key = `step.${node.id}`;
        setContextVars((prev) => ({
          ...prev,
          [key]: `ok:${Math.floor(Math.random() * 900 + 100)}`,
        }));
      }

      inFlightRef.current = false;
      setState((prev) => ({ ...prev, cursor: prev.cursor + 1 }));
    }, delay);

    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
    };
  }, [viewState.running, viewState.cursor, pausedAtGate, failed, nodes]);

  return (
    <aside className="showcase-panel">
      <div className="showcase-panel-header">
        <h3>Workflow Execution</h3>
        <p>
          Live step execution with gate pause/approve flow (in-memory demo).
        </p>
        <div
          className="showcase-mode-switch"
          role="tablist"
          aria-label="Showcase modes"
        >
          <button
            className={mode === "search" ? "active" : ""}
            onClick={() => onModeChange("search")}
          >
            Search
          </button>
          <button
            className={mode === "trust" ? "active" : ""}
            onClick={() => onModeChange("trust")}
          >
            Trust
          </button>
          <button
            className={mode === "workflow" ? "active" : ""}
            onClick={() => onModeChange("workflow")}
          >
            Workflow
          </button>
        </div>
      </div>

      <div className="showcase-statline">
        <span>{nodes.length} executable blocks</span>
        <span>
          {failed
            ? "Failed"
            : pausedAtGate
              ? "Paused at gate"
              : viewState.running
                ? `Running (${runtimeAdapter.mode})`
                : viewState.cursor >= nodes.length && nodes.length > 0
                  ? "Completed"
                  : "Idle"}
        </span>
      </div>

      <div className="workflow-list">
        {nodes.length === 0 && (
          <div className="showcase-empty">
            No workflow blocks in current document.
          </div>
        )}
        {nodes.map((n, i) => {
          const status = statuses[n.id] || "pending";
          return (
            <div key={`${n.id}-${i}`} className={`workflow-item ${status}`}>
              <div className="workflow-type">{n.type}</div>
              <div className="workflow-label">{n.label}</div>
              {n.depends && (
                <div className="workflow-dep">depends: {n.depends}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="showcase-context">
        <label>Context</label>
        {Object.keys(contextVars).length === 0 && (
          <div className="showcase-empty">No context variables yet.</div>
        )}
        {Object.entries(contextVars).map(([k, v]) => (
          <div key={k} className="showcase-context-row">
            <span>{k}</span>
            <code>{v}</code>
          </div>
        ))}
      </div>

      <div className="showcase-exec-log">
        <label>Execution Log</label>
        {logs.length === 0 && (
          <div className="showcase-empty">No execution events yet.</div>
        )}
        {logs.map((entry) => (
          <div key={entry.id} className="showcase-log-row">
            <div className="showcase-log-head">
              <span>{entry.ts}</span>
              <strong>{entry.type}</strong>
            </div>
            <div>{entry.label}</div>
            {entry.detail && <div className="workflow-dep">{entry.detail}</div>}
          </div>
        ))}
      </div>

      {pausedAtGate && (
        <div className="showcase-gate-card">
          <strong>Gate approval required</strong>
          <p>The workflow is paused and needs a manual decision.</p>
          <div className="showcase-gate-actions">
            <button onClick={approveGate}>Approve and Continue</button>
            <button onClick={rejectGate}>Reject and Stop</button>
          </div>
        </div>
      )}

      <div className="showcase-actions">
        <button onClick={runWorkflow}>
          {failed || viewState.cursor >= nodes.length
            ? "Run Again"
            : "Run Workflow"}
        </button>
        <button onClick={resetAll}>Reset</button>
      </div>
    </aside>
  );
}
