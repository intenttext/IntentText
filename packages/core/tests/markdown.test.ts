import { describe, it, expect } from "vitest";
import { convertMarkdownToIntentText } from "../src/markdown";

describe("Markdown -> IntentText converter", () => {
  it("should convert headings, lists, and code blocks", () => {
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
    expect(itText).toContain("code:");
    expect(itText).toContain('console.log("hi")');
    expect(itText).toContain("end:");
  });

  it("should convert inline markdown formatting into IntentText inline conventions", () => {
    const md = "**Bold** *italic* ~~strike~~ `code`";
    const itText = convertMarkdownToIntentText(md);

    // paragraph becomes note:, inline code converts to triple backticks
    expect(itText).toBe("note: *Bold* _italic_ ~strike~ ```code```");
  });

  it("should convert standalone links and images", () => {
    const md = `[Docs](https://example.com)\n![Alt](logo.png)\n`;
    const itText = convertMarkdownToIntentText(md);

    expect(itText).toContain("link: Docs | to: https://example.com");
    expect(itText).toContain("image: Alt | src: logo.png");
  });

  it("should handle multiple bold segments correctly", () => {
    const md = "**first** and **second**";
    const itText = convertMarkdownToIntentText(md);
    expect(itText).toBe("note: *first* and *second*");
  });

  it("should handle bold at various string positions", () => {
    const md = "start **bold** middle **also bold** end";
    const itText = convertMarkdownToIntentText(md);
    expect(itText).toBe("note: start *bold* middle *also bold* end");
  });

  it("should convert blockquotes to quote:", () => {
    const md = "> Wise words";
    const itText = convertMarkdownToIntentText(md);
    expect(itText).toBe("quote: Wise words");
  });

  it("should convert horizontal rules to ---", () => {
    const md = "---";
    const itText = convertMarkdownToIntentText(md);
    expect(itText).toBe("---");
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
