// core 3.9.0 — the `seal:` and `qr:` keywords.
//
//   seal: places the trust band where the author wants it (instead of the page
//         corner) — once, on a signed/sealed document only.
//   qr:   a QR code for any payload, with a caption.
//
// Every QR rendered here is read back by BOTH independent decoders
// (helpers/qr-decode.ts) and must equal the source bytes exactly. jsQR 1.4.0 misreads
// every version-23 code (documented in the helper), so those are read by ZXing alone.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseIntentText,
  documentToSource,
  renderHTML,
  renderPrint,
  sealDocument,
  verifyDocument,
  computeDocumentHash,
  KEYWORD_COUNT,
} from "../src/index";
import { EXTENSION_REGISTRY } from "../src/language-registry";
import { decodeJsQR, decodeZXing, modulesFromSvg, rasterModules } from "./helpers/qr-decode";

const fixture = (name: string) => readFileSync(join(__dirname, "print-fixtures", name), "utf8");
const sealed = (src: string) => sealDocument(src, { signer: "Billing", role: "Accounts" }).source;

/** Every QR in `html`, decoded by both decoders; returns the decoded payloads. */
function qrPayloads(html: string): string[] {
  return [...html.matchAll(/<svg[^>]*aria-label="QR code"[\s\S]*?<\/svg>/g)].map(([svg]) => {
    const grid = modulesFromSvg(svg);
    const version = (grid.length - 17) / 4;
    const { gray, width, height } = rasterModules(grid);
    const z = decodeZXing(gray, width, height);
    expect(z, "ZXing").not.toBeNull();
    if (version !== 23) expect(decodeJsQR(gray, width, height), "jsQR").toEqual(z);
    return new TextDecoder().decode(Uint8Array.from(z as number[]));
  });
}

const PAYLOADS: Array<[string, string]> = [
  ["a short link", "https://example.qa/d/INV-0042"],
  ["one byte", "x"],
  ["an Arabic payload", "https://example.qa/تحقق/فاتورة-٤٢ — شركة الأفق"],
  ["marks that inline parsing would eat", "https://example.qa/a_b_c?x=1&y=*z*#frag @who =eq= ~t~ ^s^"],
  ["300 ASCII bytes", "https://example.qa/" + "abcdefghij".repeat(28)],
  ["900 bytes", "https://example.qa/" + "Zq7_".repeat(220)],
];

describe("keywords: seal and qr are registered", () => {
  it("are extension keywords of the doc namespace, since 3.9; the canonical set stays 40", () => {
    expect(KEYWORD_COUNT).toBe(40);
    for (const keyword of ["seal", "qr"]) {
      const entry = EXTENSION_REGISTRY.find((e) => e.keyword === keyword);
      expect(entry, keyword).toMatchObject({ namespace: "doc", since: "3.9", xForm: `x-doc: ${keyword}` });
    }
  });

  it("parse to their own block types and round-trip byte for byte", () => {
    const src = "seal: | align: center\nqr: https://example.qa/x | label: Scan | size: 24mm | ecc: Q\n";
    const doc = parseIntentText(src);
    expect(doc.blocks.map((b) => b.type)).toEqual(["seal", "qr"]);
    expect(doc.blocks[0].properties).toEqual({ align: "center" });
    expect(doc.blocks[1].content).toBe("https://example.qa/x");
    expect(documentToSource(doc)).toBe(src);
  });
});

