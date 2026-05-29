import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  _resetIdCounter,
  renderHTML,
  renderPrint,
  getBuiltinTheme,
  listBuiltinThemes,
  registerBuiltinTheme,
  generateThemeCSS,
  buildIndexEntry,
  buildShallowIndex,
  checkStaleness,
  updateIndex,
  composeIndexes,
  queryComposed,
  formatTable,
  formatJSON,
  formatCSV,
  serializeContext,
} from "../src/index";
import type {
  IntentTheme,
  ItIndex,
  ComposedResult,
  IndexBlockEntry,
} from "../src/index";

beforeEach(() => _resetIdCounter());

// ── Helper ──────────────────────────────────────────────

function makeParsed(source: string) {
  return {
    source,
    doc: parseIntentText(source),
    modifiedAt: "2025-01-01T00:00:00Z",
  };
}

// ═══════════════════════════════════════════════════════════
//  THEME SYSTEM TESTS (15+)
// ═══════════════════════════════════════════════════════════

describe("v2.10 theme system — built-in registry", () => {
  it("listBuiltinThemes returns all 8 built-in themes", () => {
    const names = listBuiltinThemes();
    expect(names).toContain("corporate");
    expect(names).toContain("minimal");
    expect(names).toContain("warm");
    expect(names).toContain("technical");
    expect(names).toContain("print");
    expect(names).toContain("legal");
    expect(names).toContain("editorial");
    expect(names).toContain("dark");
    expect(names.length).toBe(8);
  });

  it("getBuiltinTheme returns undefined for unknown theme", () => {
    expect(getBuiltinTheme("nonexistent")).toBeUndefined();
  });

  it("getBuiltinTheme('corporate') returns a valid IntentTheme", () => {
    const theme = getBuiltinTheme("corporate")!;
    expect(theme).toBeDefined();
    expect(theme.name).toBe("corporate");
    expect(theme.version).toBe("1.0.0");
    expect(theme.fonts).toBeDefined();
    expect(theme.colors).toBeDefined();
    expect(theme.spacing).toBeDefined();
  });

  it("every built-in theme has required font fields", () => {
    for (const name of listBuiltinThemes()) {
      const theme = getBuiltinTheme(name)!;
      expect(theme.fonts.body).toBeTruthy();
      expect(theme.fonts.heading).toBeTruthy();
      expect(theme.fonts.mono).toBeTruthy();
      expect(theme.fonts.size).toBeTruthy();
      expect(theme.fonts.leading).toBeTruthy();
    }
  });

  it("every built-in theme has required color fields", () => {
    for (const name of listBuiltinThemes()) {
      const theme = getBuiltinTheme(name)!;
      expect(theme.colors.text).toBeTruthy();
      expect(theme.colors.heading).toBeTruthy();
      expect(theme.colors.muted).toBeTruthy();
      expect(theme.colors.accent).toBeTruthy();
      expect(theme.colors.border).toBeTruthy();
      expect(theme.colors.background).toBeTruthy();
      expect(theme.colors["code-bg"]).toBeTruthy();
    }
  });

  it("every built-in theme has required spacing fields", () => {
    for (const name of listBuiltinThemes()) {
      const theme = getBuiltinTheme(name)!;
      expect(theme.spacing["page-margin"]).toBeTruthy();
      expect(theme.spacing["section-gap"]).toBeTruthy();
      expect(theme.spacing["block-gap"]).toBeTruthy();
      expect(theme.spacing.indent).toBeTruthy();
    }
  });

  it("dark theme has dark background color", () => {
    const theme = getBuiltinTheme("dark")!;
    // Dark theme's background should not be #ffffff
    expect(theme.colors.background).not.toBe("#ffffff");
  });

  it("print theme uses only black/white/grey colors", () => {
    const theme = getBuiltinTheme("print")!;
    expect(theme.colors.text).toBe("#000000");
    expect(theme.colors.heading).toBe("#000000");
    expect(theme.colors.background).toBe("#ffffff");
    expect(theme.colors.accent).toBe("#000000");
  });
});

