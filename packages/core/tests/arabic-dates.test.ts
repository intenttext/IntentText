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
  it("registered Arabic aliases → canonical types; unregistered → custom", () => {
    const doc = parseIntentText(AR);
    // عنوان is a registered alias (→ title); مهمة → task; مصروف is a custom
    // domain keyword (no alias) and passes through typed + preserved.
    expect(doc.blocks.map((b) => b.type)).toEqual([
      "title",
      "custom",
      "custom",
      "task",
    ]);
    expect(doc.blocks[0].keywordAlias).toBe("عنوان");
    expect(doc.blocks[1].properties?.keyword).toBe("مصروف");
    expect(doc.blocks[1].content).toBe("كراسي مكتب");
  });

  it("Arabic alias round-trips stay Arabic, byte-stable (seal-safe)", () => {
    const src = [
      "عنوان: عرض سعر",
      "أعمدة: الوصف | الكمية",
      "صف: تطوير | 1",
      "مؤشر: الإجمالي | value: 16500",
      "توقيع: أحمد | role: المدير | at: 2026-06-12T10:00:00Z",
    ].join("\n");
    expect(documentToSource(parseIntentText(src)).trim()).toBe(src);
  });

  it("cross-language query: type=task matches مهمة lines", () => {
    const doc = parseIntentText("مهمة: مراجعة العرض | due: 2026-07-01");
    expect(doc.blocks[0].type).toBe("task");
    expect(
      queryBlocks(doc, {
        where: [{ field: "type", operator: "=", value: "task" }],
      }).matched,
    ).toBe(1);
  });

  it("English aliases also round-trip as written now (abstract: stays abstract:)", () => {
    expect(documentToSource(parseIntentText("abstract: hi")).trim()).toBe(
      "abstract: hi",
    );
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

describe("reserved symbols: \\| escaping", () => {
  it("escaped pipes land as literal pipes in content and prop values", () => {
    const doc = parseIntentText(
      "task: Review docs \\| specs | owner: Ahmed\ncontact: Acme | note: A \\| B",
    );
    expect(doc.blocks[0].content).toBe("Review docs | specs");
    expect(doc.blocks[0].properties?.owner).toBe("Ahmed");
    expect(doc.blocks[1].properties?.note).toBe("A | B");
  });

  it("serializer re-escapes — escaped-pipe documents round-trip stable", () => {
    const src = "task: Review docs \\| specs | owner: Ahmed";
    const once = documentToSource(parseIntentText(src)).trim();
    expect(once).toBe(src);
    // and the cycle is a fixpoint
    expect(documentToSource(parseIntentText(once)).trim()).toBe(once);
  });

  it("colons inside content and values need no escaping", () => {
    const doc = parseIntentText("quote: He said: watch this | by: Sara");
    expect(doc.blocks[0].content).toBe("He said: watch this");
    expect(doc.blocks[0].properties?.by).toBe("Sara");
  });
});