describe("qr: the block", () => {
  for (const [what, payload] of PAYLOADS) {
    for (const ecc of ["L", "M", "Q", "H"]) {
      it(`${what} at level ${ecc} decodes to the source bytes (print + screen)`, () => {
        const src = `qr: ${payload} | ecc: ${ecc}\n`;
        const doc = parseIntentText(src);
        expect(qrPayloads(renderPrint(doc))).toEqual([payload]);
        expect(qrPayloads(renderHTML(doc))).toEqual([payload]);
      });
    }
  }

  it("a payload with an escaped pipe reads back with the pipe", () => {
    const html = renderPrint(parseIntentText("qr: a\\|b\\|c\n"));
    expect(qrPayloads(html)).toEqual(["a|b|c"]);
  });

  for (const [lang, label, payload] of [
    ["en", "Scan to verify", "https://example.qa/d/INV-0042"],
    ["ar", "امسح للتحقق من الفاتورة — شركة الأفق", "https://example.qa/تحقق/INV-0042"],
  ]) {
    it(`draws a figure with its caption, aligned by align: (${lang})`, () => {
      for (const align of ["start", "center", "end"]) {
        const html = renderPrint(parseIntentText(`qr: ${payload} | label: ${label} | align: ${align}\n`));
        expect(html).toContain(`<figure class="it-qr it-qr--${align}">`);
        expect(html).toContain(`<figcaption class="it-qr-caption" dir="auto">${label}</figcaption>`);
        expect(qrPayloads(html)).toEqual([payload]);
      }
    });
  }

  it("no label means no caption; no align means the end side", () => {
    const html = renderPrint(parseIntentText("qr: https://example.qa/x\n"));
    expect(html).not.toContain("<figcaption");
    expect(html).toContain('<figure class="it-qr it-qr--end">');
  });

  it("size sets the drawn size; an invalid size is 22mm", () => {
    const at = (size: string) =>
      renderPrint(parseIntentText(`qr: https://example.qa/x | size: ${size}\n`)).match(/<svg[^>]*width="([^"]+)"/)![1];
    expect(at("24mm")).toBe("24mm");
    expect(at("1.5in")).toBe("1.5in");
    for (const bad of ["big", "24", "24mm;color:red", "-3mm", "url(x)"]) expect(at(bad)).toBe("22mm");
    expect(renderPrint(parseIntentText("qr: https://example.qa/x\n"))).toMatch(/<svg[^>]*width="22mm"/);
  });

  it("an invalid ecc is M (the same code as asking for M)", () => {
    const svg = (ecc: string) =>
      renderPrint(parseIntentText(`qr: https://example.qa/x${ecc}\n`)).match(/<svg[\s\S]*?<\/svg>/)![0];
    const m = renderPrint(parseIntentText("qr: https://example.qa/x | ecc: M\n")).match(/<svg[\s\S]*?<\/svg>/)![0];
    expect(svg(" | ecc: Z")).toBe(m);
    expect(svg(" | ecc: ")).toBe(m);
    expect(svg("")).toBe(m);
    // a lowercase level is accepted
    const h = renderPrint(parseIntentText("qr: https://example.qa/x | ecc: H\n")).match(/<svg[\s\S]*?<\/svg>/)![0];
    expect(svg(" | ecc: h")).toBe(h);
  });

  it("a payload too long for any code draws nothing and is reported, never thrown", () => {
    const long = "A".repeat(3000);
    const doc = parseIntentText(`qr: ${long} | label: Too long\n`);
    expect(doc.diagnostics?.some((d) => d.code === "QR_PAYLOAD")).toBe(true);
    let html = "";
    expect(() => {
      html = renderPrint(doc);
      renderHTML(doc);
    }).not.toThrow();
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("Too long");
    // the level changes the limit: 2500 bytes fit at L but not at H
    const l = parseIntentText(`qr: ${"A".repeat(2500)} | ecc: L\n`);
    expect(l.diagnostics?.some((d) => d.code === "QR_PAYLOAD")).toBeFalsy();
    expect(qrPayloads(renderPrint(l))).toEqual(["A".repeat(2500)]);
    expect(parseIntentText(`qr: ${"A".repeat(2500)} | ecc: H\n`).diagnostics?.some((d) => d.code === "QR_PAYLOAD")).toBe(true);
  });

  it("an empty payload draws nothing", () => {
    const doc = parseIntentText("qr: | label: Nothing\n");
    expect(doc.diagnostics?.some((d) => d.code === "QR_PAYLOAD")).toBe(true);
    expect(renderPrint(doc)).not.toContain("<figure");
  });

  it("its CSS is emitted only when a qr: block exists", () => {
    const plain = parseIntentText("Just prose.\n");
    expect(renderPrint(plain)).not.toContain(".it-qr");
    expect(renderHTML(plain)).not.toContain(".it-qr");
    const withQr = parseIntentText("qr: https://example.qa/x\n");
    expect(renderPrint(withQr)).toContain(".it-qr--end{align-items:flex-end;}");
    expect(renderHTML(withQr)).toContain(".it-qr--end{align-items:flex-end;}");
  });

  it("inside a section it renders in place", () => {
    const html = renderPrint(parseIntentText("section: Verify\nqr: https://example.qa/x | label: Scan\n"));
    expect(html.indexOf("Verify")).toBeLessThan(html.indexOf("<figure"));
  });

  it("is part of the sealed content: changing the payload breaks the seal", () => {
    const src = sealed("title: Receipt\nqr: https://example.qa/r/1\n");
    expect(verifyDocument(src).intact).toBe(true);
    expect(verifyDocument(src.replace("/r/1", "/r/2")).intact).toBe(false);
    // size and align are presentation; the payload and label are content
    expect(verifyDocument(src.replace("/r/1\n", "/r/1 | size: 30mm | align: center\n")).intact).toBe(true);
    expect(verifyDocument(src.replace("/r/1\n", "/r/1 | label: Scan\n")).intact).toBe(false);
  });
});

