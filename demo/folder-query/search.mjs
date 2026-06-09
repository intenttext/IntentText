// Demo 2 — query a folder of .it documents by parameter, not full text
//
// Point at a directory of mixed business documents (invoices, a contract, meeting
// notes, a quote) and ask structured questions across ALL of them — no grep, no
// database, no schema migration. The files ARE the database.
//
//   node demo/folder-query/search.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseIntentText,
  buildShallowIndex,
  composeIndexes,
  queryComposed,
} from "../../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "docs");
const TODAY = "2026-03-10"; // fixed "now" so the demo is deterministic
const rule = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ── 1. Index the folder (parse every .it file once) ─────────────────────────
const files = {};
for (const name of readdirSync(docsDir)) {
  if (!name.endsWith(".it")) continue;
  const source = readFileSync(join(docsDir, name), "utf8");
  files[name] = {
    source,
    doc: parseIntentText(source),
    modifiedAt: statSync(join(docsDir, name)).mtime.toISOString(),
  };
}
const index = buildShallowIndex("docs", files, "4.1.0");
const all = composeIndexes([index], "docs");
console.log(
  `Indexed ${Object.keys(files).length} .it files → ${all.length} blocks queryable.`,
);

const fileName = (r) => r.file.replace(/^docs\//, "");
const prop = (r, k) => r.block.properties?.[k];

// ── 2. Cross-document queries by typed field ────────────────────────────────

rule("Q1  Every payment deadline across all documents (sorted by date)");
queryComposed(all, { type: "deadline" })
  .sort((a, b) => String(prop(a, "date")).localeCompare(String(prop(b, "date"))))
  .forEach((r) =>
    console.log(
      `   ${prop(r, "date")}  ${r.block.content.padEnd(16)}  ${fileName(r)}`,
    ),
  );

rule(`Q2  Overdue deadlines (date < ${TODAY}) — the kind of question grep can't answer`);
queryComposed(all, { type: "deadline" })
  .filter((r) => String(prop(r, "date")) < TODAY)
  .forEach((r) =>
    console.log(`   OVERDUE ${prop(r, "date")}  ${fileName(r)}  (${r.block.content})`),
  );

rule("Q3  Every signature on file — who signed what, when");
queryComposed(all, { type: "sign" }).forEach((r) =>
  console.log(
    `   ${r.block.content.padEnd(12)} ${String(prop(r, "role")).padEnd(18)} ${prop(r, "at")}  ${fileName(r)}`,
  ),
);

rule("Q4  All high-priority tasks across every document, by owner");
queryComposed(all, { type: "task" })
  .filter((r) => prop(r, "priority") === "high")
  .forEach((r) =>
    console.log(
      `   ${String(prop(r, "owner")).padEnd(8)} ${r.block.content.padEnd(22)} due ${prop(r, "due")}  ${fileName(r)}`,
    ),
  );

rule("Q5  Unpaid receivables — document-level metadata query (status = Unpaid)");
const unpaid = new Set(
  Object.entries(index.files)
    .filter(([, entry]) => entry.metadata.status === "Unpaid")
    .map(([name]) => name),
);
queryComposed(all, { type: "metric" })
  .filter((r) => unpaid.has(fileName(r)))
  .forEach((r) =>
    console.log(`   ${r.block.content}: ${prop(r, "value")}  ${fileName(r)}`),
  );

rule("Done — five structured questions answered across a folder, zero database.");
console.log("   Each answer is a query by meaning (type, date, status, owner),");
console.log("   not a full-text string match.\n");
