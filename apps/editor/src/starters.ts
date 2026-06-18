// Starter documents for File ▸ New — a blank page, a fillable FORM, and a merge
// TEMPLATE. These make creating forms/templates a first-class, one-click action
// instead of "remember the meta marker and field syntax".

// File ▸ New ▸ Document — a blank page (not the welcome/demo content).
export const BLANK_DOC = "title: ";

// File ▸ New ▸ Form — a `meta: type: form` document whose `input:` lines are
// fillable fields. Opens in DESIGN so you can shape it, then switch to FILL to test.
export const FORM_STARTER = `title: New Form
meta: | type: form
summary: Describe what this form is for.

section: Applicant
input: Full name | key: name | type: text | required: true
input: Email | key: email | type: text | required: true
input: Department | key: department | type: choice | options: Engineering, Sales, Finance, Operations

section: Request
input: Start date | key: start_date | type: date | required: true
input: Details | key: details | type: textarea

text: Add a field with a line like \`input: Label | type: text | required: true\`. Switch to Fill to try it; a complete form can be signed.
`;

// File ▸ New ▸ Template — a merge template: `{{path.to.value}}` placeholders that
// Template & merge (or Preview) fills with data. Opens in EDIT.
export const TEMPLATE_STARTER = `page: | size: A4
header: {{company.name}}
footer: {{document.reference}} · Page {{page}} of {{pages}}

title: {{document.title}}
summary: {{company.name}} → {{recipient.name}}
meta: | type: template | date: {{document.date}}

section: {{section.heading}}
text: Dear {{recipient.name}},
text: {{body}}

section: Details
| Item | Amount | each: items |
| {{item.label}} | {{item.amount}} |

text: Regards,
text: {{sender.name}} — {{sender.role}}
`;

/** Humanize a dotted variable path into a readable placeholder: "company.name" →
 *  "Company Name". Used to give the template Preview lifelike sample values. */
function humanize(path: string): string {
  return path
    .split(".")
    .map((seg) =>
      seg
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(" ");
}

/**
 * Build lifelike sample data for the template Preview: every leaf variable gets a
 * humanized placeholder (so the merged doc reads like a real document rather than a
 * grid of blanks). `each:` loop bindings (`item.*`) are left unmerged — the row
 * template stays visible — since a generic array can't be inferred from a path.
 */
export function buildPreviewData(vars: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const path of vars) {
    if (path.startsWith("item.")) continue; // loop binding — keep the row template
    const parts = path.split(".");
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        if (!(p in cur)) cur[p] = humanize(path);
      } else {
        if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
    }
  }
  return root;
}
