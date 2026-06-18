// FormDesigner — a SEPARATE visual builder for forms (not the main editor canvas).
// A non-technical author sees the form the way it will look — title, sections,
// descriptions, and the fields as real boxes — and edits everything in place:
// rename, pick a type, mark required, set Full/Half width (two per row, shown live),
// drag to reorder, delete, and add new fields/sections/descriptions. Writes back to
// the `.it` source; the trust/layout/comment lines in the file are left untouched.
//
// Text inputs are UNCONTROLLED (defaultValue + a key tied to the source line): the
// source updates on every keystroke, but the input keeps the caret/focus because it
// isn't re-driven by the round-tripped value. A line change (reorder/add/delete)
// changes the key and remounts with fresh text. Field cards are rendered by a plain
// function (not a nested component), so a keystroke never remounts the subtree.

import { useMemo, useRef, useState } from "react";
import {
  parseDesignRows,
  setRowLabel,
  setRowProp,
  removeRowLine,
  moveRowLine,
  insertRowAfter,
  type DesignRow,
} from "./form-doc";
import { FIELD_PALETTE, buildFieldLine } from "./form-fields";
import { FORM_FIELD_TYPES } from "@dotit/core";

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  textarea: "Paragraph",
  number: "Number",
  date: "Date",
  choice: "Choice",
  checkbox: "Checkbox",
  signature: "Signature",
  attachment: "Attachment",
  table: "Table",
};

export interface FormDesignerProps {
  value: string;
  onChange: (next: string) => void;
}