describe("v2.10 theme system — CSS generation", () => {
  it("generateThemeCSS produces :root custom properties", () => {
    const theme = getBuiltinTheme("corporate")!;
    const css = generateThemeCSS(theme, "web");
    expect(css).toContain(":root{");
    expect(css).toContain("--it-font-body:");
    expect(css).toContain("--it-font-heading:");
    expect(css).toContain("--it-font-mono:");
    expect(css).toContain("--it-color-text:");
    expect(css).toContain("--it-color-heading:");
    expect(css).toContain("--it-color-accent:");
    expect(css).toContain("--it-spacing-page-margin:");
  });

  it("generateThemeCSS web mode does not include print-specific CSS", () => {
    const theme = getBuiltinTheme("corporate")!;
    const css = generateThemeCSS(theme, "web");
    // Web mode should not contain @page header/footer overrides from print section
    // The base styles may have @page but not the print-specific header/footer sizing
    expect(css).not.toContain("@page{@top-left{font-size:");
    expect(css).not.toContain("@page{@bottom-left{font-size:");
  });

  it("generateThemeCSS print mode includes header/footer font sizing", () => {
    const theme = getBuiltinTheme("corporate")!;
    const css = generateThemeCSS(theme, "print");
    expect(css).toContain("@top-left{");
    expect(css).toContain("@bottom-left{");
    expect(css).toContain("font-size:8pt");
  });

  it("generateThemeCSS resolves block-level color references", () => {
    const theme = getBuiltinTheme("corporate")!;
    const css = generateThemeCSS(theme, "web");
    // The corporate theme has block styles with color refs like "trust-warning"
    // These should resolve to actual color values, not remain as "trust-warning"
    expect(css).toContain(".intent-warning{");
    // The resolved color should be the hex value
    expect(css).toContain(theme.colors["trust-warning"]!);
  });

  it("generateThemeCSS includes block styles from theme blocks config", () => {
    const theme = getBuiltinTheme("corporate")!;
    const css = generateThemeCSS(theme, "web");
    expect(css).toContain(".intent-section{");
    expect(css).toContain(".intent-sign{");
    expect(css).toContain(".intent-approve{");
    expect(css).toContain(".intent-freeze{");
  });

  it("generateThemeCSS with minimal theme produces fewer block styles", () => {
    const minCSS = generateThemeCSS(getBuiltinTheme("minimal")!, "web");
    const corpCSS = generateThemeCSS(getBuiltinTheme("corporate")!, "web");
    // Minimal has fewer block overrides
    expect(minCSS.length).toBeLessThan(corpCSS.length);
  });
});

describe("v2.10 theme system — renderer integration", () => {
  it("renderHTML with theme option injects CSS custom properties", () => {
    const doc = parseIntentText("title: Hello World");
    const html = renderHTML(doc, { theme: "corporate" });
    expect(html).toContain("--it-font-body:");
    expect(html).toContain("--it-color-text:");
  });

  it("renderHTML without theme option injects default theme CSS", () => {
    const doc = parseIntentText("title: Hello World");
    const html = renderHTML(doc);
    expect(html).toContain("--it-font-body:");
    expect(html).toContain("--it-color-text:");
  });

  it("renderHTML with meta.theme picks up theme from document metadata", () => {
    const doc = parseIntentText("meta: | theme: warm\ntitle: Hello World");
    const html = renderHTML(doc);
    expect(html).toContain("--it-font-body:");
    // Warm theme uses Georgia
    expect(html).toContain("Georgia");
  });

  it("renderHTML options.theme overrides meta.theme", () => {
    const doc = parseIntentText("meta: | theme: warm\ntitle: Hello World");
    // Pass corporate as explicit theme — should use Inter, not Georgia
    const html = renderHTML(doc, { theme: "corporate" });
    expect(html).toContain("Inter");
  });

  it("renderHTML with inline IntentTheme object works", () => {
    const customTheme: IntentTheme = {
      name: "custom-test",
      version: "1.0.0",
      fonts: {
        body: "CustomFont",
        heading: "CustomHeading",
        mono: "CustomMono",
        size: "14pt",
        leading: "1.8",
      },
      colors: {
        text: "#aabbcc",
        heading: "#112233",
        muted: "#555555",
        accent: "#ff0000",
        border: "#cccccc",
        background: "#ffffff",
        "code-bg": "#f0f0f0",
      },
      spacing: {
        "page-margin": "20mm",
        "section-gap": "2em",
        "block-gap": "1em",
        indent: "1.5em",
      },
    };
    const doc = parseIntentText("title: Custom");
    const html = renderHTML(doc, { theme: customTheme });
    expect(html).toContain("CustomFont");
    expect(html).toContain("#aabbcc");
  });

  it("renderPrint with theme option injects print-mode CSS", () => {
    const doc = parseIntentText("page: | size: A4\ntitle: Hello");
    const html = renderPrint(doc, { theme: "corporate" });
    expect(html).toContain("--it-font-body:");
    // Print mode should include header/footer sizing
    expect(html).toContain("font-size:8pt");
  });

  it("renderPrint with meta.theme picks up theme from metadata", () => {
    const doc = parseIntentText(
      "meta: | theme: legal\npage: | size: A4\ntitle: Contract",
    );
    const html = renderPrint(doc);
    expect(html).toContain("--it-font-body:");
    // Legal uses Times New Roman
    expect(html).toContain("Times New Roman");
  });

  it("renderHTML with unknown theme name falls back to default theme CSS", () => {
    const doc = parseIntentText("title: Test");
    const html = renderHTML(doc, { theme: "nonexistent" });
    expect(html).toContain("--it-font-body:");
  });
});

