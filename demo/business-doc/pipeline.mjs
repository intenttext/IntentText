// Demo 1 — template → merge → render → sign → verify → query
//
// The whole pipeline that normally needs a template engine + a PDF library + a
// signing vendor + a database query layer, in one file, with one dependency:
// @dotit/core. Run:  node demo/business-doc/pipeline.mjs
//
// (From a checkout, the import below resolves to the local core build. In a real
//  app it's just: import { ... } from "@dotit/core";)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseAndMerge,
  documentToSource,
  renderHTML,
  sealDocument,
  verifyDocument,
  parseIntentText,
  queryBlocks,
} from "../../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, f), "utf8");
const write = (f, s) => writeFileSync(join(here, f), s);
const rule = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ── 1. Template (stored once) + data (one DB row) ──────────────────────────
const template = read("invoice-template.it");
const data = JSON.parse(read("invoice-data.json"));

// ── 2. Merge: fill the template, expanding the `each: items` table to N rows ─
rule("① MERGE  template + data → finished document");
const doc = parseAndMerge(template, data);
const findByType = (blocks, type) => {
  for (const b of blocks ?? []) {
    if (b.type === type) return b;
    const inner = findByType(b.children, type);
    if (inner) return inner;
  }
  return undefined;
};
console.log(`   ${doc.metadata.title}  ·  ${doc.blocks.length} typed blocks`);
const lineItems = findByType(doc.blocks, "table");
console.log(`   line items expanded to ${lineItems?.table?.rows.length} rows`);

// ── 3. Render: the finished doc → standalone HTML (print to PDF as-is) ───────
rule("② RENDER  document → HTML (no PDF library)");
const html = renderHTML(doc, { standalone: true, theme: "corporate" });
write("out.invoice.html", html);
console.log(`   wrote out.invoice.html (${html.length.toLocaleString()} bytes)`);

// ── 4. Sign + seal: freeze the content with a tamper-evident hash ───────────
rule("③ SIGN + SEAL  freeze with a content hash");
const finishedSource = documentToSource(doc);
const sealed = sealDocument(finishedSource, {
  signer: "Dalil Billing",
  role: "Finance",
});
write("out.invoice.signed.it", sealed.source);
console.log(`   sealed by Dalil Billing · ${sealed.hash}`);

// ── 5. Verify: prove the sealed document is intact ──────────────────────────
rule("④ VERIFY  recompute the hash and check integrity");
const ok = verifyDocument(sealed.source);
console.log(`   intact: ${ok.intact ? "✓ yes" : "✗ NO"}   frozen: ${ok.frozen}`);
console.log(`   signer ${ok.signers?.[0]?.signer} valid: ${ok.signers?.[0]?.valid}`);

// Tamper check — change one character and verify fails.
const tampered = sealed.source.replace("17,325 QAR", "1,325 QAR");
console.log(
  `   tamper test (alter the total): intact = ${verifyDocument(tampered).intact ? "✓ (bug!)" : "✗ detected"}`,
);

// ── 6. Query: ask the document questions by parameter, not full-text ────────
rule("⑤ QUERY  search by meaning, not by string match");
const signed = parseIntentText(sealed.source, { includeHistorySection: true });
const metrics = queryBlocks(signed, "type=metric");
console.log(`   metrics: ${metrics.blocks.map((m) => m.content).join(", ")}`);
const deadlines = queryBlocks(signed, "type=deadline");
console.log(
  `   deadlines: ${deadlines.blocks.map((d) => `${d.content} (${d.properties?.date})`).join(", ")}`,
);
const contacts = queryBlocks(signed, "type=contact");
console.log(`   contacts: ${contacts.blocks.map((c) => c.content).join(", ")}`);

rule("Done — one template, one data row, one dependency.");
console.log("   out.invoice.html         — render/print");
console.log("   out.invoice.signed.it    — signed, verifiable, queryable\n");
