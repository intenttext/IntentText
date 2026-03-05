**MIGRATION_GUIDE** — your checklist. Two repo transfers (5 minutes each), package.json URL updates, which three new repos to create as empty, and the confirmed build order. Start here.

**PROMPT_0_CORE_HARDENING** — run this first in the IntentText repo before touching anything else. Adds `parseIntentTextSafe`, `documentToSource`, `validateDocument`, `queryDocument`, `diffDocuments`, and `extractWorkflow` to `@intenttext/core`. Bumps to v2.2.0. Every other tool depends on this being done.

**PROMPT_1_MCP** — the MCP server at `intenttext-mcp`. Full tool definitions for all 8 operations with proper descriptions written for AI agents to understand. Includes the `npx @intenttext/mcp-server` install path and the Claude Desktop config JSON. Highest leverage — do this second.

**PROMPT_2_ACTION** — the GitHub Action at `intenttext-action`. Validates `.it` files in CI with inline PR annotations, a summary table, and strict mode. Small build, ships fast, high visibility.

**PROMPT_3_PYTHON** — the Python port at `intenttext-python`. Full implementation including the parser, inline formatter, merge engine, renderer, validate, and query. Includes a LangChain usage example so Python AI developers immediately see where it fits. Publishes as `intenttext` on PyPI.

**PROMPT_4_VSCODE** — do last. Moves the extension out of the IntentText monorepo and adds the three things that make it genuinely useful: inline red squiggles from `validateDocument`, hover docs for every keyword, and property auto-complete after `|`.
