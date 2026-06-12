// Arabic (any-language) keywords + the ISO date standard.
//
// The format is language-neutral: a keyword is any Unicode word, so Arabic
// domain keywords parse as typed `custom` blocks with Arabic property keys —
// fully queryable, exactly like ASCII ones. Dates are canonically ISO 8601 so
// range queries and sorting behave; the validator flags locale formats.
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  queryBlocks,
  documentToSource,
  renderHTML,
  validateDocumentSemantic,
} from "../src/index";

const AR = `عنوان: عقد خدمات
مصروف: كراسي مكتب | المورد: ايكيا | المبلغ: 1240 | فئة: أثاث
مصروف: قهوة | المورد: ستاربكس | المبلغ: 85 | فئة: ضيافة
مهمة: تجهيز العرض | مسؤول: أحمد | موعد: 2026-07-01`;

describe("Arabic keywords (Unicode keyword grammar)", () => {
  it("parses Arabic keywords as typed custom blocks with the keyword preserved", () => {
    const doc = parseIntentText(AR);
    expect(doc.blocks.map((b) => b.type)).toEqual([
      "custom",
      "custom",
      "custom",
      "custom",
    ]);
    expect(doc.blocks[1].properties?.keyword).toBe("مصروف");
    expect(doc.blocks[1].content).toBe("كراسي مكتب");
  });

  it("parses Arabic property keys and values", () => {
    const doc = parseIntentText(AR);
    expect(doc.blocks[1].properties?.["المورد"]).toBe("ايكيا");
    expect(doc.blocks[3].properties?.["مسؤول"]).toBe("أحمد");
  });

  it("queries by Arabic property value and by Arabic keyword", () => {
    const doc = parseIntentText(AR);
    const byCat = queryBlocks(doc, {
      where: [{ field: "فئة", operator: "=", value: "أثاث" }],
    });
    expect(byCat.matched).toBe(1);
    expect(byCat.blocks[0].content).toBe("كراسي مكتب");

    const byKw = queryBlocks(doc, {
      where: [{ field: "keyword", operator: "=", value: "مصروف" }],
    });
    expect(byKw.matched).toBe(2);
  });

  it("date-range queries work on Arabic-keyed blocks with ISO dates", () => {
    const doc = parseIntentText(AR);
    const due = queryBlocks(doc, {
      where: [{ field: "موعد", operator: "<", value: "2026-08-01" }],
    });
    expect(due.matched).toBe(1);
  });

  it("round-trips Arabic lines (property order may normalize)", () => {
    const doc = parseIntentText(AR);
    const back = documentToSource(doc);
    const reparsed = parseIntentText(back);
    expect(reparsed.blocks[1].properties?.["المورد"]).toBe("ايكيا");
    expect(reparsed.blocks[1].properties?.keyword).toBe("مصروف");
  });

  it("renders Arabic content safely", () => {
    const html = renderHTML(parseIntentText(AR));
    expect(html).toContain("كراسي مكتب");
  });

  it("still treats non-keyword Arabic prose as text", () => {
    const doc = parseIntentText("هذا نص عادي بدون نقطتين");
    expect(doc.blocks[0].type).toBe("text");
  });
});

describe("ISO date standard (DATE_NOT_ISO)", () => {
  it("flags ambiguous locale dates on date-bearing keys", () => {
    const doc = parseIntentText(
      "task: Review | due: 09/03/2026\ndone: Ship | at: 10.03.2026",
    );
    const res = validateDocumentSemantic(doc);
    const codes = res.issues.filter((i) => i.code === "DATE_NOT_ISO");
    expect(codes.length).toBe(2);
    expect(codes[0].type).toBe("warning");
  });

  it("accepts ISO dates, ISO timestamps, and template placeholders", () => {
    const doc = parseIntentText(
      [
        "task: A | due: 2026-03-09",
        "sign: B | at: 2026-03-06T14:32:00Z",
        "deadline: C | date: {{invoice.dueDate}}",
      ].join("\n"),
    );
    const res = validateDocumentSemantic(doc);
    expect(res.issues.filter((i) => i.code === "DATE_NOT_ISO")).toEqual([]);
  });
});
