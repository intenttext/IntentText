/**
 * jadwal-workbench.tsx — a runnable reference for embedding @dotit/editor in an ERP
 * dashboard (e.g. Jadwal). Copy it into your app, swap the `db` stubs for your real
 * persistence, and route to <JadwalWorkbench> from a dashboard page.
 *
 * It shows the full lifecycle on ONE component:
 *   build a template/form  →  send  →  recipient fills  →  seal  →  store + query.
 *
 *   npm install @dotit/editor @dotit/core
 *   import "@dotit/editor/style.css"   // once, app-wide
 */
import { useState } from "react";
import {
  IntentTextWorkbench,
  type WorkbenchMode,
  // intent-named aliases also available:
  // TemplateEditor, FormDesigner, FormFiller, DocViewer
} from "@dotit/editor";
import {
  isForm,
  isFormComplete,
  formAnswers,
  sealDocument,
  verifyDocument,
  parseAndMerge,
  documentToSource,
} from "@dotit/core";
import "@dotit/editor/style.css";

// ── your ERP wiring (stubs) ──────────────────────────────────────────────────
const db = {
  save: (id: string, it: string) => localStorage.setItem(`it:${id}`, it),
  load: (id: string) => localStorage.getItem(`it:${id}`) ?? "",
  indexAnswers: (id: string, a: Record<string, string>) =>
    console.log("index", id, a),
};

const STARTER_FORM = `meta: | type: form
title: Vendor Onboarding
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA, AE | required: yes
input: Notes | key: notes | type: textarea`;

export function JadwalWorkbench({ docId = "demo" }: { docId?: string }) {
  const [src, setSrc] = useState(() => db.load(docId) || STARTER_FORM);
  const [mode, setMode] = useState<WorkbenchMode>("auto");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* your dashboard chrome — a mode switch + a save button */}
      <div style={{ display: "flex", gap: 8, padding: 8, borderBottom: "1px solid #ddd" }}>
        {(["edit", "fill", "review", "view", "auto"] as WorkbenchMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} disabled={m === mode}>
            {m}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => db.save(docId, src)}>Save</button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <IntentTextWorkbench
          value={src}
          onChange={setSrc}
          mode={mode}
          theme="corporate"
          // a recipient submitted a COMPLETE form → seal it as a final record
          onSubmit={(completed) => {
            if (!isFormComplete(completed)) return;
            const sealed = sealDocument(completed, { signer: "Jadwal" }).source;
            db.save(docId, sealed);
            db.indexAnswers(docId, formAnswers(sealed)); // queryable by field key
            setSrc(sealed);
          }}
          // ribbon Seal/Sign/Verify intent → wire to your dialogs / the UTS service
          onTrustAction={(action) => {
            if (action.kind === "verify") {
              const r = verifyDocument(src);
              alert(r.intact ? "Verified — intact" : "FAILED verification");
            }
          }}
        />
      </div>
    </div>
  );
}

// Generate a final document FROM a Jadwal template + record data (no UI needed):
export function renderFromTemplate(templateIt: string, data: object): string {
  return documentToSource(parseAndMerge(templateIt, data));
}

// Decide a default landing mode from the document itself.
export function defaultModeFor(it: string): WorkbenchMode {
  return isForm(it) ? "fill" : "edit";
}