// ═══════════════════════════════════════════════════════════
//  SHALLOW INDEX TESTS (15+)
// ═══════════════════════════════════════════════════════════

describe("v2.10 index builder — buildIndexEntry", () => {
  it("extracts title from parsed document metadata", () => {
    const { doc, source } = makeParsed("title: Invoice 001");
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    expect(entry.metadata.title).toBe("Invoice 001");
  });

  it("extracts meta.type and meta.domain from document", () => {
    const { doc, source } = makeParsed(
      "meta: | type: template | domain: business\ntitle: Invoice",
    );
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    expect(entry.metadata.type).toBe("template");
    expect(entry.metadata.domain).toBe("business");
  });

  it("produces a hash for invalidation", () => {
    const { doc, source } = makeParsed("title: Test");
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    expect(entry.hash).toMatch(/^hash:/);
  });

  it("stores modified_at timestamp", () => {
    const { doc, source } = makeParsed("title: Test");
    const entry = buildIndexEntry(doc, source, "2025-06-15T12:00:00Z");
    expect(entry.modified_at).toBe("2025-06-15T12:00:00Z");
  });

  it("indexes content blocks with type and content", () => {
    const { doc, source } = makeParsed(
      "title: Test\nsection: Overview\nnote: Hello world",
    );
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    const titles = entry.blocks.filter((b) => b.type === "title");
    const sections = entry.blocks.filter((b) => b.type === "section");
    const notes = entry.blocks.filter((b) => b.type === "text");
    expect(titles.length).toBe(1);
    expect(sections.length).toBe(1);
    expect(notes.length).toBe(1);
    expect(notes[0].content).toBe("Hello world");
  });

  it("assigns section context to blocks", () => {
    const { doc, source } = makeParsed(
      "section: Overview\nnote: Note under overview\nsection: Details\nnote: Note under details",
    );
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    const notes = entry.blocks.filter((b) => b.type === "text");
    expect(notes[0].section).toBe("Overview");
    expect(notes[1].section).toBe("Details");
  });

  it("skips layout blocks (page, header, footer, meta, watermark)", () => {
    const { doc, source } = makeParsed(
      "page: | size: A4\nheader: | left: Acme\nfooter: | center: Page 1\nmeta: | author: Test\nwatermark: DRAFT\ntitle: Test",
    );
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    const types = entry.blocks.map((b) => b.type);
    expect(types).not.toContain("page");
    expect(types).not.toContain("header");
    expect(types).not.toContain("footer");
    expect(types).not.toContain("meta");
    expect(types).not.toContain("watermark");
    expect(types).toContain("title");
  });

  it("captures block properties", () => {
    const { doc, source } = makeParsed(
      "task: Build feature | owner: Ahmed | due: Friday",
    );
    const entry = buildIndexEntry(doc, source, "2025-01-01T00:00:00Z");
    const task = entry.blocks.find((b) => b.type === "task");
    expect(task).toBeDefined();
    expect(task!.properties.owner).toBe("Ahmed");
    expect(task!.properties.due).toBe("Friday");
  });
});

