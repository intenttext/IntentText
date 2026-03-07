#!/usr/bin/env node

const {
  parseIntentText,
  renderHTML,
  renderPrint,
  mergeData,
  convertMarkdownToIntentText,
  convertHtmlToIntentText,
  queryBlocks,
  formatQueryResult,
  validateDocument,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
  sealDocument,
  verifyDocument,
  computeDocumentHash,
  listBuiltinThemes,
  getBuiltinTheme,
  buildShallowIndex,
  buildIndexEntry,
  checkStaleness,
  updateIndex,
  composeIndexes,
  queryComposed,
  formatTable,
  formatJSON,
  formatCSV,
  serializeContext,
  findHistoryBoundaryInSource,
} = require("./packages/core/dist");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { glob } = require("fs");

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🚀 IntentText CLI v2.12.1

Usage:
  node cli.js <file.it>                     Parse and show JSON
  node cli.js <file.it> --html              Generate HTML output
  node cli.js <file.it> --output            Save HTML to file
  node cli.js <file.md> --to-it             Convert Markdown to .it
  node cli.js <file.html> --to-it           Convert HTML to .it
  node cli.js <file> --to-it --output       Save converted .it next to source
  node cli.js <file.it> --query "..."       Query blocks
  node cli.js <file.it> --validate <schema> Validate against schema

Template / Document Generation:
  node cli.js <file.it> --data data.json              Merge and show JSON
  node cli.js <file.it> --data data.json --html        Merge and render HTML
  node cli.js <file.it> --data data.json --print       Merge and render print HTML
  node cli.js <file.it> --data data.json --pdf         Merge and save as PDF (requires puppeteer)

Themes (v2.10):
  node cli.js <file.it> --html --theme corporate       Render with theme
  node cli.js <file.it> --print --theme minimal         Print with theme
  node cli.js theme list                                List built-in themes
  node cli.js theme info <name>                         Show theme metadata

Query (v2.10):
  node cli.js query <dir> --type task                   Query a directory
  node cli.js query "docs/*.it" --type sign             Query a glob pattern
  node cli.js query <dir> --type task --format table    Table output (default)
  node cli.js query <dir> --type task --format json     JSON output
  node cli.js query <dir> --type task --format csv      CSV output

Index (v2.10):
  node cli.js index <dir>                               Build shallow index
  node cli.js index <dir> --recursive                   Build indexes in all subfolders

Natural Language Query (v2.10):
  node cli.js ask <dir> "question"                      Ask about documents
  node cli.js ask <dir> "question" --format json        Ask with JSON output

Document Trust (v2.8):
  node cli.js seal <file.it> --signer "Name" --role "Role"   Seal document
  node cli.js verify <file.it>                                 Verify integrity
  node cli.js history <file.it>                                Show history
  node cli.js history <file.it> --json                         History as JSON
  node cli.js history <file.it> --by "Ahmed"                   Filter by author
  node cli.js history <file.it> --section "Scope"              Filter by section

Amendment (v2.11):
  node cli.js amend <file.it> --section "Payment" --was "30 days" --now "15 days" --ref "Amendment #1"
  node cli.js amend <file.it> --section "Scope" --now "Includes Phase 2" --ref "Amendment #2" --by "Ahmed"

Query examples:
  node cli.js todo.it --query "type=task owner=Ahmed"
  node cli.js project.it --query "type=task due<2026-03-01 sort:due:asc limit:10"

Validation:
  node cli.js project.it --validate project
  node cli.js article.it --validate article

