// Letterhead layout + image size (`image:` width/height/align/float, `style: image`)
// and `keep: previous`. The markup contracts and the "old output is unchanged" guards;
// print-layout-chrome.test.ts measures the same features through real Chrome.
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  renderHTML,
  renderPrint,
  computeDocumentHash,
  documentToSource,
} from "../src/index";
import * as legacy from "dotit-core-legacy";

const PNG = "./logo.png"; // data: URIs are not loaded by the renderer

const html = (src: string) => renderHTML(parseIntentText(src));
const imgTag = (h: string) => h.match(/<img [^>]*>/)![0];
const figTag = (h: string) => h.match(/<figure [^>]*>/)![0];

describe("image: width / height / align / float", () => {
  it("an image without the new props renders exactly as in 3.8.0", () => {
    for (const src of [
      `image: Logo | src: ${PNG}`,
      `image: Logo | src: ${PNG} | width: full`,
      `image: Logo | src: ${PNG} | width: half | caption: Fig`,
      `image: Logo | src: ${PNG} | width: 10 | height: tall`,
    ]) {
      expect(renderHTML(parseIntentText(src))).toBe(legacy.renderHTML(legacy.parseIntentText(src)));
      expect(renderPrint(parseIntentText(src))).toBe(
        legacy.renderPrint(legacy.parseIntentText(src)).replace(
          ".intent-document{max-width:none;margin:0;padding:0;}",
          ".intent-document{max-width:none;margin:0;padding:0 1px;}",
        ),
      );
    }
  });

  it("sizes the <img> with a CSS length only", () => {
    const tag = imgTag(html(`image: Logo | src: ${PNG} | width: 32mm | height: 18mm`));
    expect(tag).toContain('style="width:32mm;height:18mm;box-sizing:border-box"');
    expect(imgTag(html(`image: L | src: ${PNG} | width: 50%`))).toContain('style="width:50%;box-sizing:border-box"');
    expect(imgTag(html(`image: L | src: ${PNG} | width: 1.5in`))).toContain('style="width:1.5in;box-sizing:border-box"');
    // not a length: ignored exactly as today
    for (const bad of ["full", "half", "12", "auto", "3em", "10mm;position:fixed", "url(x)"]) {
      expect(imgTag(html(`image: L | src: ${PNG} | width: ${bad}`))).not.toContain("style=");
    }
  });

  it("cannot inject CSS through width / height / float / align", () => {
    const src = `image: L | src: ${PNG} | width: 10mm;background:url(https://evil/x) | height: 5mm"onload="x | align: center;color:red | float: start;x:y`;
    const out = html(src);
    expect(out).not.toContain("evil");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("color:red");
    expect(out).not.toContain("float:");
  });

  it("align places the figure on a logical side", () => {
    expect(figTag(html(`image: L | src: ${PNG} | width: 20mm | align: center`))).toContain(
      "width:fit-content;margin-inline:auto",
    );
    expect(figTag(html(`image: L | src: ${PNG} | align: start`))).toContain("margin-inline:0 auto");
    expect(figTag(html(`image: L | src: ${PNG} | align: end`))).toContain("margin-inline:auto 0");
    expect(figTag(html(`image: L | src: ${PNG} | align: sideways`))).not.toContain("style=");
  });

  it("float wraps the following blocks and ends at divider / section / title / table", () => {
    for (const closer of ["divider:", "---", "section: Terms", "title: Next", "headers: A | B\nrow: 1 | 2"]) {
      const out = html(
        `image: Logo | src: ${PNG} | width: 30mm | float: start\nCompany line one\nCompany line two\n${closer}\nAfter`,
      );
      expect(figTag(out)).toContain("float:inline-start");
      const clear = out.indexOf('class="it-float-clear"');
      expect(clear).toBeGreaterThan(out.indexOf("Company line two"));
      expect(clear).toBeLessThan(out.indexOf("After"));
      expect(out.match(/it-float-clear/g)!.length).toBe(1);
    }
    expect(figTag(html(`image: L | src: ${PNG} | float: end`))).toContain("float:inline-end");
    // a float with nothing to end it is closed at the end of the document
    expect(html(`image: L | src: ${PNG} | float: end\nText`)).toMatch(/it-float-clear[^>]*><\/div>$|it-float-clear/);
    // no float → no clear element
    expect(html(`image: L | src: ${PNG}\nText\n---`)).not.toContain("it-float-clear");
  });

  it("style: image | height sizes images document-wide (HTML and print)", () => {
    const src = `style: image | height: 18mm | width: 30mm\n\nimage: Logo | src: ${PNG}`;
    for (const out of [html(src), renderPrint(parseIntentText(src))]) {
      expect(out).toContain(".intent-image-img{width: 30mm; height: 18mm; box-sizing: border-box;}");
    }
    // a non-length is dropped; other targets keep their vocabulary (no width/height)
    expect(html(`style: image | height: tall\nimage: L | src: ${PNG}`)).not.toContain("height: tall");
    expect(html(`style: text | width: 10mm\nHello`)).not.toContain("width: 10mm");
    // without a style rule nothing is emitted
    expect(html(`image: L | src: ${PNG}`)).not.toContain(".intent-image-img{height: ");
  });

  it("float is hashed, width / height / align are not", () => {
    const base = `title: T\nimage: Logo | src: ${PNG}\nBody`;
    const h = (s: string) => computeDocumentHash(s);
    expect(h(`title: T\nimage: Logo | src: ${PNG} | width: 30mm | height: 10mm | align: end\nBody`)).toBe(h(base));
    expect(h(`title: T\nimage: Logo | src: ${PNG} | float: start\nBody`)).not.toBe(h(base));
  });

  it("round-trips byte for byte", () => {
    const src = `image: Logo | src: ${PNG} | width: 30mm | float: end\nCompany\n`;
    expect(documentToSource(parseIntentText(src))).toBe(src);
  });
});