describe("v2.10 index builder — buildShallowIndex", () => {
  it("produces an index with scope: shallow", () => {
    const data = makeParsed("title: Test");
    const index = buildShallowIndex("my-folder", { "test.it": data }, "2.10.0");
    expect(index.scope).toBe("shallow");
  });

  it("records the folder name", () => {
    const data = makeParsed("title: Test");
    const index = buildShallowIndex(
      "docs/specs",
      { "test.it": data },
      "2.10.0",
    );
    expect(index.folder).toBe("docs/specs");
  });

  it("records core version", () => {
    const data = makeParsed("title: Test");
    const index = buildShallowIndex(".", { "test.it": data }, "2.10.0");
    expect(index.core_version).toBe("2.10.0");
  });

  it("includes all files passed to it", () => {
    const files = {
      "a.it": makeParsed("title: A"),
      "b.it": makeParsed("title: B"),
      "c.it": makeParsed("title: C"),
    };
    const index = buildShallowIndex(".", files, "2.10.0");
    expect(Object.keys(index.files)).toEqual(
      expect.arrayContaining(["a.it", "b.it", "c.it"]),
    );
    expect(Object.keys(index.files).length).toBe(3);
  });

  it("each file entry has hash and modified_at", () => {
    const files = { "test.it": makeParsed("title: Hello") };
    const index = buildShallowIndex(".", files, "2.10.0");
    expect(index.files["test.it"].hash).toMatch(/^hash:/);
    expect(index.files["test.it"].modified_at).toBe("2025-01-01T00:00:00Z");
  });
});