export function FormDesigner({ value, onChange }: FormDesignerProps) {
  const rows = useMemo(() => parseDesignRows(value), [value]);
  const dragLine = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const titleRow = rows.find((r) => r.kind === "title");
  const bodyRows = rows.filter((r) => r.kind !== "title");
  const lastBodyLine = bodyRows.length
    ? bodyRows[bodyRows.length - 1].line
    : (titleRow?.line ?? -1);

  // ── source mutations ──────────────────────────────────────────────────────
  const editLabel = (line: number, text: string) =>
    onChange(setRowLabel(value, line, text));
  const editProp = (line: number, prop: string, v: string) =>
    onChange(setRowProp(value, line, prop, v));
  const del = (line: number) => onChange(removeRowLine(value, line));
  const addField = (type: string, label: string, options?: string) =>
    onChange(
      insertRowAfter(
        value,
        lastBodyLine,
        buildFieldLine(
          { type, label, options } as Parameters<typeof buildFieldLine>[0],
          value,
        ),
      ),
    );
  const addSection = () =>
    onChange(insertRowAfter(value, lastBodyLine, "section: New section"));
  const addDescription = () =>
    onChange(insertRowAfter(value, lastBodyLine, "text: Description"));
  const addTitle = () => onChange("title: Untitled form\n" + value);

  // ── drag reorder ──────────────────────────────────────────────────────────
  const dragProps = (line: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragLine.current = line;
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (dropTarget !== line) setDropTarget(line);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragLine.current;
      dragLine.current = null;
      setDropTarget(null);
      if (from != null && from !== line) onChange(moveRowLine(value, from, line));
    },
    onDragEnd: () => {
      dragLine.current = null;
      setDropTarget(null);
    },
  });

  // ── field box preview (what the recipient will see) — display only ──────────
  function fieldPreview(row: DesignRow) {
    const t = row.fieldType || "text";
    if (t === "checkbox")
      return <span className="fd-prev fd-prev-check">☐ {row.label || "Option"}</span>;
    if (t === "signature")
      return <span className="fd-prev fd-prev-sig">✍ ____________________</span>;
    if (t === "choice") {
      const opts = (row.props.options || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <span className="fd-prev fd-prev-choice">
          {opts.length ? opts.join("  /  ") : "Option A / Option B"} ▾
        </span>
      );
    }
    if (t === "textarea") return <span className="fd-prev fd-prev-area" />;
    if (t === "attachment")
      return <span className="fd-prev fd-prev-file">📎 Attach a file…</span>;
    if (t === "date") return <span className="fd-prev fd-prev-box">dd / mm / yyyy</span>;
    return <span className="fd-prev fd-prev-box" />;
  }

  // A field card — a plain function (NOT a nested component), so typing never
  // remounts it. Caret stays put because the label/options inputs are uncontrolled.
  function fieldCard(row: DesignRow) {
    const required = /^(yes|true|on|1|required|checked|x)$/i.test(
      (row.props.required || "").trim(),
    );
    const half = row.props.width === "50%";
    return (
      <div
        key={`f${row.line}`}
        className={`fd-field ${half ? "fd-field--half" : ""} ${dropTarget === row.line ? "fd-drop" : ""}`}
        {...dragProps(row.line)}
      >
        <div className="fd-field__bar">
          <span className="fd-grip" title="Drag to reorder" aria-hidden>⠿</span>
          <select
            className="fd-mini"
            value={FORM_FIELD_TYPES.includes(row.fieldType as never) ? row.fieldType : "text"}
            onChange={(e) => editProp(row.line, "type", e.target.value)}
            title="Field type"
          >
            {FORM_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>
            ))}
          </select>
          <button
            type="button"
            className={`fd-chip ${required ? "on" : ""}`}
            onClick={() => editProp(row.line, "required", required ? "" : "true")}
            title="Required to complete the form"
          >
            Required
          </button>
          <button
            type="button"
            className={`fd-chip ${half ? "on" : ""}`}
            onClick={() => editProp(row.line, "width", half ? "" : "50%")}
            title="Half width — two fields per row"
          >
            ½
          </button>
          <button
            type="button"
            className="fd-x"
            onClick={() => del(row.line)}
            title="Delete field"
            aria-label="Delete field"
          >
            ✕
          </button>
        </div>
        <input
          key={`fl${row.line}`}
          className="fd-field__label"
          defaultValue={row.label}
          placeholder="Field label"
          onChange={(e) => editLabel(row.line, e.target.value)}
          aria-label="Field label"
        />
        {fieldPreview(row)}
        {row.fieldType === "choice" && (
          <input
            key={`fo${row.line}`}
            className="fd-field__opts"
            defaultValue={row.props.options || ""}
            placeholder="Option A, Option B, Option C"
            onChange={(e) => editProp(row.line, "options", e.target.value)}
            aria-label="Choices (comma-separated)"
          />
        )}
      </div>
    );
  }

  // ── render body, grouping consecutive fields into rows (two-per-row live) ────
  const out: React.ReactNode[] = [];
  for (let i = 0; i < bodyRows.length; i++) {
    const row = bodyRows[i];
    if (row.kind === "field") {
      const group: DesignRow[] = [];
      while (i < bodyRows.length && bodyRows[i].kind === "field") group.push(bodyRows[i++]);
      i--;
      out.push(
        <div className="fd-fieldrow" key={`fr${row.line}`}>
          {group.map((f) => fieldCard(f))}
        </div>,
      );
      continue;
    }
    const dropCls = dropTarget === row.line ? "fd-drop" : "";
    if (row.kind === "section" || row.kind === "sub") {
      out.push(
        <div key={`r${row.line}`} className={`fd-block fd-${row.kind} ${dropCls}`} {...dragProps(row.line)}>
          <span className="fd-grip" aria-hidden>⠿</span>
          <input
            key={`ri${row.line}`}
            className={row.kind === "section" ? "fd-section" : "fd-sub"}
            defaultValue={row.label}
            placeholder={row.kind === "section" ? "Section heading" : "Subsection"}
            onChange={(e) => editLabel(row.line, e.target.value)}
          />
          <button type="button" className="fd-x" onClick={() => del(row.line)} aria-label="Delete">✕</button>
        </div>,
      );
    } else {
      out.push(
        <div key={`r${row.line}`} className={`fd-block fd-text ${dropCls}`} {...dragProps(row.line)}>
          <span className="fd-grip" aria-hidden>⠿</span>
          <textarea
            key={`ri${row.line}`}
            className="fd-desc"
            rows={1}
            defaultValue={row.label}
            placeholder="Description / instructions"
            onChange={(e) => editLabel(row.line, e.target.value)}
          />
          <button type="button" className="fd-x" onClick={() => del(row.line)} aria-label="Delete">✕</button>
        </div>,
      );
    }
  }

  return (
    <div className="fd-scroll">
      <div className="fd-sheet">
        {titleRow ? (
          <input
            key={`title${titleRow.line}`}
            className="fd-title"
            defaultValue={titleRow.label}
            placeholder="Form title"
            onChange={(e) => editLabel(titleRow.line, e.target.value)}
            aria-label="Form title"
          />
        ) : (
          <button type="button" className="fd-add-title" onClick={addTitle}>
            + Add a title
          </button>
        )}

        {out.length === 0 && (
          <p className="fd-empty">Add fields, sections, and descriptions below to build your form.</p>
        )}
        {out}

        <div className="fd-addbar">
          <span className="fd-addbar__label">Add field</span>
          <div className="fd-addbar__grid">
            {FIELD_PALETTE.map((d) => (
              <button
                key={d.type + d.label}
                type="button"
                className="fd-add"
                onClick={() => addField(d.type, d.label, d.options)}
                title={`Add a ${d.title.toLowerCase()} field`}
              >
                <span aria-hidden>{d.icon}</span> {d.title}
              </button>
            ))}
          </div>
          <div className="fd-addbar__row">
            <button type="button" className="fd-add fd-add--alt" onClick={addSection}>＋ Section</button>
            <button type="button" className="fd-add fd-add--alt" onClick={addDescription}>＋ Description</button>
          </div>
        </div>
      </div>
    </div>
  );
}
