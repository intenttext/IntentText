# IntentText GitHub Action — Implementation Prompt
# Repo: github.com/intenttext/intenttext-action (new repo)
# Marketplace: GitHub Actions Marketplace
# Depends on: @intenttext/core >= 2.2.0

---

## MISSION

Build a GitHub Action that validates `.it` files in any repository on every push
or pull request. Fails CI if any workflow document has broken step references,
missing required properties, or critical syntax errors. Makes IntentText a
first-class citizen in software repositories — workflow definitions committed
alongside code, validated automatically.

---

## REPO STRUCTURE

```
intenttext-action/
├── src/
│   └── main.ts           Action entry point
├── dist/
│   └── index.js          Compiled + bundled (committed to repo — required by GitHub)
├── action.yml            Action definition
├── package.json
├── tsconfig.json
├── .github/
│   └── workflows/
│       ├── test.yml      Test the action itself on push
│       └── release.yml   Bundle and commit dist/ on release tag
└── README.md
```

---

## PART 1 — action.yml

```yaml
name: 'IntentText Validate'
description: 'Validate IntentText (.it) workflow and document files'
author: 'intenttext'

branding:
  icon: 'check-circle'
  color: 'purple'

inputs:
  path:
    description: 'Glob pattern for .it files to validate. Default: **/*.it'
    required: false
    default: '**/*.it'

  strict:
    description: 'Fail on warnings as well as errors. Default: false'
    required: false
    default: 'false'

  ignore:
    description: 'Comma-separated glob patterns to ignore. Default: node_modules/**'
    required: false
    default: 'node_modules/**'

  annotate:
    description: 'Add GitHub annotations (inline PR comments) for issues. Default: true'
    required: false
    default: 'true'

outputs:
  files_checked:
    description: 'Number of .it files validated'

  issues_found:
    description: 'Total number of issues found across all files'

  valid:
    description: 'true if all files passed, false if any failed'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

---

## PART 2 — src/main.ts

```typescript
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { readFileSync } from 'fs';
import {
  parseIntentTextSafe,
  validateDocument,
  type ValidationIssue
} from '@intenttext/core';

interface FileResult {
  path: string;
  parseWarnings: number;
  parseErrors: number;
  validationIssues: ValidationIssue[];
  passed: boolean;
}

async function run(): Promise<void> {
  const pathPattern = core.getInput('path') || '**/*.it';
  const strict = core.getInput('strict') === 'true';
  const ignorePatterns = (core.getInput('ignore') || 'node_modules/**')
    .split(',').map(p => p.trim());
  const annotate = core.getInput('annotate') !== 'false';

  // Find all matching .it files
  const globber = await glob.create(pathPattern);
  const files = await globber.glob();

  // Filter ignored paths
  const filesToCheck = files.filter(f =>
    !ignorePatterns.some(pattern => minimatch(f, pattern))
  );

  if (filesToCheck.length === 0) {
    core.warning(`No .it files found matching: ${pathPattern}`);
    core.setOutput('files_checked', '0');
    core.setOutput('issues_found', '0');
    core.setOutput('valid', 'true');
    return;
  }

  core.info(`Validating ${filesToCheck.length} IntentText file(s)...`);

  const results: FileResult[] = [];
  let totalIssues = 0;

  for (const filePath of filesToCheck) {
    const source = readFileSync(filePath, 'utf-8');

    // Parse safely — collect warnings
    const parseResult = parseIntentTextSafe(source, { strict: false });

    // Semantic validation
    const validation = validateDocument(parseResult.document);

    // Determine pass/fail
    const hasParseErrors = parseResult.errors.length > 0;
    const hasValidationErrors = validation.issues.some(i => i.type === 'error');
    const hasWarnings = parseResult.warnings.length > 0 ||
                        validation.issues.some(i => i.type === 'warning');

    const passed = !hasParseErrors && !hasValidationErrors &&
                   !(strict && hasWarnings);

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
        const level = issue.type === 'error' ? 'error' :
                      issue.type === 'warning' ? 'warning' : 'notice';
        core[level](`[${issue.code}] ${issue.message} (block: ${issue.blockId})`, {
          file: filePath,
          title: `IntentText ${issue.type}: ${issue.code}`,
        });
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
    const status = passed ? '✓' : '✗';
    const issueCount = result.validationIssues.length + result.parseErrors;
    core.info(`  ${status} ${filePath}${issueCount > 0 ? ` (${issueCount} issues)` : ''}`);
  }

  // Summary
  const failedFiles = results.filter(r => !r.passed);
  const allPassed = failedFiles.length === 0;

  core.setOutput('files_checked', filesToCheck.length.toString());
  core.setOutput('issues_found', totalIssues.toString());
  core.setOutput('valid', allPassed.toString());

  // Summary table
  await core.summary
    .addHeading('IntentText Validation Results')
    .addTable([
      [
        { data: 'File', header: true },
        { data: 'Status', header: true },
        { data: 'Errors', header: true },
        { data: 'Warnings', header: true },
      ],
      ...results.map(r => [
        r.path.replace(process.cwd() + '/', ''),
        r.passed ? '✅ Passed' : '❌ Failed',
        r.validationIssues.filter(i => i.type === 'error').length.toString(),
        r.validationIssues.filter(i => i.type === 'warning').length.toString(),
      ])
    ])
    .addRaw(`\n**${filesToCheck.length} file(s) checked · ${totalIssues} total issues**`)
    .write();

  if (!allPassed) {
    core.setFailed(
      `${failedFiles.length} of ${filesToCheck.length} file(s) failed validation.\n` +
      failedFiles.map(f => `  - ${f.path}`).join('\n')
    );
  } else {
    core.info(`\n✓ All ${filesToCheck.length} file(s) passed.`);
  }
}

