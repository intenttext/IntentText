import { describe, it, expect } from "vitest";
import {
  convertMarkdownToIntentText,
  convertIntentTextToMarkdown,
} from "../src/index";

describe("Markdown -> IntentText converter", () => {
  it("should convert headings, lists, and fenced code blocks", () => {
    const md = `# Title

## Section

- item 1
- item 2

1. step 1
2. step 2

\`\`\`js
console.log("hi")
\`\`\`
`;

    const itText = convertMarkdownToIntentText(md);

    expect(itText).toContain("title: Title");
    expect(itText).toContain("section: Section");
    expect(itText).toContain("- item 1");
    expect(itText).toContain("1. step 1");
    // a Markdown fence IS valid IntentText — re-emitted verbatim (not code:/end:)
    expect(itText).toContain("```js");
    expect(itText).toContain('console.log("hi")');
    expect(itText).toContain("```");
    expect(itText).not.toContain("code:");
    expect(itText).not.toContain("end:");
  });

  it("emits a paragraph as BARE prose (no keyword), with inline marks converted", () => {
    const md = "**Bold** *italic* ~~strike~~ `code`";
    const itText = convertMarkdownToIntentText(md);
    // bare prose (no note:/text:), inline code stays single-backtick
    expect(itText).toBe("*Bold* _italic_ ~strike~ `code`");
  });

  it("forces text: only when a paragraph would parse as a keyword", () => {
    expect(convertMarkdownToIntentText("Note: keep this private.")).toBe(
      "text: Note: keep this private.",
    );
    // a normal sentence with a mid-line colon stays bare
    expect(convertMarkdownToIntentText("Pay by: cash or card")).toBe(
      "Pay by: cash or card",
    );
  });

  it("should convert standalone links and images", () => {
    const md = `[Docs](https://example.com)\n![Alt](logo.png)\n`;
    const itText = convertMarkdownToIntentText(md);

    expect(itText).toContain("link: Docs | to: https://example.com");
    expect(itText).toContain("image: Alt | src: logo.png");
  });

  it("should handle multiple bold segments correctly", () => {
    const md = "**first** and **second**";
    expect(convertMarkdownToIntentText(md)).toBe("*first* and *second*");
  });

  it("should handle bold at various string positions", () => {
    const md = "start **bold** middle **also bold** end";
    expect(convertMarkdownToIntentText(md)).toBe(
      "start *bold* middle *also bold* end",
    );
  });

  it("should convert blockquotes to quote:", () => {
    expect(convertMarkdownToIntentText("> Wise words")).toBe("quote: Wise words");
  });

  it("should convert horizontal rules to ---", () => {
    expect(convertMarkdownToIntentText("---")).toBe("---");
  });

  it("should convert markdown tables", () => {
    const md = `| Name | Age |
| --- | --- |
| Ahmed | 30 |`;
    const itText = convertMarkdownToIntentText(md);
    expect(itText).toContain("headers: Name | Age");
    expect(itText).toContain("row: Ahmed | 30");
  });

  it("converts Markdown image to image: with src: (not deprecated at:)", () => {
    const result = convertMarkdownToIntentText(
      "![Photo](https://example.com/photo.jpg)",
    );
    expect(result).toContain("src: https://example.com/photo.jpg");
    expect(result).not.toContain("at: https://example.com/photo.jpg");
  });
});

describe("IntentText -> Markdown converter", () => {
  it("maps the shared block set to clean Markdown", () => {
    const it = `title: Doc
summary: Subtitle

A paragraph with *bold* and _italic_ and \`code\`.

section: Scope
- one
- two
task: Ship it | owner: A
done: Deployed
quote: Stay hungry | by: Jobs
headers: Item | Qty
row: Hosting | 12
link: Docs | to: https://x.io
\`\`\`js
const x = 1;
\`\`\``;
    const md = convertIntentTextToMarkdown(it);
    expect(md).toContain("# Doc");
    expect(md).toContain("_Subtitle_");
    expect(md).toContain("**bold**");
    expect(md).toContain("*italic*");
    expect(md).toContain("`code`");
    expect(md).toContain("## Scope");
    expect(md).toContain("- one");
    expect(md).toContain("- [ ] Ship it");
    expect(md).toContain("- [x] Deployed");
    expect(md).toContain("> Stay hungry");
    expect(md).toContain("| Item | Qty |");
    expect(md).toContain("[Docs](https://x.io)");
    expect(md).toContain("```js");
  });

  it("degrades typed/custom blocks to labeled lines (no info lost)", () => {
    const it = `metric: Total | value: 100 | unit: QAR
clause: No refunds | ref: 4.2
sign: Fahad | role: MD`;
    const md = convertIntentTextToMarkdown(it);
    expect(md).toContain("**Total:** 100 QAR");
    expect(md).toContain("**clause:** No refunds");
    expect(md).toContain("**sign:** Fahad");
  });

  it("round-trips the shared Markdown subset (md -> it -> md is stable)", () => {
    const md = `# Title

A paragraph with **bold** and *italic* and \`code\` and a [link](https://x.io).

## Section

- one
- two

| A | B |
| --- | --- |
| 1 | 2 |

\`\`\`js
x=1;
\`\`\``;
    const back = convertIntentTextToMarkdown(convertMarkdownToIntentText(md));
    expect(back.trim()).toBe(md.trim());
  });
});