const LEDGER = (n: number, tail = "keep: previous") =>
  [
    "headers: # | Item | Amount",
    ...Array.from({ length: n }, (_, i) => `row: ${i + 1} | Item ${i + 1} | ${(i + 1) * 10}.00`),
    "signline: Prepared by | role: Accountant | " + tail,
    "signline: Approved by | role: Manager | " + tail,
  ].join("\n");

describe("keep: previous", () => {
  it("renders the run inside the preceding table as a final unbreakable row group", () => {
    const out = html(LEDGER(5));
    const tail = out.match(/<tbody class="it-keep-tail"[^>]*>[\s\S]*?<\/tbody>/)![0];
    expect(tail).toContain("break-inside:avoid");
    // the table's last two data rows, then one keep row holding both signatures
    expect(tail.match(/<tr class="intent-row">/g)!.length).toBe(2);
    expect(tail).toContain("Item 4");
    expect(tail).toContain("Item 5");
    expect(tail).not.toContain("Item 3");
    expect(tail).toContain('<tr class="it-keep-row"><td colspan="3" class="it-keep-cell"');
    expect(tail).toContain("border-left:hidden;border-right:hidden;border-bottom:hidden;padding:0");
    expect(tail.match(/it-signline"/g)!.length).toBe(2);
    // the signatures are not also rendered after the table
    expect(out.indexOf("</table>")).toBeGreaterThan(out.lastIndexOf("Approved by"));
    expect(out.match(/Approved by/g)!.length).toBe(1);
    // earlier rows stay in the ordinary body
    expect(out).toMatch(/<tbody><tr class="intent-row">[\s\S]*Item 3[\s\S]*<\/tbody><tbody class="it-keep-tail"/);
  });

  it("works in renderPrint too", () => {
    expect(renderPrint(parseIntentText(LEDGER(5)))).toContain('<tbody class="it-keep-tail"');
  });

  it("short tables and a table without headers", () => {
    const one = html("headers: A | B\nrow: 1 | 2\nsignline: X | keep: previous");
    expect(one).toContain('class="it-keep-tail"');
    expect(one).not.toMatch(/<\/thead><tbody><\/tbody>/);
    const empty = html("headers: A | B\nsignline: X | keep: previous");
    expect(empty).toContain('<td colspan="2" class="it-keep-cell"');
  });

  it("never splits a merged (^) group across the two row groups", () => {
    const out = html(
      [
        "headers: A | B | C",
        "row: r1 | x | y",
        "row: r2 | g | y",
        "row: r3 | ^ | y",
        "row: r4 | < | z",
        "signline: X | keep: previous",
      ].join("\n"),
    );
    // r3 continues r2's rowspan, so the tail starts at r2
    const tail = out.match(/<tbody class="it-keep-tail"[\s\S]*<\/tbody>/)![0];
    expect(tail).toContain("r2");
    expect(tail).toContain('rowspan="2"');
    expect(tail).toContain('colspan="2"');
    expect(out.indexOf("r1")).toBeLessThan(out.indexOf('class="it-keep-tail"'));
  });

  it("wraps a non-table previous block and the run in a keep group", () => {
    const out = html("Closing paragraph.\nsignline: A | keep: previous\nsignline: B | keep: previous\nAfter");
    expect(out).toMatch(/<div class="it-keep-group" style="break-inside:avoid[^"]*"><p class="intent-text"[^>]*>Closing paragraph\.<\/p>[\s\S]*A[\s\S]*B[\s\S]*<\/div>/);
    expect(out.indexOf("After")).toBeGreaterThan(out.lastIndexOf("it-keep-group"));
  });

  it("keeps RTL (Arabic) documents working and mirrored", () => {
    const src = [
      "headers: م | البند | المبلغ",
      "row: 1 | بند ١ | 10.00",
      "row: 2 | بند ٢ | 20.00",
      "row: 3 | بند ٣ | 30.00",
      "signline: أعدّه | role: المحاسب | keep: previous",
    ].join("\n");
    const out = renderHTML(parseIntentText(src), {});
    expect(out).toContain('class="it-keep-tail"');
    expect(out).toContain("أعدّه");
    expect(out).toContain("بند ٣");
  });

  it("documents that do not use it render exactly as in 3.8.0", () => {
    const src = LEDGER(5, "width: 45%");
    expect(html(src)).not.toContain("it-keep");
    expect(html(src)).toBe(legacy.renderHTML(legacy.parseIntentText(src)));
    // `keep: previous` is a plain property: the model and source are unchanged by it
    const kept = LEDGER(5);
    expect(documentToSource(parseIntentText(kept))).toBe(kept);
    expect(JSON.stringify(parseIntentText(kept).blocks.map((b) => [b.type, b.content]))).toBe(
      JSON.stringify(legacy.parseIntentText(kept).blocks.map((b) => [b.type, b.content])),
    );
  });

  it("is hashed (it changes what the document says)", () => {
    expect(computeDocumentHash(LEDGER(3))).not.toBe(computeDocumentHash(LEDGER(3, "width: 45%")));
  });
});