run().catch(core.setFailed);
```

---

## PART 3 — package.json

```json
{
  "name": "intenttext-action",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "bundle": "ncc build src/main.ts -o dist --minify",
    "test": "vitest run"
  },
  "dependencies": {
    "@actions/core": "^1.10.0",
    "@actions/glob": "^0.4.0",
    "@intenttext/core": ">=2.2.0",
    "minimatch": "^9.0.0"
  },
  "devDependencies": {
    "@vercel/ncc": "^0.38.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/minimatch": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

IMPORTANT: GitHub Actions require the `dist/` folder to be committed to the repo.
The bundle is built with `@vercel/ncc` which compiles TypeScript + all dependencies
into a single `dist/index.js` file. This file must be committed.

---

## PART 4 — Release workflow

File: `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run bundle
      - name: Commit dist/
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add dist/
          git commit -m "chore: bundle dist for ${GITHUB_REF_NAME}" || true
          git push
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```

---

## PART 5 — Test workflow

File: `.github/workflows/test.yml`

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  # Test the action against itself
  validate-examples:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          path: 'examples/**/*.it'
          strict: 'false'
```

---

## PART 6 — Example files

Create `examples/` folder with two `.it` files for testing:

**`examples/valid-workflow.it`** — a valid workflow that should pass validation

**`examples/invalid-workflow.it`** — a workflow with intentional errors
(broken step reference, missing gate approver) to demonstrate error output.
Add a comment at the top: `// This file is intentionally invalid — for testing.`

---

## PART 7 — README

```markdown
# IntentText Validate

GitHub Action to validate IntentText (.it) workflow and document files in CI.

## Usage

### Basic — validate all .it files

```yaml
- uses: intenttext/intenttext-action@v1
```

### In a full workflow

```yaml
name: Validate IntentText
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: intenttext/intenttext-action@v1
        with:
          path: 'workflows/**/*.it'
          strict: false
          annotate: true
```

### With strict mode (fail on warnings too)

```yaml
- uses: intenttext/intenttext-action@v1
  with:
    strict: true
```

## Inputs

| Input | Description | Default |
|---|---|---|
| `path` | Glob pattern for .it files | `**/*.it` |
| `strict` | Fail on warnings too | `false` |
| `ignore` | Patterns to ignore | `node_modules/**` |
| `annotate` | Add inline PR annotations | `true` |

## Outputs

| Output | Description |
|---|---|
| `files_checked` | Number of files validated |
| `issues_found` | Total issues found |
| `valid` | `true` if all passed |

## What gets validated

Checks run on every .it file:
- **Syntax** — all keywords are valid, pipe properties are well-formed
- **Step references** — `decision:` then/else, `depends:` and `parallel:` steps exist
- **Required properties** — `gate:` has `approver:`, workflow blocks have expected fields
- **Duplicate IDs** — no two blocks share the same explicit `id:`
- **Variable references** — `{{variables}}` are declared in `context:` or produced by steps

See the [IntentText documentation](https://github.com/intenttext/IntentText) for the full spec.
```

---

## CONSTRAINTS

- `dist/index.js` must be a single self-contained file (use ncc bundle)
- No runtime calls to npm or external APIs during action execution
- Action must work on ubuntu-latest, macos-latest, windows-latest
- Keep action runtime under 10 seconds for typical repos

*IntentText GitHub Action — Implementation Prompt v1.0 — March 2026*
