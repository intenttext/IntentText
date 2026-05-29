import { describe, it, expect } from "vitest";
import { convertHtmlToIntentText } from "../src/html-to-it";

describe("convertHtmlToIntentText", () => {
  describe("headings", () => {
    it("should convert h1 to title:", () => {
      expect(convertHtmlToIntentText("<h1>Hello World</h1>")).toBe(
        "title: Hello World",
      );
    });

    it("should convert h2 to section:", () => {
      expect(convertHtmlToIntentText("<h2>Chapter One</h2>")).toBe(
        "section: Chapter One",
      );
    });

    it("should convert h3-h6 to sub:", () => {
      expect(convertHtmlToIntentText("<h3>Details</h3>")).toBe("sub: Details");
      expect(convertHtmlToIntentText("<h4>More</h4>")).toBe("sub: More");
      expect(convertHtmlToIntentText("<h5>Deep</h5>")).toBe("sub: Deep");
    });
  });

  describe("paragraphs", () => {
    it("should convert p to note:", () => {
      expect(convertHtmlToIntentText("<p>Hello world</p>")).toBe(
        "note: Hello world",
      );
    });

    it("should handle multiple paragraphs", () => {
      const html = "<p>First</p><p>Second</p>";
      expect(convertHtmlToIntentText(html)).toBe("note: First\n\nnote: Second");
    });
  });

  describe("inline formatting", () => {
    it("should convert strong/b to *bold*", () => {
      expect(convertHtmlToIntentText("<p><strong>bold</strong> text</p>")).toBe(
        "note: *bold* text",
      );
    });

    it("should convert em/i to _italic_", () => {
      expect(convertHtmlToIntentText("<p><em>italic</em> text</p>")).toBe(
        "note: _italic_ text",
      );
    });

    it("should convert del/s to ~strike~", () => {
      expect(convertHtmlToIntentText("<p><del>deleted</del> text</p>")).toBe(
        "note: ~deleted~ text",
      );
    });

    it("should convert inline code to triple backticks", () => {
      expect(convertHtmlToIntentText("<p><code>const x</code></p>")).toBe(
        "note: ```const x```",
      );
    });

    it("should convert inline links to [text](url)", () => {
      expect(
        convertHtmlToIntentText(
          '<p>Visit <a href="https://example.com">here</a></p>',
        ),
      ).toBe("note: Visit [here](https://example.com)");
    });

    it("should strip javascript: links", () => {
      expect(
        convertHtmlToIntentText(
          '<p><a href="javascript:alert(1)">click</a></p>',
        ),
      ).toBe("note: click");
    });
  });

  describe("lists", () => {
    it("should convert unordered list", () => {
      const html = "<ul><li>First</li><li>Second</li></ul>";
      expect(convertHtmlToIntentText(html)).toBe("- First\n- Second");
    });

    it("should convert ordered list", () => {
      const html = "<ol><li>Step one</li><li>Step two</li></ol>";
      expect(convertHtmlToIntentText(html)).toBe("1. Step one\n2. Step two");
    });

    it("should convert task lists with checkboxes", () => {
      const html =
        '<ul><li><input type="checkbox"> Todo</li><li><input type="checkbox" checked> Done</li></ul>';
      expect(convertHtmlToIntentText(html)).toBe("task: Todo\ndone: Done");
    });
  });

  describe("blockquotes", () => {
    it("should convert blockquote to quote:", () => {
      expect(
        convertHtmlToIntentText("<blockquote>Wise words</blockquote>"),
      ).toBe("quote: Wise words");
    });
  });

  describe("code blocks", () => {
    it("should convert pre/code to fenced code block", () => {
      const html = "<pre><code>const x = 1;\nconst y = 2;</code></pre>";
      expect(convertHtmlToIntentText(html)).toBe(
        "```\nconst x = 1;\nconst y = 2;\n```",
      );
    });

    it("should handle pre without code child", () => {
      const html = "<pre>plain preformatted</pre>";
      expect(convertHtmlToIntentText(html)).toBe(
        "```\nplain preformatted\n```",
      );
    });
  });

  describe("images", () => {
    it("should convert img to image:", () => {
      expect(
        convertHtmlToIntentText('<img src="photo.jpg" alt="My Photo">'),
      ).toBe("image: My Photo | src: photo.jpg");
    });

    it("should include caption from title attribute", () => {
      expect(
        convertHtmlToIntentText(
          '<img src="photo.jpg" alt="Photo" title="A nice photo">',
        ),
      ).toBe("image: Photo | src: photo.jpg | caption: A nice photo");
    });

    it("should handle img inside p as block-level image", () => {
      expect(
        convertHtmlToIntentText('<p><img src="pic.png" alt="Pic"></p>'),
      ).toBe("image: Pic | src: pic.png");
    });
  });

  describe("links (block-level)", () => {
    it("should convert standalone link in p to link:", () => {
      expect(
        convertHtmlToIntentText(
          '<p><a href="https://docs.com">Documentation</a></p>',
        ),
      ).toBe("link: Documentation | to: https://docs.com");
    });
  });

  describe("tables", () => {
    it("should convert table with thead", () => {
      const html = `
        <table>
          <thead><tr><th>Name</th><th>Age</th></tr></thead>
          <tbody><tr><td>Ahmed</td><td>30</td></tr></tbody>
        </table>
      `;
      expect(convertHtmlToIntentText(html)).toBe(
        "| Name | Age |\n| Ahmed | 30 |",
      );
    });

    it("should convert table without thead", () => {
      const html = `
        <table>
          <tr><td>A</td><td>B</td></tr>
          <tr><td>1</td><td>2</td></tr>
        </table>
      `;
      expect(convertHtmlToIntentText(html)).toBe("| A | B |\n| 1 | 2 |");
    });
  });

  describe("horizontal rules", () => {
    it("should convert hr to ---", () => {
      expect(convertHtmlToIntentText("<hr>")).toBe("---");
    });
  });

  describe("script/style stripping", () => {
    it("should strip script tags", () => {
      expect(
        convertHtmlToIntentText(
          "<p>Hello</p><script>alert(1)</script><p>World</p>",
        ),
      ).toBe("note: Hello\n\nnote: World");
    });

    it("should strip style tags", () => {
      expect(
        convertHtmlToIntentText("<style>body{color:red}</style><p>Content</p>"),
      ).toBe("note: Content");
    });
  });

  describe("transparent containers", () => {
    it("should recurse through div/span/article", () => {
      const html = "<div><article><p>Inside article</p></article></div>";
      expect(convertHtmlToIntentText(html)).toBe("note: Inside article");
    });
  });

  describe("complex documents", () => {
    it("should convert a realistic HTML page", () => {
      const html = `
        <h1>Project Plan</h1>
        <p>This is the <strong>main</strong> plan.</p>
        <h2>Tasks</h2>
        <ul>
          <li>Design the UI</li>
          <li>Write the code</li>
        </ul>
        <h2>Notes</h2>
        <blockquote>Start simple, iterate fast.</blockquote>
        <hr>
        <p>End of document.</p>
      `;
      const result = convertHtmlToIntentText(html);
      expect(result).toContain("title: Project Plan");
      expect(result).toContain("note: This is the *main* plan.");
      expect(result).toContain("section: Tasks");
      expect(result).toContain("- Design the UI");
      expect(result).toContain("- Write the code");
      expect(result).toContain("section: Notes");
      expect(result).toContain("quote: Start simple, iterate fast.");
      expect(result).toContain("---");
      expect(result).toContain("note: End of document.");
    });
  });

  describe("empty/whitespace input", () => {
    it("should handle empty string", () => {
      expect(convertHtmlToIntentText("")).toBe("");
    });

    it("should handle whitespace-only", () => {
      expect(convertHtmlToIntentText("   \n  ")).toBe("");
    });
  });

  it("converts <img> to image: with src: (not deprecated at:)", () => {
    const result = convertHtmlToIntentText(
      '<img src="https://example.com/photo.jpg" alt="Photo">',
    );
    expect(result).toContain("src: https://example.com/photo.jpg");
    expect(result).not.toContain("at: https://example.com/photo.jpg");
  });
});
