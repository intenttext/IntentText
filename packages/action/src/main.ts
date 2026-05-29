import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { readFileSync } from "fs";
import { minimatch } from "minimatch";
import {
  parseIntentTextSafe,
  validateDocumentSemantic,
  verifyDocument,
} from "@intenttext/core";
import type { SemanticIssue } from "@intenttext/core";

interface FileResult {
  path: string;
  parseWarnings: number;
  parseErrors: number;
  validationIssues: SemanticIssue[];
  passed: boolean;
}

async function run(): Promise<void> {
  const pathPattern = core.getInput("path") || "**/*.it";
  const strict = core.getInput("strict") === "true";
  const ignorePatterns = (core.getInput("ignore") || "node_modules/**")
    .split(",")
    .map((p) => p.trim());
  const annotate = core.getInput("annotate") !== "false";

  // Find all matching .it files
  const globber = await glob.create(pathPattern);
  const files = await globber.glob();

  // Filter ignored paths
  const filesToCheck = files.filter(
    (f) => !ignorePatterns.some((pattern) => minimatch(f, pattern)),
  );

  if (filesToCheck.length === 0) {
    core.warning(`No .it files found matching: ${pathPattern}`);
    core.setOutput("files_checked", "0");
    core.setOutput("issues_found", "0");
    core.setOutput("valid", "true");
    return;
  }

  core.info(`Validating ${filesToCheck.length} IntentText file(s)...`);

  const results: FileResult[] = [];
  let totalIssues = 0;

  for (const filePath of filesToCheck) {
    const source = readFileSync(filePath, "utf-8");

    // Parse safely — collect warnings
    const parseResult = parseIntentTextSafe(source);

    // Semantic validation
    const validation = validateDocumentSemantic(parseResult.document);

    // Determine pass/fail
    const hasParseErrors = parseResult.errors.length > 0;
    const hasValidationErrors = validation.issues.some(
      (i) => i.type === "error",
    );
    const hasWarnings =
      parseResult.warnings.length > 0 ||
      validation.issues.some((i) => i.type === "warning");

    const passed =
      !hasParseErrors && !hasValidationErrors && !(strict && hasWarnings);

    const result: FileResult = {
      path: filePath,
      parseWarnings: parseResult.warnings.length,
      parseErrors: parseResult.errors.length,
      validationIssues: validation.issues,
      passed,
    };

    results.push(result);
    totalIssues += parseResult.errors.length + validation.issues.length;

    // GitHub annotations
    if (annotate) {
      for (const issue of validation.issues) {
        const msg = `[${issue.code}] ${issue.message} (block: ${issue.blockId})`;
        const props = {
          file: filePath,
          title: `IntentText ${issue.type}: ${issue.code}`,
        };
        if (issue.type === "error") {
          core.error(msg, props);
        } else if (issue.type === "warning") {
          core.warning(msg, props);
        } else {
          core.notice(msg, props);
        }
      }
      for (const warn of parseResult.warnings) {
        core.warning(`[${warn.code}] ${warn.message}`, {
          file: filePath,
          startLine: warn.line,
          title: `IntentText parse warning: ${warn.code}`,
        });
      }
    }

    // Log result
    const status = passed ? "✓" : "✗";
    const issueCount = result.validationIssues.length + result.parseErrors;
    core.info(
      `  ${status} ${filePath}${issueCount > 0 ? ` (${issueCount} issues)` : ""}`,
    );
  }

  // Summary
  const failedFiles = results.filter((r) => !r.passed);
  const allPassed = failedFiles.length === 0;

  core.setOutput("files_checked", filesToCheck.length.toString());
  core.setOutput("issues_found", totalIssues.toString());
  core.setOutput("valid", allPassed.toString());

  // Summary table
  await core.summary
    .addHeading("IntentText Validation Results")
    .addTable([
      [
        { data: "File", header: true },
        { data: "Status", header: true },
        { data: "Errors", header: true },
        { data: "Warnings", header: true },
      ],
      ...results.map((r) => [
        r.path.replace(process.cwd() + "/", ""),
        r.passed ? "✅ Passed" : "❌ Failed",
        r.validationIssues.filter((i) => i.type === "error").length.toString(),
        r.validationIssues
          .filter((i) => i.type === "warning")
          .length.toString(),
      ]),
    ])
    .addRaw(
      `\n**${filesToCheck.length} file(s) checked · ${totalIssues} total issues**`,
    )
    .write();

  if (!allPassed) {
    core.setFailed(
      `${failedFiles.length} of ${filesToCheck.length} file(s) failed validation.\n` +
        failedFiles.map((f) => `  - ${f.path}`).join("\n"),
    );
  } else {
    core.info(`\n✓ All ${filesToCheck.length} file(s) passed.`);
  }

  // ── Verify sealed documents ──────────────────────────────
  const shouldVerify = core.getInput("verify") === "true";
  if (shouldVerify) {
    const verifyPattern = core.getInput("verify-pattern") || "**/*.it";
    const verifyGlobber = await glob.create(verifyPattern);
    const verifyFiles = await verifyGlobber.glob();
    const verifyFilesToCheck = verifyFiles.filter(
      (f) => !ignorePatterns.some((pattern) => minimatch(f, pattern)),
    );

    let verifyFailed = false;
    for (const filePath of verifyFilesToCheck) {
      const source = readFileSync(filePath, "utf-8");
      const result = verifyDocument(source);

      if (result.frozen) {
        if (result.intact) {
          core.info(`  ✅ Verified: ${filePath}`);
        } else {
          core.error(
            `TAMPERED: ${filePath} — ${result.error ?? "integrity check failed"}`,
            {
              file: filePath,
              title: "IntentText: Document tampered",
            },
          );
          verifyFailed = true;
        }
      }
    }

    if (verifyFailed) {
      core.setFailed(
        "One or more sealed documents failed integrity verification.",
      );
    }
  }
}

run().catch(core.setFailed);