Available schemas: ${Object.keys(PREDEFINED_SCHEMAS).join(", ")}
Built-in themes: ${listBuiltinThemes().join(", ")}
`);
    return;
  }

  const inputFile = args[0];

  // v2.10: Theme commands
  if (inputFile === "theme") {
    const subCmd = args[1];
    if (subCmd === "list") {
      const themes = listBuiltinThemes();
      console.log("Built-in themes:");
      for (const name of themes) {
        const t = getBuiltinTheme(name);
        console.log(`  ${name.padEnd(12)} ${t?.description || ""}`);
      }
      return;
    }
    if (subCmd === "info") {
      const name = args[2];
      if (!name) {
        console.error("❌ Missing theme name");
        process.exit(1);
      }
      const t = getBuiltinTheme(name);
      if (!t) {
        console.error(`❌ Theme not found: ${name}`);
        process.exit(1);
      }
      console.log(`Theme: ${t.name} v${t.version}`);
      console.log(`Description: ${t.description || ""}`);
      console.log(`Author: ${t.author || ""}`);
      console.log(
        `Fonts: body=${t.fonts.body}, heading=${t.fonts.heading}, mono=${t.fonts.mono}`,
      );
      console.log(`Size: ${t.fonts.size}, Leading: ${t.fonts.leading}`);
      console.log(
        `Colors: text=${t.colors.text}, accent=${t.colors.accent}, bg=${t.colors.background}`,
      );
      return;
    }
    console.error(
      "❌ Unknown theme command. Use: theme list | theme info <name>",
    );
    process.exit(1);
  }

  // v2.10: Folder / glob query command
  if (inputFile === "query") {
    const target = args[1];
    if (!target) {
      console.error("❌ Missing directory or glob argument");
      process.exit(1);
    }
    const typeFilter =
      args.indexOf("--type") >= 0 ? args[args.indexOf("--type") + 1] : null;
    const byFilter =
      args.indexOf("--by") >= 0 ? args[args.indexOf("--by") + 1] : null;
    const statusFilter =
      args.indexOf("--status") >= 0 ? args[args.indexOf("--status") + 1] : null;
    const sectionFilter =
      args.indexOf("--section") >= 0
        ? args[args.indexOf("--section") + 1]
        : null;
    const contentFilter =
      args.indexOf("--content") >= 0
        ? args[args.indexOf("--content") + 1]
        : null;
    const formatIdx = args.indexOf("--format");
    const fmt = formatIdx >= 0 ? args[formatIdx + 1] : "table";

    // Resolve files
    const itFiles = resolveItFiles(target);
    if (itFiles.length === 0) {
      console.log("No .it files found.");
      return;
    }

    // Try to use indexes, fall back to direct parse
    const composed = [];
    for (const filePath of itFiles) {
      const source = fs.readFileSync(filePath, "utf-8");
      const doc = parseIntentText(source);
      const relPath = path.relative(process.cwd(), filePath);
      const entry = buildIndexEntry(doc, source, new Date().toISOString());
      for (const block of entry.blocks) {
        composed.push({ file: relPath, block });
      }
    }

    // Apply filters
    const filtered = queryComposed(composed, {
      type: typeFilter || undefined,
      content: contentFilter || undefined,
      by: byFilter || undefined,
      status: statusFilter || undefined,
      section: sectionFilter || undefined,
    });

    if (fmt === "json") console.log(formatJSON(filtered));
    else if (fmt === "csv") console.log(formatCSV(filtered));
    else console.log(formatTable(filtered));
    return;
  }

  // v2.10: Index command
  if (inputFile === "index") {
    const target = args[1];
    if (!target) {
      console.error("❌ Missing directory argument");
      process.exit(1);
    }
    const recursive = args.includes("--recursive");
    const resolvedTarget = path.resolve(target);

    if (
      !fs.existsSync(resolvedTarget) ||
      !fs.statSync(resolvedTarget).isDirectory()
    ) {
      console.error(`❌ Not a directory: ${target}`);
      process.exit(1);
    }

    if (recursive) {
      buildIndexRecursive(resolvedTarget);
    } else {
      buildIndexForFolder(resolvedTarget);
    }
    return;
  }

  // v2.10: Ask command (natural language query)
  if (inputFile === "ask") {
    const target = args[1];
    const question = args[2];
    if (!target || !question) {
      console.error('❌ Usage: intenttext ask <dir> "question"');
      process.exit(1);
    }

    const itFiles = resolveItFiles(target);
    if (itFiles.length === 0) {
      console.log("No .it files found.");
      return;
    }

    const composed = [];
    for (const filePath of itFiles) {
      const source = fs.readFileSync(filePath, "utf-8");
      const doc = parseIntentText(source);
      const relPath = path.relative(process.cwd(), filePath);
      const entry = buildIndexEntry(doc, source, new Date().toISOString());
      for (const block of entry.blocks) {
        composed.push({ file: relPath, block });
      }
    }

    // Dynamic import for ask module (async)
    const { askDocuments } = require("./packages/core/dist");
    const formatIdx = args.indexOf("--format");
    const fmt = formatIdx >= 0 ? args[formatIdx + 1] : "text";
    askDocuments(composed, question, {
      format: fmt === "json" ? "json" : "text",
    })
      .then((answer) => console.log(answer))
      .catch((err) => {
        console.error(`❌ ${err.message}`);
        process.exit(1);
      });
    return;
  }

  // v2.8: Trust commands (seal, verify, history)
  if (
    inputFile === "seal" ||
    inputFile === "verify" ||
    inputFile === "history"
  ) {
    const trustCommand = inputFile;
    const targetFile = args[1];

    if (!targetFile) {
      console.error(`❌ Missing file argument for ${trustCommand} command`);
      process.exit(1);
    }

    if (!fs.existsSync(targetFile)) {
      console.error(`❌ File not found: ${targetFile}`);
      process.exit(1);
    }

    const source = fs.readFileSync(targetFile, "utf-8");

    if (trustCommand === "seal") {
      const signerIdx = args.indexOf("--signer");
      const signer = signerIdx >= 0 ? args[signerIdx + 1] : null;
      const roleIdx = args.indexOf("--role");
      const role = roleIdx >= 0 ? args[roleIdx + 1] : undefined;
      const skipSign = args.includes("--no-sign");

      if (!signer && !skipSign) {
        console.error(
          "❌ --signer is required for seal command (or use --no-sign)",
        );
        process.exit(1);
      }

      const result = sealDocument(source, {
        signer: signer || "",
        role,
        skipSign,
      });

      if (result.success) {
        fs.writeFileSync(targetFile, result.source);
        console.log("✅  Document sealed");
        if (signer)
          console.log(`    Signer:   ${signer}${role ? ` (${role})` : ""}`);
        console.log(`    Hash:     ${result.hash}`);
        console.log(`    Frozen:   ${result.at}`);
      } else {
        console.error(`❌ Seal failed: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    if (trustCommand === "verify") {
      const result = verifyDocument(source);

      if (!result.frozen) {
        console.log("⚠️  Document is not sealed. No freeze: block found.");
        return;
      }

      if (result.intact) {
        console.log("✅  Document intact");
        console.log(`    Sealed:   ${result.frozenAt}`);
        if (result.signers && result.signers.length > 0) {
          console.log(
            "    Signers:  " +
              result.signers
                .map(
                  (s) =>
                    `${s.signer}${s.role ? ` (${s.role})` : ""} ${s.valid ? "✅" : "❌"}`,
                )
                .join("\n              "),
          );
        }
        console.log(`    Hash:     ${result.hash} ✅ matches`);
        // v2.11: Report amendment count
        const doc = parseIntentText(source);
        const amendments = doc.blocks.filter((b) => b.type === "amendment");
        if (amendments.length > 0) {
          console.log(`    Amendments: ${amendments.length}`);
        }
      } else {
        console.log("❌  Document has been modified since sealing");
        console.log(`    Sealed:   ${result.frozenAt}`);
        console.log(`    Expected: ${result.expectedHash}`);
        console.log(`    Current:  ${result.hash}`);
        if (result.signers && result.signers.length > 0) {
          console.log(
            "    Signers:  " +
              result.signers
                .map(
                  (s) =>
                    `${s.signer}${s.role ? ` (${s.role})` : ""} ${s.valid ? "✅" : "❌ signature invalid"}`,
                )
                .join("\n              "),
          );
        }
        process.exit(1);
      }
      return;
    }

    if (trustCommand === "history") {
      const doc = parseIntentText(source, { includeHistorySection: true });
      const jsonMode = args.includes("--json");
      const byFilter =
        args.indexOf("--by") >= 0 ? args[args.indexOf("--by") + 1] : null;
      const sectionFilter =
        args.indexOf("--section") >= 0
          ? args[args.indexOf("--section") + 1]
          : null;
      const blockFilter =
        args.indexOf("--block") >= 0 ? args[args.indexOf("--block") + 1] : null;

      if (!doc.history || doc.history.revisions.length === 0) {
        console.log("No history found. Document may not be tracked.");
        return;
      }

      let revisions = doc.history.revisions;
      if (byFilter) revisions = revisions.filter((r) => r.by === byFilter);
      if (sectionFilter)
        revisions = revisions.filter((r) => r.section === sectionFilter);
      if (blockFilter)
        revisions = revisions.filter((r) => r.id === blockFilter);

      if (jsonMode) {
        console.log(
          JSON.stringify(
            { revisions, registry: doc.history.registry },
            null,
            2,
          ),
        );
      } else {
        for (const r of revisions) {
          const date = r.at ? r.at.slice(0, 10) : "";
          const detail =
            r.change === "modified"
              ? `"${(r.was || "").slice(0, 30)}" → "${(r.now || "").slice(0, 30)}"`
              : r.change === "added"
                ? (r.now || "").slice(0, 50)
                : r.change === "removed"
                  ? (r.was || "").slice(0, 50)
                  : `${r.wasSection || ""} → ${r.nowSection || ""}`;
          console.log(
            `  ${r.version.padEnd(5)} ${date}  ${(r.by || "").padEnd(10)} [${r.change.padEnd(8)}] ${(r.block || "").padEnd(10)} ${r.section ? r.section + " › " : ""}${detail}`,
          );
        }
      }
      return;
    }
  }

  // v2.11: Amend command
  if (inputFile === "amend") {
    const targetFile = args[1];
    if (!targetFile) {
      console.error("❌ Missing file argument for amend command");
      process.exit(1);
    }
    if (!fs.existsSync(targetFile)) {
      console.error(`❌ File not found: ${targetFile}`);
      process.exit(1);
    }

    const sectionIdx = args.indexOf("--section");
    const section = sectionIdx >= 0 ? args[sectionIdx + 1] : null;
    const wasIdx = args.indexOf("--was");
    const was = wasIdx >= 0 ? args[wasIdx + 1] : null;
    const nowIdx = args.indexOf("--now");
    const now = nowIdx >= 0 ? args[nowIdx + 1] : null;
    const refIdx = args.indexOf("--ref");
    const ref = refIdx >= 0 ? args[refIdx + 1] : null;
    const byIdx = args.indexOf("--by");
    const by = byIdx >= 0 ? args[byIdx + 1] : null;
    const description = args[2] && !args[2].startsWith("--") ? args[2] : null;

    if (!now) {
      console.error("❌ --now is required for amend command");
      process.exit(1);
    }
    if (!ref) {
      console.error("❌ --ref is required for amend command");
      process.exit(1);
    }

    const source = fs.readFileSync(targetFile, "utf-8");
    const doc = parseIntentText(source);

    // Check freeze exists
    if (!doc.metadata?.freeze) {
      console.error(
        "❌ Cannot amend: document is not frozen. Seal the document first.",
      );
      process.exit(1);
    }

    // Build the amendment line
    const at = new Date().toISOString().split("T")[0];
    let amendLine = `amendment: ${description || "Amendment"}${section ? ` | section: ${section}` : ""}${was ? ` | was: ${was}` : ""} | now: ${now} | ref: ${ref}${by ? ` | by: ${by}` : ""} | at: ${at}`;

    // Find insertion point: after the last freeze:/sign:/amendment: line, before history
    const historyPos = findHistoryBoundaryInSource(source);
    const contentEnd = historyPos === -1 ? source.length : historyPos;
    const contentPart = source.slice(0, contentEnd);
    const lines = contentPart.split("\n");

    // Find the last freeze/sign/amendment line
    let insertAfterLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (
        trimmed.startsWith("freeze:") ||
        trimmed.startsWith("sign:") ||
        trimmed.startsWith("amendment:")
      ) {
        insertAfterLine = i;
        break;
      }
    }

    if (insertAfterLine === -1) {
      console.error("❌ Cannot find freeze: block in document source");
      process.exit(1);
    }

    // Build the updated source
    const beforeLines = lines.slice(0, insertAfterLine + 1);
    const afterLines = lines.slice(insertAfterLine + 1);
    const afterContent = historyPos === -1 ? "" : source.slice(historyPos);

    const updatedContent =
      beforeLines.join("\n") + "\n" + amendLine + "\n" + afterLines.join("\n");
    const updatedSource = afterContent
      ? updatedContent + afterContent
      : updatedContent;

    // Show preview and confirm
    console.log("\n📝 Amendment to add:");
    console.log(`   ${amendLine}`);
    console.log(`\n   File: ${targetFile}`);
    console.log(`   Insert after line ${insertAfterLine + 1}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("\nApply amendment? (y/N) ", (answer) => {
      rl.close();
      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        fs.writeFileSync(targetFile, updatedSource);
        console.log("✅ Amendment added successfully");
      } else {
        console.log("❌ Amendment cancelled");
      }
    });
    return;
  }

  const outputHtml = args.includes("--html");
  const saveFile = args.includes("--output");
  const toIt = args.includes("--to-it");
  const printMode = args.includes("--print");
  const pdfMode = args.includes("--pdf");
  const themeIdx = args.indexOf("--theme");
  const themeName = themeIdx >= 0 ? args[themeIdx + 1] : null;
  const renderOpts = themeName ? { theme: themeName } : undefined;
  const queryIndex = args.indexOf("--query");
  const queryString = queryIndex >= 0 ? args[queryIndex + 1] : null;
  const validateIndex = args.indexOf("--validate");
  const schemaName = validateIndex >= 0 ? args[validateIndex + 1] : null;
  const dataIndex = args.indexOf("--data");
  const dataFile = dataIndex >= 0 ? args[dataIndex + 1] : null;

  try {
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ File not found: ${inputFile}`);
      process.exit(1);
    }

    const content = fs.readFileSync(inputFile, "utf-8");

    // Convert mode: Markdown or HTML → .it
    if (toIt) {
      let converted;
      if (/\.html?$/i.test(inputFile)) {
        converted = convertHtmlToIntentText(content);
      } else {
        converted = convertMarkdownToIntentText(content);
      }
      if (saveFile) {
        const outputFile = inputFile.replace(/\.(md|markdown|html?)$/i, ".it");
        fs.writeFileSync(outputFile, converted);
        console.log(`✅ IntentText saved to: ${outputFile}`);
      } else {
        console.log(converted);
      }
      return;
    }

    // Parse the document, optionally merging template data
    let document;
    if (dataFile) {
      if (!fs.existsSync(dataFile)) {
        console.error(`❌ Data file not found: ${dataFile}`);
        process.exit(1);
      }
      const dataContent = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      const parsed = parseIntentText(content);
      document = mergeData(parsed, dataContent);
    } else {
      document = parseIntentText(content);
    }

    // Query mode
    if (queryString) {
      const result = queryBlocks(document, queryString);
      console.log(formatQueryResult(result, "table"));
      return;
    }

    // Validation mode
    if (schemaName) {
      const result = validateDocument(document, schemaName);
      console.log(formatValidationResult(result));
      process.exit(result.valid ? 0 : 1);
    }

    // PDF mode
    if (pdfMode) {
      let puppeteer;
      try {
        puppeteer = require("puppeteer");
      } catch {
        console.error(
          `PDF output requires puppeteer. Run: npm install puppeteer\nThen retry: node cli.js ${inputFile} --data ${dataFile || "data.json"} --pdf`,
        );
        process.exit(1);
      }
      const printHtml = renderPrint(document, renderOpts);
      (async () => {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(printHtml, { waitUntil: "networkidle0" });
        const pdfPath = inputFile.replace(/\.it$/i, ".pdf");
        await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
        await browser.close();
        console.log(`✅ PDF saved to: ${pdfPath}`);
      })();
      return;
    }

    // Print mode
    if (printMode) {
      const printHtml = renderPrint(document, renderOpts);
      if (saveFile) {
        const outputFile = inputFile.replace(/\.it$/i, "-print.html");
        fs.writeFileSync(outputFile, printHtml);
        console.log(`✅ Print HTML saved to: ${outputFile}`);
      } else {
        console.log(printHtml);
      }
      return;
    }

    // HTML output
    if (outputHtml || saveFile) {
      const html = renderHTML(document, renderOpts);
      if (saveFile) {
        const outputFile = inputFile.replace(/\.it$/i, ".html");
        fs.writeFileSync(outputFile, html);
        console.log(`✅ HTML saved to: ${outputFile}`);
      } else {
        console.log(html);
      }
    } else {
      // Default: JSON output
      console.log(JSON.stringify(document, null, 2));
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

// ── v2.10 Helper Functions ──────────────────────────────

/**
 * Resolve .it files from a path that could be a file, directory, or glob.
 */
function resolveItFiles(target) {
  const resolved = path.resolve(target);

  // If it's a directory, glob all .it files recursively
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return walkDir(resolved).filter((f) => f.endsWith(".it"));
  }

  // If it's a single .it file
  if (fs.existsSync(resolved) && resolved.endsWith(".it")) {
    return [resolved];
  }

  // Treat as a glob pattern — basic implementation
  const dir = path.dirname(resolved);
  const pattern = path.basename(target);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    const files = fs.readdirSync(dir).filter((f) => {
      if (!f.endsWith(".it")) return false;
      if (pattern.includes("*")) {
        const regex = new RegExp(
          "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        );
        return regex.test(f);
      }
      return f === pattern;
    });
    return files.map((f) => path.join(dir, f));
  }

  // Recursive glob: **/*.it
  if (target.includes("**")) {
    const base = target.split("**")[0] || ".";
    const baseResolved = path.resolve(base);
    if (
      fs.existsSync(baseResolved) &&
      fs.statSync(baseResolved).isDirectory()
    ) {
      return walkDir(baseResolved).filter((f) => f.endsWith(".it"));
    }
  }

  return [];
}

