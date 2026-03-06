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
} = require("./packages/core/dist");
const fs = require("fs");
const path = require("path");

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🚀 IntentText CLI v2.8

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

Document Trust (v2.8):
  node cli.js seal <file.it> --signer "Name" --role "Role"   Seal document
  node cli.js verify <file.it>                                 Verify integrity
  node cli.js history <file.it>                                Show history
  node cli.js history <file.it> --json                         History as JSON
  node cli.js history <file.it> --by "Ahmed"                   Filter by author
  node cli.js history <file.it> --section "Scope"              Filter by section

Query examples:
  node cli.js todo.it --query "type=task owner=Ahmed"
  node cli.js project.it --query "type=task due<2026-03-01 sort:due:asc limit:10"

Validation:
  node cli.js project.it --validate project
  node cli.js article.it --validate article

Available schemas: ${Object.keys(PREDEFINED_SCHEMAS).join(", ")}

Examples:
  node cli.js examples/simple.it
  node cli.js examples/simple.it --html
  node cli.js examples/simple.it --output
  node cli.js README.md --to-it
`);
    return;
  }

  const inputFile = args[0];

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

  const outputHtml = args.includes("--html");
  const saveFile = args.includes("--output");
  const toIt = args.includes("--to-it");
  const printMode = args.includes("--print");
  const pdfMode = args.includes("--pdf");
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
      const printHtml = renderPrint(document);
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
      const printHtml = renderPrint(document);
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
      const html = renderHTML(document);
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
