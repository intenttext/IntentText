// FormFill — fill an IntentText form (the recipient experience).
//
// It renders the document through core's renderPrint (so fields appear as the real
// boxes/lines they print as) and HYDRATES each field into a live control. Answers
// are collected as you type; "Save" writes them back into the `.it` source via
// applyAnswers. A live counter shows required fields remaining, and the form
// reports `complete` so the host can enable signing — a complete form is a final,
// signable record (see core forms.ts / template.ts).

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  parseIntentText,
  renderPrint,
  extractFormFields,
  applyAnswers,
  isFormComplete,
  missingRequiredFields,
  formVisibility,
  computeFormValues,
  addAttachment,
  getAttachment,
  attachmentDataUri,
  MAX_EMBED_BYTES,
  type FormField,
  type Attachment,
} from "@dotit/core";

export interface FormFillProps {
  /** The `.it` form source. */
  value: string;
  /** Theme name. */
  theme?: string;
  /** Called with the updated source when the user saves their answers. */
  onChange?: (source: string) => void;
  /** Called when the user submits a COMPLETE form (all required filled). */
  onSubmit?: (source: string) => void;
  /** Render answers but don't allow editing. */
  readOnly?: boolean;
}

interface Extracted {
  styles: string;
  body: string;
  bodyClass: string;
}

function extractPrint(source: string, theme: string): Extracted {
  let html: string;
  try {
    html = renderPrint(parseIntentText(source), { theme });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      styles: "",
      body: `<p style="color:#b91c1c">Could not render: ${msg}</p>`,
      bodyClass: "",
    };
  }
  const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n")
    .replace(/body\.it-print/g, ".form-fill-page");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const bodyClass = (html.match(/<body[^>]*class="([^"]*)"/i)?.[1] ?? "").trim();
  return { styles, body, bodyClass };
}

const TRUTHY = /^(yes|true|on|1|checked|x)$/i;

