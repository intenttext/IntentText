# IntentText Organisation — Migration & Setup Guide
# github.com/intenttext

---

## STEP 1 — Transfer Existing Repos (10 minutes)

### Transfer IntentText → intenttext/IntentText

1. Go to https://github.com/emadjumaah/IntentText
2. Settings → scroll to bottom → "Transfer" under "Danger Zone"
3. Type the repo name: `IntentText`
4. Choose destination: `intenttext` (your org)
5. Confirm

GitHub automatically sets up a redirect from `github.com/emadjumaah/IntentText`
to `github.com/intenttext/IntentText`. All existing npm installs, links, and
forks continue to work. Nothing breaks.

### Transfer toit → intenttext/toit

1. Go to https://github.com/emadjumaah/toit
2. Same process — transfer to `intenttext`

---

## STEP 2 — Update package.json references

After transfer, update these fields in `packages/core/package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/intenttext/IntentText.git"
  },
  "homepage": "https://github.com/intenttext/IntentText",
  "bugs": {
    "url": "https://github.com/intenttext/IntentText/issues"
  }
}
```

Same update in the root `package.json` of toit.

---

## STEP 3 — Create New Repos Under the Org

Create these as empty repos at github.com/intenttext (no README, no license —
the agent prompts will build them from scratch):

| Repo name | Description |
|---|---|
| `intenttext-mcp` | MCP server — @intenttext/mcp-server |
| `intenttext-python` | Python port — intenttext on PyPI |
| `intenttext-action` | GitHub Action — validate .it files in CI |
| `intenttext-vscode` | VS Code extension (move from IntentText repo later) |

---

## STEP 4 — VS Code Extension (move from IntentText repo)

The VS Code extension currently lives at `vscode-extension/` inside the
IntentText repo. It should eventually be its own repo at
`github.com/intenttext/intenttext-vscode`.

**Do this last** — it requires updating references inside the extension.
The agent prompt for this is in PROMPT_4_VSCODE.md.

For now, leave it in the IntentText repo and focus on the three new tools first.

---

## STEP 5 — npm Scope

The npm scope `@intenttext` should already be yours if you published
`@intenttext/core`. Verify at:
https://www.npmjs.com/settings/intenttext/packages

New packages to publish:
- `@intenttext/mcp-server` (from intenttext-mcp repo)
- Python publishes to PyPI, not npm (separate registry)

---

## BUILD ORDER

Do these in sequence — each one depends on core being stable:

1. **Harden core** — add `parseIntentTextSafe`, `documentToSource`,
   `validateDocument`, `queryDocument`, `diffDocuments`, `extractWorkflow`
   → PROMPT_0_CORE_HARDENING.md

2. **MCP Server** — highest leverage for AI developer adoption
   → PROMPT_1_MCP.md

3. **GitHub Action** — small, fast, high visibility
   → PROMPT_2_ACTION.md

4. **Python port** — biggest reach, most work
   → PROMPT_3_PYTHON.md

5. **VS Code extension** — move and upgrade
   → PROMPT_4_VSCODE.md (do last)
