import { describe, it, expect } from "vitest";
import { parseIntentText } from "../src/parser";

describe("IntentText v1.3 - Accessibility Improvements", () => {
  describe("Implicit paragraphs (body-text)", () => {
    it("should parse lines without keywords as body-text", () => {
      const input = `title: My Document
This is implicit body text.
It needs no keyword prefix.

note: This is a note`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].type).toBe("title");
      expect(doc.blocks[1].type).toBe("body-text");
      expect(doc.blocks[1].content).toBe(
        "This is implicit body text. It needs no keyword prefix.",
      );
      expect(doc.blocks[2].type).toBe("text");
    });
  });

  describe("Inline links", () => {
    it("should parse [text](url) as inline links", () => {
      const input = `note: Visit [our docs](https://docs.com) for more info.`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].type).toBe("text");
      expect(doc.blocks[0].inline).toHaveLength(3);
      expect(doc.blocks[0].inline![0].type).toBe("text");
      expect(doc.blocks[0].inline![1].type).toBe("link");
      expect(doc.blocks[0].inline![1].value).toBe("our docs");
      // href is on link type
      expect(
        (
          doc.blocks[0].inline![1] as {
            type: "link";
            value: string;
            href: string;
          }
        ).href,
      ).toBe("https://docs.com");
    });

    it("should handle multiple inline links", () => {
      const input = `note: See [docs](https://docs.com) and [api](https://api.com).`;

      const doc = parseIntentText(input);

      const linkNodes = doc.blocks[0].inline!.filter((n) => n.type === "link");
      expect(linkNodes).toHaveLength(2);
    });
  });

  describe("Checkbox tasks", () => {
    it("should parse [ ] as task block", () => {
      const input = `[ ] Review this document`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].type).toBe("task");
      expect(doc.blocks[0].content).toBe("Review this document");
    });

    it("should parse [x] as a completed task (type:task, status:done)", () => {
      const input = `[x] Review this document`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].type).toBe("task");
      expect(doc.blocks[0].properties?.status).toBe("done");
      expect(doc.blocks[0].content).toBe("Review this document");
    });

    it("should parse multiple checkbox tasks", () => {
      const input = `[ ] First task
[x] Completed task
[ ] Another pending task`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].type).toBe("task");
      expect(doc.blocks[1].type).toBe("task");
      expect(doc.blocks[1].properties?.status).toBe("done");
      expect(doc.blocks[2].type).toBe("task");
    });
  });

  describe("Property shortcuts", () => {
    it("should expand !high to priority:high", () => {
      const input = `[ ] Important task !high`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].type).toBe("task");
      expect(doc.blocks[0].properties?.priority).toBe("high");
      expect(doc.blocks[0].content).not.toContain("!high");
    });

    it("should expand !critical to priority:critical", () => {
      const input = `[ ] Critical bug !critical`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].properties?.priority).toBe("critical");
    });

    it("should expand @username to owner:username", () => {
      const input = `[ ] Review document @sarah`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].properties?.owner).toBe("sarah");
      expect(doc.blocks[0].content).not.toContain("@sarah");
    });

    it("should handle multiple shortcuts", () => {
      const input = `[ ] Launch feature @ahmed !high`;

      const doc = parseIntentText(input);

      expect(doc.blocks[0].properties?.owner).toBe("ahmed");
      expect(doc.blocks[0].properties?.priority).toBe("high");
      expect(doc.blocks[0].content).toBe("Launch feature");
    });
  });

  describe("Combined v1.3 features", () => {
    it("should handle complex document with all features", () => {
      const input = `title: Project Plan

This is a simple project plan for regular people.

section: Tasks
[ ] Review proposal @sarah !high
[x] Initial draft @ahmed
[ ] Get feedback from [stakeholders](https://team.com)

note: Check our [documentation](https://docs.com) for details.`;

      const doc = parseIntentText(input);

      // Check structure
      expect(doc.blocks[0].type).toBe("title");
      expect(doc.blocks[1].type).toBe("body-text");
      expect(doc.blocks[2].type).toBe("section");

      // Check tasks with shortcuts
      const section = doc.blocks[2];
      expect(section.children?.[0].type).toBe("task");
      expect(section.children?.[0].properties?.owner).toBe("sarah");
      expect(section.children?.[0].properties?.priority).toBe("high");

      // Check inline link
      expect(section.children?.[2].inline?.some((n) => n.type === "link")).toBe(
        true,
      );
    });
  });
});
