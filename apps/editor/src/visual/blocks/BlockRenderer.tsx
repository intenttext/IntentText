import { useRef, useEffect, useCallback } from "react";
import { LANGUAGE_REGISTRY } from "@intenttext/core";
import { BlockTag } from "./BlockTag";
import {
  CATEGORY_META,
  READ_ONLY_KEYWORDS,
  INLINE_EDITABLE_KEYWORDS,
} from "../types";
import type { VisualBlock } from "../types";

interface BlockProps {
  block: VisualBlock;
  isSelected: boolean;
  isFrozen: boolean;
  onSelect: () => void;
  onUpdate: (block: VisualBlock) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function BlockRenderer({
  block,
  isSelected,
  isFrozen,
  onSelect,
  onUpdate,
  onDelete,
  onInsertAfter,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
}: BlockProps) {
  const reg = LANGUAGE_REGISTRY.find((r) => r.canonical === block.type);
  const category = reg?.category || "content";
  const catMeta = CATEGORY_META[category];
  const isReadOnly = isFrozen || READ_ONLY_KEYWORDS.has(block.type);

  return (
    <div
      className={`it-visual-block ${isSelected ? "selected" : ""} cat-${category}`}
      onClick={onSelect}
      data-block-type={block.type}
      style={{
        borderLeftColor: catMeta?.color || "var(--border)",
      }}
    >
      <BlockTag keyword={block.type} />

      {/* Drag handle */}
      {!isFrozen && (
        <div
          className="it-block-drag-handle"
          title="Drag to reorder"
          {...dragHandleProps}
        >
          ⠿
        </div>
      )}

      {/* Block-specific rendering */}
      <div className="it-block-content">
        {renderBlockContent(block, isReadOnly, onUpdate)}
      </div>

      {/* Inline actions — visible on selection */}
      {isSelected && !isFrozen && (
        <div className="it-block-actions">
          <button
            onClick={onMoveUp}
            title="Move up"
            className="it-block-action"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            title="Move down"
            className="it-block-action"
          >
            ↓
          </button>
          <button
            onClick={onInsertAfter}
            title="Add block below"
            className="it-block-action"
          >
            +
          </button>
          <button
            onClick={onDelete}
            title="Delete block"
            className="it-block-action it-block-action-delete"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Block content renderers by type ───────────────────────────────

function renderBlockContent(
  block: VisualBlock,
  isReadOnly: boolean,
  onUpdate: (block: VisualBlock) => void,
) {
  const { type } = block;

  // Title
  if (type === "title") {
    return (
      <EditableText
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        readOnly={isReadOnly}
        className="it-title-text"
        placeholder="Document title"
      />
    );
  }

  // Summary
  if (type === "summary") {
    return (
      <EditableText
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        readOnly={isReadOnly}
        className="it-summary-text"
        placeholder="Document summary"
      />
    );
  }

  // Section heading
  if (type === "section") {
    return (
      <EditableText
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        readOnly={isReadOnly}
        className="it-section-text"
        placeholder="Section title"
      />
    );
  }

  // Sub heading
  if (type === "sub") {
    return (
      <EditableText
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        readOnly={isReadOnly}
        className="it-sub-text"
        placeholder="Subsection title"
      />
    );
  }

  // Body text (note/text)
  if (type === "text") {
    return (
      <EditableText
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        readOnly={isReadOnly}
        className="it-body-text"
        placeholder="Start typing..."
        multiline
      />
    );
  }

  // Callouts: tip, info, warning, danger, success
  if (["tip", "info", "warning", "danger", "success"].includes(type)) {
    const icons: Record<string, string> = {
      tip: "Tip",
      info: "Info",
      warning: "Warn",
      danger: "Alert",
      success: "OK",
    };
    return (
      <div className={`it-callout it-callout-${type}`}>
        <span className="it-callout-icon">{icons[type]}</span>
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          className="it-callout-text"
          placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} message`}
          multiline
        />
      </div>
    );
  }

  // Quote
  if (type === "quote") {
    return (
      <div className="it-quote">
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          className="it-quote-text"
          placeholder="Quote text"
          multiline
        />
        {(block.properties.by || !isReadOnly) && (
          <div className="it-quote-attr">
            —{" "}
            <EditableInline
              value={block.properties.by || ""}
              onChange={(v) =>
                onUpdate({
                  ...block,
                  properties: { ...block.properties, by: v },
                })
              }
              readOnly={isReadOnly}
              placeholder="Attribution"
            />
          </div>
        )}
      </div>
    );
  }

  // Code
  if (type === "code") {
    return (
      <div className="it-code-block">
        <div className="it-code-lang">
          <EditableInline
            value={block.properties.lang || ""}
            onChange={(v) =>
              onUpdate({
                ...block,
                properties: { ...block.properties, lang: v },
              })
            }
            readOnly={isReadOnly}
            placeholder="lang"
          />
        </div>
        <textarea
          className="it-code-textarea"
          value={block.content}
          onChange={(e) => onUpdate({ ...block, content: e.target.value })}
          readOnly={isReadOnly}
          spellCheck={false}
          rows={Math.max(3, block.content.split("\n").length)}
        />
      </div>
    );
  }

  // Image
  if (type === "image") {
    return (
      <div className="it-image-block">
        {block.properties.src ? (
          <img
            src={block.properties.src}
            alt={block.properties.alt || block.content}
            className="it-image"
          />
        ) : (
          <div className="it-image-placeholder">
            Image
            {!isReadOnly && (
              <EditableInline
                value={block.properties.src || ""}
                onChange={(v) =>
                  onUpdate({
                    ...block,
                    properties: { ...block.properties, src: v },
                  })
                }
                readOnly={isReadOnly}
                placeholder="Enter image URL"
              />
            )}
          </div>
        )}
        {block.properties.alt && (
          <div className="it-image-alt">{block.properties.alt}</div>
        )}
      </div>
    );
  }

  // Figure
  if (type === "figure") {
    return (
      <div className="it-figure-block">
        {block.properties.src ? (
          <img
            src={block.properties.src}
            alt={block.content}
            className="it-image"
          />
        ) : (
          <div className="it-image-placeholder">Figure</div>
        )}
        <EditableText
          value={block.properties.caption || block.content}
          onChange={(v) =>
            onUpdate({
              ...block,
              content: v,
              properties: { ...block.properties, caption: v },
            })
          }
          readOnly={isReadOnly}
          className="it-figure-caption"
          placeholder="Figure caption"
        />
      </div>
    );
  }

  // Link
  if (type === "link") {
    return (
      <div className="it-link-block">
        <span className="it-link-icon">Link</span>
        <div className="it-link-body">
          <EditableText
            value={block.content}
            onChange={(v) => onUpdate({ ...block, content: v })}
            readOnly={isReadOnly}
            className="it-link-label"
            placeholder="Link label"
          />
          <EditableInline
            value={block.properties.to || ""}
            onChange={(v) =>
              onUpdate({ ...block, properties: { ...block.properties, to: v } })
            }
            readOnly={isReadOnly}
            placeholder="URL"
          />
        </div>
      </div>
    );
  }

  // Cite
  if (type === "cite") {
    return (
      <div className="it-cite-block">
        <span className="it-cite-icon">📚</span>
        <div className="it-cite-body">
          <EditableText
            value={block.content}
            onChange={(v) => onUpdate({ ...block, content: v })}
            readOnly={isReadOnly}
            className="it-cite-title"
            placeholder="Source title"
          />
          <EditableInline
            value={block.properties.url || ""}
            onChange={(v) =>
              onUpdate({
                ...block,
                properties: { ...block.properties, url: v },
              })
            }
            readOnly={isReadOnly}
            placeholder="URL"
          />
        </div>
      </div>
    );
  }

  // Definition
  if (type === "def") {
    const parts = block.content.split("—").map((s) => s.trim());
    return (
      <div className="it-def-block">
        <EditableInline
          value={parts[0] || ""}
          onChange={(v) =>
            onUpdate({ ...block, content: `${v} — ${parts[1] || ""}` })
          }
          readOnly={isReadOnly}
          placeholder="Term"
        />
        <span className="it-def-sep">—</span>
        <EditableInline
          value={parts[1] || ""}
          onChange={(v) =>
            onUpdate({ ...block, content: `${parts[0] || ""} — ${v}` })
          }
          readOnly={isReadOnly}
          placeholder="Definition"
        />
      </div>
    );
  }

  // Contact
  if (type === "contact") {
    return (
      <div className="it-contact-card">
        <div className="it-contact-avatar">
          {(block.content || "?")[0].toUpperCase()}
        </div>
        <div className="it-contact-info">
          <EditableText
            value={block.content}
            onChange={(v) => onUpdate({ ...block, content: v })}
            readOnly={isReadOnly}
            className="it-contact-name"
            placeholder="Name"
          />
          <div className="it-contact-details">
            <PropertyField
              block={block}
              prop="role"
              label="Role"
              readOnly={isReadOnly}
              onUpdate={onUpdate}
            />
            <PropertyField
              block={block}
              prop="email"
              label="Email"
              readOnly={isReadOnly}
              onUpdate={onUpdate}
            />
            <PropertyField
              block={block}
              prop="phone"
              label="Phone"
              readOnly={isReadOnly}
              onUpdate={onUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  // Metric (KPI card)
  if (type === "metric") {
    const trend = block.properties.trend;
    const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
    const trendColor =
      trend === "up"
        ? "var(--success)"
        : trend === "down"
          ? "var(--error)"
          : "var(--text-muted)";
    return (
      <div className="it-metric-card">
        <div className="it-metric-label">
          <EditableText
            value={block.content}
            onChange={(v) => onUpdate({ ...block, content: v })}
            readOnly={isReadOnly}
            placeholder="Metric name"
          />
        </div>
        <div className="it-metric-value-row">
          <span className="it-metric-value">
            <EditableInline
              value={block.properties.value || ""}
              onChange={(v) =>
                onUpdate({
                  ...block,
                  properties: { ...block.properties, value: v },
                })
              }
              readOnly={isReadOnly}
              placeholder="0"
            />
          </span>
          <span className="it-metric-unit">{block.properties.unit || ""}</span>
          {trend && (
            <span className="it-metric-trend" style={{ color: trendColor }}>
              {trendIcon}
            </span>
          )}
        </div>
        {block.properties.target && (
          <div className="it-metric-target">
            Target: {block.properties.target}
          </div>
        )}
      </div>
    );
  }

  // Deadline
  if (type === "deadline") {
    return (
      <div className="it-deadline-block">
        <span className="it-deadline-icon">Due</span>
        <div className="it-deadline-body">
          <EditableText
            value={block.content}
            onChange={(v) => onUpdate({ ...block, content: v })}
            readOnly={isReadOnly}
            placeholder="Deadline description"
          />
          <div className="it-deadline-details">
            <PropertyField
              block={block}
              prop="date"
              label="Date"
              readOnly={isReadOnly}
              onUpdate={onUpdate}
            />
            <PropertyField
              block={block}
              prop="owner"
              label="Owner"
              readOnly={isReadOnly}
              onUpdate={onUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  // Divider
  if (type === "divider") {
    return <hr className="it-divider" />;
  }

  // Break
  if (type === "break") {
    return <div className="it-break">— Page Break —</div>;
  }

  // Ref
  if (type === "ref") {
    return (
      <div className="it-ref-block">
        <span className="it-ref-icon">📎</span>
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          placeholder="Referenced document"
        />
        {block.properties.rel && (
          <span className="it-ref-rel">{block.properties.rel}</span>
        )}
      </div>
    );
  }

  // Table (columns + row)
  if (type === "columns") {
    const cols = block.content.split("|").map((s) => s.trim());
    return (
      <div className="it-table-header">
        {cols.map((col, i) => (
          <span key={i} className="it-table-cell it-table-th">
            {col}
          </span>
        ))}
      </div>
    );
  }

  if (type === "row") {
    const cells = block.content.split("|").map((s) => s.trim());
    return (
      <div className="it-table-row">
        {cells.map((cell, i) => (
          <span key={i} className="it-table-cell">
            {cell}
          </span>
        ))}
      </div>
    );
  }

  // Input / Output
  if (type === "input" || type === "output") {
    const icon = type === "input" ? "In" : "Out";
    return (
      <div className={`it-io-block it-${type}-block`}>
        <span>{icon}</span>
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          placeholder={type === "input" ? "Input field" : "Output result"}
        />
        {block.properties.type && (
          <span className="it-io-type">{block.properties.type}</span>
        )}
      </div>
    );
  }

  // Trust blocks
  if (type === "approve") {
    return (
      <div className="it-trust-card it-approve">
        <span className="it-trust-icon">Approved</span>
        <div>
          <strong>Approved</strong>
          {block.properties.by && <span> by {block.properties.by}</span>}
          {block.properties.role && (
            <span className="it-trust-role"> ({block.properties.role})</span>
          )}
          {block.properties.at && (
            <div className="it-trust-time">{block.properties.at}</div>
          )}
        </div>
      </div>
    );
  }

  if (type === "sign") {
    return (
      <div className="it-trust-card it-sign">
        <span className="it-trust-icon">Signed</span>
        <div>
          <strong>Signed</strong>
          {block.properties.by && <span> by {block.properties.by}</span>}
          {block.properties.role && (
            <span className="it-trust-role"> ({block.properties.role})</span>
          )}
          {block.properties.at && (
            <div className="it-trust-time">{block.properties.at}</div>
          )}
        </div>
      </div>
    );
  }

  if (type === "freeze") {
    return (
      <div className="it-freeze-banner">
        <span className="it-trust-icon">Sealed</span>
        <strong>Document Sealed</strong>
        {block.properties.by && <span> by {block.properties.by}</span>}
        {block.properties.hash && (
          <code className="it-freeze-hash">
            {block.properties.hash.slice(0, 12)}…
          </code>
        )}
      </div>
    );
  }

  if (type === "revision") {
    return (
      <div className="it-trust-card it-revision">
        <span className="it-trust-icon">Rev</span>
        <span>v{block.content}</span>
        {block.properties.by && <span> — {block.properties.by}</span>}
        {block.properties.at && (
          <span className="it-trust-time"> {block.properties.at}</span>
        )}
      </div>
    );
  }

  if (type === "amendment") {
    return (
      <div className="it-amendment-card">
        <span className="it-trust-icon">Amend</span>
        <div>
          <strong>Amendment</strong>
          {block.properties.section && (
            <span> — {block.properties.section}</span>
          )}
          {block.properties.was && (
            <div className="it-amend-was">
              <s>{block.properties.was}</s>
            </div>
          )}
          {block.properties.now && (
            <div className="it-amend-now">{block.properties.now}</div>
          )}
        </div>
      </div>
    );
  }

  if (type === "policy") {
    return (
      <div className="it-trust-card it-policy">
        <span className="it-trust-icon">Policy</span>
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          placeholder="Policy rule"
        />
      </div>
    );
  }

  if (type === "history") {
    return <div className="it-history-boundary">── Document History ──</div>;
  }

  // Meta block — key:value chips
  if (type === "meta") {
    const entries = Object.entries(block.properties);
    return (
      <div className="it-meta-block">
        {entries.map(([k, v]) => (
          <span key={k} className="it-meta-chip">
            <span className="it-meta-key">{k}</span>
            <span className="it-meta-val">{v}</span>
          </span>
        ))}
        {block.content && <span className="it-meta-chip">{block.content}</span>}
      </div>
    );
  }

  // Track
  if (type === "track") {
    return (
      <div className="it-track-badge">
        v{block.properties.version || block.content}
        {block.properties.by && <span> by {block.properties.by}</span>}
      </div>
    );
  }

  // Context
  if (type === "context") {
    return (
      <div className="it-context-block">
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          className="it-context-text"
          placeholder="Context information"
          multiline
        />
      </div>
    );
  }

  // Layout blocks
  if (
    ["page", "font", "header", "footer", "watermark", "signline"].includes(type)
  ) {
    return (
      <LayoutBlockRenderer
        block={block}
        isReadOnly={isReadOnly}
        onUpdate={onUpdate}
      />
    );
  }

  // Agent / workflow blocks
  const agentTypes = new Set([
    "step",
    "gate",
    "trigger",
    "signal",
    "decision",
    "memory",
    "prompt",
    "tool",
    "audit",
    "done",
    "error",
    "result",
    "handoff",
    "wait",
    "parallel",
    "retry",
    "call",
    "loop",
    "checkpoint",
    "import",
    "export",
    "progress",
    "assert",
    "secret",
    "task",
    "ask",
    "agent",
    "model",
  ]);
  if (agentTypes.has(type)) {
    return (
      <AgentBlockRenderer
        block={block}
        isReadOnly={isReadOnly}
        onUpdate={onUpdate}
      />
    );
  }

  // Literary / content extras
  if (
    [
      "byline",
      "epigraph",
      "caption",
      "footnote",
      "dedication",
      "toc",
      "embed",
    ].includes(type)
  ) {
    return (
      <EditableText
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        readOnly={isReadOnly}
        className={`it-${type}-text`}
        placeholder={type}
        multiline
      />
    );
  }

  // Fallback: generic block
  return (
    <EditableText
      value={block.content}
      onChange={(v) => onUpdate({ ...block, content: v })}
      readOnly={isReadOnly}
      placeholder={`${type} content`}
    />
  );
}

// ─── Agent block sub-renderer ──────────────────────────────────────

function AgentBlockRenderer({
  block,
  isReadOnly,
  onUpdate,
}: {
  block: VisualBlock;
  isReadOnly: boolean;
  onUpdate: (b: VisualBlock) => void;
}) {
  const icons: Record<string, string> = {
    step: "step",
    gate: "gate",
    trigger: "trig",
    signal: "sig",
    decision: "dec",
    memory: "mem",
    prompt: "prmt",
    tool: "tool",
    audit: "aud",
    done: "done",
    error: "err",
    result: "res",
    handoff: "hand",
    wait: "wait",
    parallel: "para",
    retry: "retry",
    call: "call",
    loop: "loop",
    checkpoint: "chk",
    import: "imp",
    export: "exp",
    progress: "prog",
    assert: "asrt",
    secret: "sec",
    task: "task",
    ask: "ask",
    agent: "agnt",
    model: "mdl",
    policy: "pol",
  };

  const propEntries = Object.entries(block.properties).filter(
    ([k]) => k !== "id" && k !== "status",
  );

  return (
    <div className="it-agent-block">
      <span className="it-agent-icon">{icons[block.type] || "cmd"}</span>
      <div className="it-agent-body">
        <EditableText
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          readOnly={isReadOnly}
          className="it-agent-content"
          placeholder={`${block.type} description`}
        />
        {propEntries.length > 0 && (
          <div className="it-agent-props">
            {propEntries.map(([k, v]) => (
              <span key={k} className="it-agent-prop">
                <span className="it-agent-prop-key">{k}:</span> {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Layout block sub-renderer ─────────────────────────────────────

function LayoutBlockRenderer({
  block,
  isReadOnly,
  onUpdate,
}: {
  block: VisualBlock;
  isReadOnly: boolean;
  onUpdate: (b: VisualBlock) => void;
}) {
  const icons: Record<string, string> = {
    page: "pg",
    font: "Aa",
    header: "hdr",
    footer: "ftr",
    watermark: "wm",
    signline: "sig",
  };

  const propEntries = Object.entries(block.properties).filter(
    ([k]) => k !== "id",
  );

  return (
    <div className="it-layout-block">
      <span className="it-layout-icon">{icons[block.type] || "pg"}</span>
      <div className="it-layout-body">
        <span className="it-layout-type">{block.type}</span>
        {block.content && (
          <span className="it-layout-content">{block.content}</span>
        )}
        {propEntries.length > 0 && (
          <div className="it-layout-props">
            {propEntries.map(([k, v]) => (
              <span key={k} className="it-meta-chip">
                <span className="it-meta-key">{k}</span>
                <span className="it-meta-val">{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Editable text components ──────────────────────────────────────

function EditableText({
  value,
  onChange,
  readOnly,
  className = "",
  placeholder = "",
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync value from parent when it changes externally
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onChange(ref.current.textContent || "");
    }
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!multiline && e.key === "Enter") {
        e.preventDefault();
      }
    },
    [multiline],
  );

  if (readOnly) {
    return (
      <div className={`it-editable-text ${className}`}>
        {value || <span className="it-placeholder">{placeholder}</span>}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`it-editable-text ${className}`}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      spellCheck
    />
  );
}

function EditableInline({
  value,
  onChange,
  readOnly,
  placeholder = "",
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  placeholder?: string;
}) {
  if (readOnly) {
    return <span className="it-editable-inline">{value}</span>;
  }

  return (
    <input
      type="text"
      className="it-editable-inline"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
    />
  );
}

function PropertyField({
  block,
  prop,
  label,
  readOnly,
  onUpdate,
}: {
  block: VisualBlock;
  prop: string;
  label: string;
  readOnly: boolean;
  onUpdate: (b: VisualBlock) => void;
}) {
  const val = block.properties[prop] || "";
  if (readOnly && !val) return null;

  return (
    <div className="it-prop-field">
      <span className="it-prop-label">{label}:</span>
      <EditableInline
        value={val}
        onChange={(v) =>
          onUpdate({ ...block, properties: { ...block.properties, [prop]: v } })
        }
        readOnly={readOnly}
        placeholder={label}
      />
    </div>
  );
}
