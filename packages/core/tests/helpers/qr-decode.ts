// Independent QR decoders for the tests: ZXing and jsQR (dev dependencies with
// their own tables). A code core draws is only trusted once these read it back.
//
// Known decoder defect: jsQR 1.4.0 lists the version-23 alignment centres as
// 6,30,54,74,102 where ISO/IEC 18004 Annex E says 6,30,54,78,102, so it misreads
// every version-23 code. Version 23 is proven by ZXing alone (see qr.test.ts).
import jsQR from "jsqr";
import {
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  QRCodeReader,
  ResultMetadataType,
  RGBLuminanceSource,
} from "@zxing/library";

/** Gray pixels (0 = dark) of a module grid with a 4-module quiet zone. */
export function rasterModules(modules: boolean[][], scale = 3) {
  const n = modules.length;
  const side = (n + 8) * scale;
  const gray = new Uint8ClampedArray(side * side).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) gray[((y + 4) * scale + dy) * side + (x + 4) * scale + dx] = 0;
      }
    }
  }
  return { gray, width: side, height: side };
}

const HINTS = new Map<DecodeHintType, unknown>([[DecodeHintType.PURE_BARCODE, true]]);

/** ZXing: the byte-mode payload, or null if the image does not decode. */
export function decodeZXing(gray: Uint8ClampedArray, width: number, height: number, pure = true) {
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height)));
    const hints = pure ? HINTS : new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);
    const result = new QRCodeReader().decode(bitmap, hints);
    const segments = result.getResultMetadata()?.get(ResultMetadataType.BYTE_SEGMENTS) as
      | Uint8Array[]
      | undefined;
    return segments ? segments.flatMap((s) => Array.from(s)) : [];
  } catch {
    return null;
  }
}

/** jsQR: the raw payload bytes, or null if the image does not decode. */
export function decodeJsQR(gray: Uint8ClampedArray, width: number, height: number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = gray[i];
    rgba[i * 4 + 3] = 255;
  }
  const r = jsQR(rgba, width, height, { inversionAttempts: "dontInvert" });
  return r ? r.binaryData : null;
}

/** The module grid an SVG from `qrSvg` draws (one `M x y h1v1h-1z` per dark module). */
export function modulesFromSvg(svg: string): boolean[][] {
  const side = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
  const n = side - 8;
  const grid = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (const m of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) grid[+m[2] - 4][+m[1] - 4] = true;
  return grid;
}