export function FormFill({
  value,
  theme = "corporate",
  onChange,
  onSubmit,
  readOnly = false,
}: FormFillProps) {
  const fields = useMemo(() => extractFormFields(value), [value]);
  const { styles, body, bodyClass } = useMemo(
    () => extractPrint(value, theme),
    [value, theme],
  );
  const pageRef = useRef<HTMLDivElement>(null);
  // Live answers, seeded from the source. A ref so per-keystroke edits don't
  // re-render the document (which would blur the field); React state only tracks
  // the completeness summary.
  const answers = useRef<Record<string, string>>({});
  // Files the recipient attached this session (key → Attachment), embedded into the
  // source on save. The field's `value:` holds the filename; the bytes live here.
  const pendingAttachments = useRef<Record<string, Attachment>>({});
  const [remaining, setRemaining] = useState<string[]>([]);
  const [savedNote, setSavedNote] = useState(false);

  // Re-evaluate conditional (show-if) + computed (compute) fields against the live
  // answers and reflect them in the DOM: hide fields whose condition is false, and
  // fill computed fields read-only. Runs after hydration and on every edit, so a
  // field appears the moment its trigger is answered and totals update live.
  const recompute = useCallback(() => {
    // 1) fold in computed values so they participate in visibility + completeness
    let merged = applyAnswers(value, answers.current);
    const computed = computeFormValues(merged);
    for (const [k, v] of Object.entries(computed)) answers.current[k] = v;
    merged = applyAnswers(value, answers.current);

    const vis = formVisibility(merged);
    const root = pageRef.current;
    if (root) {
      for (const node of root.querySelectorAll<HTMLElement>("[data-key]")) {
        const key = node.dataset.key || "";
        if (key in vis) node.style.display = vis[key] ? "" : "none";
        if (key in computed) {
          const ctrl = node.querySelector<HTMLInputElement>("input, textarea, select");
          if (ctrl) {
            if (ctrl.value !== computed[key]) ctrl.value = computed[key];
            ctrl.disabled = true; // derived, not hand-edited
          }
        }
      }
    }
    setRemaining(missingRequiredFields(merged));
  }, [value]);

  // Hydrate the rendered field boxes into live controls.
  useLayoutEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    answers.current = Object.fromEntries(fields.map((f) => [f.key, f.value]));
    pendingAttachments.current = {};

    const byKey = new Map<string, FormField>(fields.map((f) => [f.key, f]));
    const cleanups: Array<() => void> = [];

    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-key]"),
    );
    for (const node of nodes) {
      const key = node.dataset.key || "";
      const field = byKey.get(key);
      if (!field) continue;
      const type = (node.dataset.type || field.type || "text").toLowerCase();

      // Checkbox: toggle the box on click.
      if (node.classList.contains("it-field-checkbox")) {
        const box = node.querySelector<HTMLElement>(".it-field-check");
        const sync = () => {
          if (box) box.classList.toggle("checked", TRUTHY.test(answers.current[key] || ""));
        };
        sync();
        if (!readOnly) {
          const onClick = () => {
            const next = !TRUTHY.test(answers.current[key] || "");
            answers.current[key] = next ? "yes" : "no";
            sync();
            recompute();
          };
          node.style.cursor = "pointer";
          node.addEventListener("click", onClick);
          cleanups.push(() => node.removeEventListener("click", onClick));
        }
        continue;
      }

      // The control replaces the box (block) or the inline span.
      const isInline = node.classList.contains("it-field-inline");

      // Attachment: a file picker → embeds the chosen file (capped) and shows a
      // download chip. Reference (href) uploads are the host's job; this captures
      // small files inline so a form can travel self-contained.
      if (type === "attachment") {
        const box = isInline ? node : node.querySelector<HTMLElement>(".it-field-box");
        if (!box) continue;
        const file = document.createElement("input");
        file.type = "file";
        file.style.display = "none";
        box.appendChild(file);

        const draw = () => {
          // wipe everything except the hidden input
          Array.from(box.childNodes).forEach((n) => {
            if (n !== file) box.removeChild(n);
          });
          const name = answers.current[key] || "";
          if (name) {
            const att = pendingAttachments.current[key] ?? getAttachment(value, key);
            const uri = att ? attachmentDataUri(att) : null;
            const link = document.createElement(uri ? "a" : "span");
            link.className = "form-fill-attach-name";
            link.textContent = name;
            if (uri) {
              (link as HTMLAnchorElement).href = uri;
              (link as HTMLAnchorElement).download = name;
            }
            box.appendChild(link);
            if (!readOnly) {
              const clear = document.createElement("button");
              clear.type = "button";
              clear.className = "form-fill-attach-clear";
              clear.textContent = "✕";
              clear.title = "Remove";
              clear.onclick = () => {
                delete pendingAttachments.current[key];
                answers.current[key] = "";
                setSavedNote(false);
                draw();
                recompute();
              };
              box.appendChild(clear);
            }
          } else if (!readOnly) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "form-fill-attach-btn";
            btn.textContent = "Attach file…";
            btn.onclick = () => file.click();
            box.appendChild(btn);
          } else {
            box.appendChild(document.createTextNode("—"));
          }
        };

        if (!readOnly) {
          const onPick = () => {
            const f = file.files?.[0];
            if (!f) return;
            if (f.size > MAX_EMBED_BYTES) {
              alert(
                `"${f.name}" is ${Math.round(f.size / 1024)} KiB — over the ${Math.round(MAX_EMBED_BYTES / 1024)} KiB embed limit. Use a smaller file (large files should be linked, not embedded).`,
              );
              file.value = "";
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = String(reader.result).split(",")[1] ?? "";
              pendingAttachments.current[key] = {
                key,
                name: f.name,
                mime: f.type || "application/octet-stream",
                size: f.size,
                data: b64,
              };
              answers.current[key] = f.name;
              file.value = "";
              setSavedNote(false);
              draw();
              recompute();
            };
            reader.readAsDataURL(f);
          };
          file.addEventListener("change", onPick);
          cleanups.push(() => file.removeEventListener("change", onPick));
        }
        draw();
        continue;
      }

      const box = isInline
        ? node
        : node.querySelector<HTMLElement>(".it-field-box");
      if (!box) continue;

      let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (type === "choice" && field.options.length) {
        const sel = document.createElement("select");
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "—";
        sel.appendChild(blank);
        for (const opt of field.options) {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        }
        control = sel;
      } else if (type === "textarea") {
        control = document.createElement("textarea");
        (control as HTMLTextAreaElement).rows = 3;
      } else {
        const input = document.createElement("input");
        input.type =
          type === "date" ? "date" : type === "number" ? "number" : "text";
        control = input;
      }
      control.value = answers.current[key] || "";
      control.className = "form-fill-control";
      if (readOnly) control.disabled = true;
      box.textContent = "";
      box.appendChild(control);

      const onInput = () => {
        answers.current[key] = control.value;
        setSavedNote(false);
        recompute();
      };
      control.addEventListener("input", onInput);
      control.addEventListener("change", onInput);
      cleanups.push(() => {
        control.removeEventListener("input", onInput);
        control.removeEventListener("change", onInput);
      });
    }

    recompute();
    return () => cleanups.forEach((fn) => fn());
  }, [body, fields, readOnly, recompute]);

  // Apply text answers, then embed every file attached this session.
  const mergedSource = useCallback(() => {
    let merged = applyAnswers(value, answers.current);
    for (const att of Object.values(pendingAttachments.current)) {
      try {
        merged = addAttachment(merged, att);
      } catch {
        /* over the embed cap — already blocked at pick time; skip defensively */
      }
    }
    return merged;
  }, [value]);

  const save = useCallback(() => {
    onChange?.(mergedSource());
    setSavedNote(true);
  }, [onChange, mergedSource]);

  const submit = useCallback(() => {
    const merged = mergedSource();
    onChange?.(merged);
    if (isFormComplete(merged)) onSubmit?.(merged);
  }, [onChange, onSubmit, mergedSource]);

  const total = fields.filter((f) => f.required).length;
  const done = total - remaining.length;
  const complete = remaining.length === 0;

  return (
    <div className="form-fill">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="form-fill-scroll">
        <div className={`form-fill-page ${bodyClass}`}>
          <div ref={pageRef} dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      </div>
      {!readOnly && (
        <div className="form-fill-bar">
          <span className="form-fill-status">
            {total === 0
              ? `${fields.length} field${fields.length === 1 ? "" : "s"}`
              : complete
                ? "All required fields complete"
                : `${done} / ${total} required filled`}
            {savedNote && <span className="form-fill-saved"> · Saved</span>}
          </span>
          <span className="form-fill-actions">
            <button className="form-fill-btn" onClick={save}>
              Save
            </button>
            <button
              className="form-fill-btn primary"
              onClick={submit}
              disabled={!complete}
              title={
                complete
                  ? "Submit — the completed form can now be signed"
                  : "Fill all required fields to submit"
              }
            >
              Submit
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