describe("seal: the trust band where the author puts it", () => {
  const lines = (lang: string) =>
    lang === "ar"
      ? ["title: عقد خدمة", "text: تلتزم شركة الأفق بالشروط أدناه.", "seal: | align: start", "text: نهاية العقد."]
      : ["title: Service Agreement", "text: Horizon Trading Co. agrees to the terms below.", "seal: | align: start", "text: End of agreement."];

  for (const lang of ["en", "ar"]) {
    const src = sealed(lines(lang).join("\n") + "\n");

    it(`a sealed document verifies intact WITH a seal: line (${lang})`, () => {
      expect(verifyDocument(src).intact).toBe(true);
      expect(src).toContain("seal: | align: start");
    });

    it(`align is presentation: changing it keeps the seal and the content hash (${lang})`, () => {
      const moved = src.replace("align: start", "align: center");
      expect(verifyDocument(moved).intact).toBe(true);
      expect(computeDocumentHash(moved)).toBe(computeDocumentHash(src));
    });

    it(`removing or adding a seal: line is a content change (${lang})`, () => {
      expect(verifyDocument(src.replace("seal: | align: start\n", "")).intact).toBe(false);
      expect(verifyDocument(src.replace("seal: | align: start\n", "seal: | align: start\nseal:\n")).intact).toBe(false);
    });

    for (const [name, render] of [
      ["renderPrint", (s: string, o = {}) => renderPrint(parseIntentText(s), { source: s, ...o })],
      ["renderHTML", (s: string, o = {}) => renderHTML(parseIntentText(s), { source: s, ...o })],
    ] as const) {
      it(`${name}: the band is drawn at the seal: line, once, not pinned to the page (${lang})`, () => {
        const html = render(src);
        const body = html.slice(html.indexOf("</style>"));
        const band = body.indexOf('<div class="it-trust-band"');
        expect(band).toBeGreaterThan(-1);
        expect(body.indexOf('class="it-trust-band"', band + 20)).toBe(-1);
        expect(body.indexOf(lines(lang)[1].slice(6))).toBeLessThan(band);
        expect(band).toBeLessThan(body.indexOf(lines(lang)[3].slice(6)));
        expect(body).toContain('<div class="it-seal-slot it-seal-slot--start">');
        expect(html).not.toMatch(/\.it-trust-band\{position:(fixed|absolute)/);
        expect(html).toContain(".it-seal-slot--end{justify-content:flex-end;}");
      });

      it(`${name}: align picks the side, default end (${lang})`, () => {
        for (const align of ["start", "center", "end"]) {
          expect(render(src.replace("align: start", `align: ${align}`))).toContain(`it-seal-slot--${align}">`);
        }
        expect(render(src.replace("seal: | align: start", "seal:"))).toContain('it-seal-slot--end">');
        expect(render(src.replace("align: start", "align: sideways"))).toContain('it-seal-slot--end">');
      });

      it(`${name}: further seal: lines render nothing (${lang})`, () => {
        const two = sealed(lines(lang).join("\n") + "\nseal:\nseal: | align: center\n");
        const html = render(two);
        expect(html.match(/<div class="it-trust-band"/g)).toHaveLength(1);
        expect(html.match(/it-seal-slot--/g)!.length).toBe(1 + 3); // one block + the three CSS rules
      });

      it(`${name}: a seal: line on an untrusted document renders nothing (${lang})`, () => {
        const draft = lines(lang).join("\n") + "\n";
        const html = render(draft);
        expect(html).not.toContain("it-trust-band");
        expect(html).not.toContain("it-seal-slot");
        expect(html).toContain(lines(lang)[1].slice(6));
        expect(html).toContain(lines(lang)[3].slice(6));
      });

      it(`${name}: seal: false draws no band at all (${lang})`, () => {
        const html = render(src, { seal: false });
        expect(html).not.toContain('<div class="it-trust-band');
        expect(html).not.toContain("it-seal-slot--start\">");
      });

      it(`${name}: the placed band carries the verify QR (${lang})`, () => {
        const url = lang === "ar" ? "https://example.qa/تحقق/INV-0042" : "https://example.qa/d/INV-0042/verify";
        const html = render(src, { seal: { verifyUrl: url } });
        expect(qrPayloads(html)).toEqual([url]);
        const body = html.slice(html.indexOf("</style>"));
        expect(body.indexOf("it-trust-band__qr")).toBeLessThan(body.indexOf(lines(lang)[3].slice(6)));
        expect(html).toContain(".it-trust-band__qr svg{display:block;}");
      });

      it(`${name}: the band is still the verified one — a tampered body shows SEAL BROKEN (${lang})`, () => {
        const html = render(src.replace(lines(lang)[1].slice(6), "forged text"));
        expect(html).toContain("SEAL BROKEN");
      });
    }

    it(`renderPrint: works in the bare view, and wins over sealPosition: "end" (${lang})`, () => {
      const bare = renderPrint(parseIntentText(src), { source: src, bare: true });
      expect(bare).toContain('<div class="it-seal-slot it-seal-slot--start">');
      const end = renderPrint(parseIntentText(src), { source: src, sealPosition: "end" });
      expect(end).toContain("it-seal-slot--start\">");
      expect(end).not.toContain('<div class="it-trust-band-end">');
      expect(end).not.toContain(".it-trust-band-end{");
    });

    it(`the seal: block inside a section places the band there (${lang})`, () => {
      const nested = sealed("title: T\nsection: Signatures\nseal: | align: end\nsection: After\ntext: later\n");
      const html = renderPrint(parseIntentText(nested), { source: nested });
      const body = html.slice(html.indexOf("</style>"));
      const i = body.indexOf('<div class="it-trust-band"');
      expect(body.indexOf("Signatures")).toBeLessThan(i);
      expect(i).toBeLessThan(body.indexOf("After"));
    });
  }

  it("renderHTML bare draws no band (the editor supplies its own), and seal: stays silent", () => {
    const src = sealed("title: T\nseal:\ntext: x\n");
    const html = renderHTML(parseIntentText(src), { source: src, bare: true });
    expect(html).not.toContain("it-trust-band");
    expect(html).not.toContain("it-seal-slot--end\">");
  });

  it("no render leaks the slot into the next one", () => {
    const src = sealed("title: T\nseal:\ntext: x\n");
    renderPrint(parseIntentText(src), { source: src });
    const plain = sealed("title: T\ntext: x\n");
    const html = renderPrint(parseIntentText(plain), { source: plain });
    expect(html).toContain("position:fixed");
    expect(html).not.toContain("it-seal-slot");
  });
});

describe("a document without seal:/qr: renders as it did", () => {
  it("the invoice fixtures, signed, are unchanged by the option plumbing", () => {
    for (const lang of ["ar", "en"]) {
      const src = sealed(fixture(`invoice-${lang}.it`));
      const html = renderPrint(parseIntentText(src), { source: src });
      expect(html).toContain("position:fixed");
      expect(html).not.toContain("it-seal-slot");
      expect(html).not.toContain(".it-qr");
    }
  });
});