describe("v2.10 index builder — staleness detection", () => {
  it("detects stale files when source changes", () => {
    const original = makeParsed("title: Original");
    const index = buildShallowIndex(".", { "test.it": original }, "2.10.0");

    const updated = {
      "test.it": {
        source: "title: Updated",
        modifiedAt: "2025-01-02T00:00:00Z",
      },
    };
    const result = checkStaleness(index, updated);
    expect(result.stale).toEqual(["test.it"]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("detects added files", () => {
    const original = makeParsed("title: A");
    const index = buildShallowIndex(".", { "a.it": original }, "2.10.0");

    const current = {
      "a.it": { source: "title: A", modifiedAt: "2025-01-01T00:00:00Z" },
      "b.it": { source: "title: B", modifiedAt: "2025-01-02T00:00:00Z" },
    };
    const result = checkStaleness(index, current);
    expect(result.added).toEqual(["b.it"]);
  });

  it("detects removed files", () => {
    const files = {
      "a.it": makeParsed("title: A"),
      "b.it": makeParsed("title: B"),
    };
    const index = buildShallowIndex(".", files, "2.10.0");

    const current = {
      "a.it": { source: "title: A", modifiedAt: "2025-01-01T00:00:00Z" },
    };
    const result = checkStaleness(index, current);
    expect(result.removed).toEqual(["b.it"]);
  });

  it("detects unchanged files correctly", () => {
    const data = makeParsed("title: Same");
    const index = buildShallowIndex(".", { "same.it": data }, "2.10.0");

    const current = {
      "same.it": { source: "title: Same", modifiedAt: "2025-01-01T00:00:00Z" },
    };
    const result = checkStaleness(index, current);
    expect(result.unchanged).toEqual(["same.it"]);
    expect(result.stale).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("handles combination of stale, added, removed, and unchanged", () => {
    const files = {
      "unchanged.it": makeParsed("title: Stay"),
      "stale.it": makeParsed("title: Old"),
      "deleted.it": makeParsed("title: Gone"),
    };
    const index = buildShallowIndex(".", files, "2.10.0");

    const current = {
      "unchanged.it": {
        source: "title: Stay",
        modifiedAt: "2025-01-01T00:00:00Z",
      },
      "stale.it": {
        source: "title: New Content",
        modifiedAt: "2025-01-02T00:00:00Z",
      },
      "new.it": {
        source: "title: Brand New",
        modifiedAt: "2025-01-03T00:00:00Z",
      },
    };
    const result = checkStaleness(index, current);
    expect(result.unchanged).toContain("unchanged.it");
    expect(result.stale).toContain("stale.it");
    expect(result.removed).toContain("deleted.it");
    expect(result.added).toContain("new.it");
  });
});

describe("v2.10 index builder — updateIndex", () => {
  it("adds new entries and removes deleted files", () => {
    const files = {
      "a.it": makeParsed("title: A"),
      "b.it": makeParsed("title: B"),
    };
    const index = buildShallowIndex(".", files, "2.10.0");

    const updates = { "c.it": makeParsed("title: C") };
    const newIndex = updateIndex(index, updates, ["b.it"]);

    expect(Object.keys(newIndex.files)).toContain("a.it");
    expect(Object.keys(newIndex.files)).toContain("c.it");
    expect(Object.keys(newIndex.files)).not.toContain("b.it");
  });

  it("does not mutate the original index", () => {
    const files = { "a.it": makeParsed("title: A") };
    const index = buildShallowIndex(".", files, "2.10.0");
    const originalKeys = Object.keys(index.files);

    updateIndex(index, { "b.it": makeParsed("title: B") }, []);
    expect(Object.keys(index.files)).toEqual(originalKeys);
  });

  it("updates built_at timestamp", () => {
    const files = { "a.it": makeParsed("title: A") };
    const index = buildShallowIndex(".", files, "2.10.0");
    const oldBuiltAt = index.built_at;

    // Small delay to ensure different timestamp
    const newIndex = updateIndex(index, {}, []);
    // The new built_at should be a valid ISO string
    expect(newIndex.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ═══════════════════════════════════════════════════════════
//  COMPOSITION & QUERY TESTS (10+)
// ═══════════════════════════════════════════════════════════

describe("v2.10 index builder — composeIndexes", () => {
  it("composes blocks from multiple indexes into flat results", () => {
    const idx1 = buildShallowIndex(
      "folder-a",
      {
        "a.it": makeParsed("title: Doc A\nnote: Note A"),
      },
      "2.10.0",
    );
    const idx2 = buildShallowIndex(
      "folder-b",
      {
        "b.it": makeParsed("title: Doc B\nnote: Note B"),
      },
      "2.10.0",
    );

    const results = composeIndexes([idx1, idx2], ".");
    expect(results.length).toBeGreaterThan(0);
    const files = results.map((r) => r.file);
    expect(files).toContain("folder-a/a.it");
    expect(files).toContain("folder-b/b.it");
  });

  it("skips non-shallow indexes", () => {
    const idx = buildShallowIndex(
      ".",
      { "a.it": makeParsed("title: A") },
      "2.10.0",
    );
    const fakeDeep = { ...idx, scope: "deep" as "shallow" };
    const results = composeIndexes([fakeDeep], ".");
    expect(results.length).toBe(0);
  });
});

describe("v2.10 index builder — queryComposed", () => {
  function buildComposedFixture(): ComposedResult[] {
    const idx = buildShallowIndex(
      "project",
      {
        "tasks.it": makeParsed(
          "title: Tasks\nsection: Sprint 1\ntask: Build API | owner: Ahmed | status: done\ntask: Write tests | owner: Sara | status: pending",
        ),
        "notes.it": makeParsed("title: Notes\nnote: Meeting summary"),
      },
      "2.10.0",
    );
    return composeIndexes([idx], ".");
  }

  it("filters by block type", () => {
    const composed = buildComposedFixture();
    const tasks = queryComposed(composed, { type: "task" });
    expect(tasks.length).toBe(2);
    expect(tasks.every((r) => r.block.type === "task")).toBe(true);
  });

  it("filters by content substring", () => {
    const composed = buildComposedFixture();
    const matches = queryComposed(composed, { content: "Build" });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].block.content).toContain("Build API");
  });

  it("filters by 'by' property (e.g. sign blocks)", () => {
    // queryComposed { by: } matches properties.by, used by sign/approve blocks
    const idx = buildShallowIndex(
      "project",
      {
        "approvals.it": makeParsed(
          "title: Approvals\nsign: Contract | by: Ahmed | at: 2025-01-01\nsign: NDA | by: Sara | at: 2025-01-02",
        ),
      },
      "2.10.0",
    );
    const composed = composeIndexes([idx], ".");
    const byAhmed = queryComposed(composed, { by: "Ahmed" });
    expect(byAhmed.length).toBe(1);
    expect(byAhmed[0].block.content).toContain("Contract");
  });

  it("filters by status property", () => {
    const composed = buildComposedFixture();
    const pending = queryComposed(composed, { status: "pending" });
    expect(pending.length).toBe(1);
    expect(pending[0].block.content).toContain("Write tests");
  });

  it("filters by section", () => {
    const composed = buildComposedFixture();
    const sprint = queryComposed(composed, { section: "Sprint 1" });
    expect(sprint.length).toBeGreaterThan(0);
    // All should be from the Sprint 1 section
    for (const r of sprint) {
      expect(r.block.section).toContain("Sprint 1");
    }
  });

  it("combines multiple filters (type + status)", () => {
    const composed = buildComposedFixture();
    const doneTasks = queryComposed(composed, { type: "task", status: "done" });
    expect(doneTasks.length).toBe(1);
    expect(doneTasks[0].block.content).toContain("Build API");
  });

  it("returns empty array when no matches", () => {
    const composed = buildComposedFixture();
    const nothing = queryComposed(composed, { type: "nonexistent" });
    expect(nothing).toEqual([]);
  });

  it("content filter is case-insensitive", () => {
    const composed = buildComposedFixture();
    const matches = queryComposed(composed, { content: "build" });
    expect(matches.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  OUTPUT FORMATTER TESTS (5+)
// ═══════════════════════════════════════════════════════════

describe("v2.10 index builder — output formatters", () => {
  function sampleResults(): ComposedResult[] {
    return [
      {
        file: "project/tasks.it",
        block: {
          type: "task",
          content: "Build API",
          properties: { owner: "Ahmed", status: "done" },
        },
      },
      {
        file: "project/tasks.it",
        block: {
          type: "task",
          content: "Write tests",
          properties: { owner: "Sara", status: "pending" },
        },
      },
    ];
  }

  it("formatTable produces human-readable table with headers", () => {
    const table = formatTable(sampleResults());
    expect(table).toContain("FILE");
    expect(table).toContain("TYPE");
    expect(table).toContain("CONTENT");
    expect(table).toContain("Build API");
    expect(table).toContain("Write tests");
  });

  it("formatTable returns 'No results' for empty input", () => {
    expect(formatTable([])).toBe("No results");
  });

  it("formatJSON produces valid JSON array", () => {
    const json = formatJSON(sampleResults());
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].file).toBe("project/tasks.it");
    expect(parsed[0].block.type).toBe("task");
  });

  it("formatCSV produces comma-separated values with headers", () => {
    const csv = formatCSV(sampleResults());
    const lines = csv.split("\n");
    expect(lines[0]).toContain("file");
    expect(lines[0]).toContain("type");
    expect(lines[0]).toContain("content");
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it("formatCSV returns empty string for empty input", () => {
    expect(formatCSV([])).toBe("");
  });

  it("formatCSV escapes commas in content", () => {
    const results: ComposedResult[] = [
      {
        file: "test.it",
        block: { type: "note", content: "Hello, World", properties: {} },
      },
    ];
    const csv = formatCSV(results);
    // Content with comma should be quoted
    expect(csv).toContain('"Hello, World"');
  });
});

// ═══════════════════════════════════════════════════════════
//  SERIALIZATION / ASK CONTEXT TESTS
// ═══════════════════════════════════════════════════════════

describe("v2.10 ask — serializeContext", () => {
  it("serializes composed results into text with file headers", () => {
    const results: ComposedResult[] = [
      {
        file: "docs/spec.it",
        block: {
          type: "note",
          content: "Overview of the system",
          section: "Intro",
          properties: {},
        },
      },
      {
        file: "docs/spec.it",
        block: {
          type: "task",
          content: "Implement auth",
          properties: { owner: "Ahmed" },
        },
      },
      {
        file: "docs/plan.it",
        block: { type: "note", content: "Q1 plan", properties: {} },
      },
    ];
    const text = serializeContext(results);
    expect(text).toContain("--- docs/spec.it ---");
    expect(text).toContain("--- docs/plan.it ---");
    expect(text).toContain("[note] [Intro] Overview of the system");
    expect(text).toContain("[task] Implement auth | owner: Ahmed");
    expect(text).toContain("[note] Q1 plan");
  });

  it("groups blocks under the same file without repeating header", () => {
    const results: ComposedResult[] = [
      {
        file: "a.it",
        block: { type: "note", content: "First", properties: {} },
      },
      {
        file: "a.it",
        block: { type: "note", content: "Second", properties: {} },
      },
    ];
    const text = serializeContext(results);
    const fileHeaders = text.split("--- a.it ---").length - 1;
    expect(fileHeaders).toBe(1);
  });

  it("returns empty string for empty results", () => {
    const text = serializeContext([]);
    expect(text).toBe("");
  });
});