function walkDir(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      entry.name !== "node_modules"
    ) {
      results.push(...walkDir(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function buildIndexForFolder(folder) {
  const entries = fs.readdirSync(folder, { withFileTypes: true });
  const itFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".it"));

  if (itFiles.length === 0) {
    console.log(`No .it files in ${folder}`);
    return;
  }

  const filesData = {};
  for (const entry of itFiles) {
    const filePath = path.join(folder, entry.name);
    const source = fs.readFileSync(filePath, "utf-8");
    const stat = fs.statSync(filePath);
    const doc = parseIntentText(source);
    filesData[entry.name] = {
      source,
      doc,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  const relFolder = path.relative(process.cwd(), folder);
  const index = buildShallowIndex(relFolder || ".", filesData, "2.10.0");
  const indexPath = path.join(folder, ".it-index");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✅ Index built: ${indexPath} (${itFiles.length} files)`);
}

function buildIndexRecursive(rootDir) {
  let count = 0;
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasItFiles = entries.some(
      (e) => e.isFile() && e.name.endsWith(".it"),
    );
    if (hasItFiles) {
      buildIndexForFolder(dir);
      count++;
    }
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        walk(path.join(dir, entry.name));
      }
    }
  }
  walk(rootDir);
  console.log(`\n✅ Built ${count} indexes recursively under ${rootDir}`);
}
