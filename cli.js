#!/usr/bin/env node

const {
  parseIntentText,
  renderHTML,
  convertMarkdownToIntentText,
  convertHtmlToIntentText,
  queryBlocks,
  formatQueryResult,
  validateDocument,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
} = require("./packages/core/dist");
const fs = require("fs");
const path = require("path");

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🚀 IntentText CLI v1.4

Usage:
  node cli.js <file.it>                     Parse and show JSON
  node cli.js <file.it> --html              Generate HTML output
  node cli.js <file.it> --output            Save HTML to file
  node cli.js <file.md> --to-it             Convert Markdown to .it
  node cli.js <file.html> --to-it           Convert HTML to .it
  node cli.js <file> --to-it --output       Save converted .it next to source
  node cli.js <file.it> --query "..."       Query blocks
  node cli.js <file.it> --validate <schema> Validate against schema

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
  const outputHtml = args.includes("--html");
  const saveFile = args.includes("--output");
  const toIt = args.includes("--to-it");
  const queryIndex = args.indexOf("--query");
  const queryString = queryIndex >= 0 ? args[queryIndex + 1] : null;
  const validateIndex = args.indexOf("--validate");
  const schemaName = validateIndex >= 0 ? args[validateIndex + 1] : null;

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

    const document = parseIntentText(content);

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
