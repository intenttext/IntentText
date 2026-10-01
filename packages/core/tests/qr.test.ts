// The QR encoder is written in core with no dependency, so every code it makes is
// read back by TWO independent decoders — ZXing and jsQR, dev dependencies with
// their own tables — and must return the exact input bytes: every version 1–40,
// all four error correction levels, all eight masks, Arabic UTF-8 and raw binary.
// Byte capacities and alignment-pattern positions are also checked against the
// published ISO/IEC 18004 tables.
//
// One known decoder defect: jsQR 1.4.0 lists the version-23 alignment centres as
// 6,30,54,74,102 where the standard (Annex E) says 6,30,54,78,102, so it misreads
// every version-23 code and recovers only when error correction absorbs the damage.
// Version 23 is therefore proven by ZXing alone (and by the Annex E test below).
import { describe, it, expect } from "vitest";
import { encodeQr, qrCapacity, qrSvg, type QrCode, type QrEcc } from "../src/qr";
import { decodeJsQR, decodeZXing, modulesFromSvg, rasterModules } from "./helpers/qr-decode";

const ECCS: QrEcc[] = ["L", "M", "Q", "H"];
const utf8 = (s: string) => new TextEncoder().encode(s);

/** Both decoders must return the exact bytes (jsQR excepted at version 23, see above). */
function expectDecodes(code: QrCode, bytes: Uint8Array, what: string) {
  const { gray, width, height } = rasterModules(code.modules);
  expect(decodeZXing(gray, width, height), `ZXing ${what}`).toEqual(Array.from(bytes));
  if (code.version !== 23) expect(decodeJsQR(gray, width, height), `jsQR ${what}`).toEqual(Array.from(bytes));
}

function payload(length: number, seed: number): Uint8Array {
  // Deterministic, varied bytes (not one repeated value — that would hide errors).
  const out = new Uint8Array(length);
  let x = seed * 2654435761;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = 32 + ((x >>> 16) % 95); // printable ASCII
  }
  return out;
}

describe("qr: byte capacity matches ISO/IEC 18004", () => {
  // Byte-mode capacities from the standard's capacity table.
  const ISO: Array<[number, Record<QrEcc, number>]> = [
    [1, { L: 17, M: 14, Q: 11, H: 7 }],
    [2, { L: 32, M: 26, Q: 20, H: 14 }],
    [3, { L: 53, M: 42, Q: 32, H: 24 }],
    [4, { L: 78, M: 62, Q: 46, H: 34 }],
    [5, { L: 106, M: 84, Q: 60, H: 44 }],
    [10, { L: 271, M: 213, Q: 151, H: 119 }],
    [40, { L: 2953, M: 2331, Q: 1663, H: 1273 }],
  ];
  for (const [version, caps] of ISO) {
    for (const ecc of ECCS) {
      it(`v${version}-${ecc} holds ${caps[ecc]} bytes`, () => {
        expect(qrCapacity(version, ecc)).toBe(caps[ecc]);
        expect(encodeQr(payload(caps[ecc], version), ecc).version).toBe(version);
        if (version < 40) {
          expect(encodeQr(payload(caps[ecc] + 1, version), ecc).version).toBe(version + 1);
        }
      });
    }
  }

  it("refuses a payload larger than version 40 holds", () => {
    expect(() => encodeQr(payload(2954, 1), "L")).toThrow(RangeError);
  });
});

describe("qr: every code decodes back to the exact bytes (independent decoder)", () => {
  for (const ecc of ECCS) {
    it(`all 40 versions at ${ecc}, filled to capacity`, () => {
      for (let version = 1; version <= 40; version++) {
        const data = payload(qrCapacity(version, ecc), version);
        const code = encodeQr(data, ecc);
        expect(code.version).toBe(version);
        expect(code.size).toBe(version * 4 + 17);
        expectDecodes(code, data, `v${version}-${ecc}`);
      }
    }, 120_000);
  }

  it("all eight masks decode", () => {
    const data = utf8("https://example.qa/d/INV-0042/verify");
    for (let mask = 0; mask < 8; mask++) {
      const code = encodeQr(data, "M", { mask });
      expect(code.mask).toBe(mask);
      expectDecodes(code, data, `mask ${mask}`);
    }
  });

  it("Arabic text round-trips byte for byte (UTF-8)", () => {
    for (const text of [
      "تحقّق من الفاتورة INV-0042 — شركة الأفق للتجارة",
      "سند قبض رقم ٤٢ · الدوحة، قطر",
      "https://example.qa/تحقق?رقم=INV-0042&مبلغ=3,211.50",
    ]) {
      for (const ecc of ECCS) expectDecodes(encodeQr(text, ecc), utf8(text), `${ecc}: ${text}`);
    }
  });

  it("raw binary (every byte value) round-trips", () => {
    const data = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (const ecc of ECCS) expectDecodes(encodeQr(data, ecc), data, `binary ${ecc}`);
  });

  it("an empty payload is a valid code", () => {
    expectDecodes(encodeQr("", "M"), new Uint8Array(0), "empty");
  });
});

describe("qr: alignment patterns sit where ISO/IEC 18004 Annex E puts them", () => {
  const ANNEX_E: Array<[number, number[]]> = [
    [2, [6, 18]],
    [7, [6, 22, 38]],
    [14, [6, 26, 46, 66]],
    [22, [6, 26, 50, 74, 98]],
    [23, [6, 30, 54, 78, 102]],
    [32, [6, 34, 60, 86, 112, 138]],
    [40, [6, 30, 58, 86, 114, 142, 170]],
  ];
  // An alignment pattern: a dark centre, a light ring, a dark ring (5×5).
  const isAlignment = (m: boolean[][], cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (m[cy + dy][cx + dx] !== (Math.max(Math.abs(dx), Math.abs(dy)) !== 1)) return false;
      }
    }
    return true;
  };
  for (const [version, centres] of ANNEX_E) {
    it(`version ${version}: ${centres.join(", ")}`, () => {
      const { modules } = encodeQr(payload(qrCapacity(version, "M"), version), "M");
      const last = centres.length - 1;
      for (let i = 0; i <= last; i++) {
        for (let j = 0; j <= last; j++) {
          const finder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
          if (!finder) expect(isAlignment(modules, centres[i], centres[j]), `(${centres[i]},${centres[j]})`).toBe(true);
        }
      }
    });
  }
});

describe("qr: SVG", () => {
  it("draws exactly the encoded modules, with a quiet zone", () => {
    const text = "https://example.qa/d/INV-0042";
    const code = encodeQr(text, "Q");
    const svg = qrSvg(text, { ecc: "Q", size: "24mm" });
    const n = code.size + 8;
    expect(svg).toContain(`viewBox="0 0 ${n} ${n}"`);
    expect(svg).toContain('width="24mm" height="24mm"');
    expect(modulesFromSvg(svg)).toEqual(code.modules);
  });

  it("escapes nothing it doesn't need to: no text, no script, no external reference", () => {
    const svg = qrSvg('"><script>alert(1)</script>', { ecc: "L" });
    expect(svg).not.toContain("<script");
    expect(svg).not.toMatch(/href|url\(/);
  });
});
