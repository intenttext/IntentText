/**
 * QR Code encoder (ISO/IEC 18004), byte mode, versions 1–40, all four error
 * correction levels — written here so core stays dependency-free. Output is a
 * module matrix and a vector SVG (prints sharp, fetches nothing).
 *
 * Every code it produces is proven in tests/qr.test.ts by an independent decoder
 * (jsQR, a dev dependency) that must return the exact input bytes.
 *
 * Text is encoded as UTF-8 bytes in byte mode, the form phone readers decode.
 */

export type QrEcc = "L" | "M" | "Q" | "H";

export interface QrCode {
  version: number;
  ecc: QrEcc;
  mask: number;
  /** Modules per side (version × 4 + 17), without the quiet zone. */
  size: number;
  /** `modules[y][x]` — true is dark. */
  modules: boolean[][];
}

const ECC_ORDER: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** The two format bits for each level (ISO/IEC 18004 Table 12). */
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Error correction codewords per block, and number of blocks, by level then
// version (index 0 unused) — ISO/IEC 18004 Table 9.
// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** Modules available for data + error correction after the function patterns. */
function rawDataModules(version: number): number {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

function dataCodewords(version: number, ecc: QrEcc): number {
  const e = ECC_ORDER[ecc];
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[e][version] * NUM_ERROR_CORRECTION_BLOCKS[e][version]
  );
}

/** Byte-mode character-count field width. */
const countBits = (version: number) => (version <= 9 ? 8 : 16);

/** The most bytes a code of this version and level holds in byte mode. */
export function qrCapacity(version: number, ecc: QrEcc): number {
  return Math.floor((dataCodewords(version, ecc) * 8 - 4 - countBits(version)) / 8);
}

// ── Reed–Solomon over GF(2^8), primitive polynomial 0x11D ────────────────────

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ── Codewords ────────────────────────────────────────────────────────────────

function dataBits(bytes: Uint8Array, version: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacity - bits.length)); // terminator
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  for (let pad = 0xec; codewords.length < capacity / 8; pad ^= 0xec ^ 0x11) codewords.push(pad);
  return codewords;
}

/** Split into blocks, append each block's error correction, interleave. */
function withErrorCorrection(data: number[], version: number, ecc: QrEcc): number[] {
  const e = ECC_ORDER[ecc];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[e][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(eccLen);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const block = dat.concat(rsRemainder(dat, divisor));
    if (i < numShortBlocks) block.splice(dat.length, 0, -1); // align short blocks
    blocks.push(block);
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (const block of blocks) if (block[i] !== -1) out.push(block[i]);
  }
  return out;
}

// ── Matrix ───────────────────────────────────────────────────────────────────

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 17 - 7; result.length < count; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Matrix {
  readonly size: number;
  readonly modules: boolean[][];
  readonly fixed: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => Array(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => Array(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.fixed[y][x] = true;
  }

  drawFunctionPatterns(): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          this.set(x, y, d !== 2 && d !== 4);
        }
      }
    }
    const align = alignmentPositions(this.version);
    const last = align.length - 1;
    for (let i = 0; i < align.length; i++) {
      for (let j = 0; j < align.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
    this.drawFormatBits("M", 0); // reserve the areas; redrawn once the mask is chosen
    this.drawVersionBits();
  }

  drawFormatBits(ecc: QrEcc, mask: number): void {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, bit(i));
    this.set(8, n - 8, true); // the dark module
  }

  drawVersionBits(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, dark);
      this.set(b, a, dark);
    }
  }

  /** Place codewords in the two-column zigzag, skipping function modules. */
  drawCodewords(codewords: number[]): void {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this.fixed[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number): void {
    const fn = MASKS[mask];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.fixed[y][x] && fn(x, y)) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** ISO/IEC 18004 §7.8.3 penalty: runs, 2×2 blocks, finder look-alikes, balance. */
  penalty(): number {
    const n = this.size;
    const m = this.modules;
    let score = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      // 1:1:3:1:1 finder look-alike with four light modules on either side.
      for (let i = 0; i + 7 <= n; i++) {
        const core =
          get(i) && !get(i + 1) && get(i + 2) && get(i + 3) && get(i + 4) && !get(i + 5) && get(i + 6);
        if (!core) continue;
        const light = (from: number) => {
          for (let k = from; k < from + 4; k++) if (k >= 0 && k < n && get(k)) return false;
          return true;
        };
        if (light(i - 4) || light(i + 7)) score += 40;
      }
    };
    for (let y = 0; y < n; y++) line((x) => m[y][x]);
    for (let x = 0; x < n; x++) line((y) => m[y][x]);
    let dark = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (m[y][x]) dark++;
        if (x + 1 < n && y + 1 < n) {
          const c = m[y][x];
          if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
        }
      }
    }
    const total = n * n;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

/**
 * Encode `data` (text as UTF-8, or raw bytes) as the smallest QR code that holds
 * it at level `ecc`. The mask is chosen by the standard's penalty unless forced.
 * Throws RangeError when the data exceeds version 40.
 */
export function encodeQr(
  data: string | Uint8Array,
  ecc: QrEcc = "M",
  options: { mask?: number } = {},
): QrCode {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let version = 1;
  while (version <= 40 && qrCapacity(version, ecc) < bytes.length) version++;
  if (version > 40) {
    throw new RangeError(
      `QR payload of ${bytes.length} bytes exceeds the ${qrCapacity(40, ecc)} a level-${ecc} code holds`,
    );
  }
  const codewords = withErrorCorrection(dataBits(bytes, version, ecc), version, ecc);

  const build = (mask: number) => {
    const matrix = new Matrix(version);
    matrix.drawFunctionPatterns();
    matrix.drawCodewords(codewords);
    matrix.applyMask(mask);
    matrix.drawFormatBits(ecc, mask);
    return matrix;
  };

  let mask = options.mask ?? -1;
  if (mask < 0) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      const p = build(candidate).penalty();
      if (p < best) [best, mask] = [p, candidate];
    }
  }
  const matrix = build(mask);
  return { version, ecc, mask, size: matrix.size, modules: matrix.modules };
}

/**
 * A QR code as an inline SVG: one square path per dark module on a white field
 * with the standard 4-module quiet zone. `size` is any CSS length (default 22mm).
 */
export function qrSvg(
  data: string | Uint8Array,
  options: { ecc?: QrEcc; size?: string } = {},
): string {
  const code = encodeQr(data, options.ecc ?? "M");
  const side = code.size + 8;
  const size = /^\d+(\.\d+)?(mm|cm|in|pt|px)$/.test(options.size ?? "") ? options.size : "22mm";
  let d = "";
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) if (code.modules[y][x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${size}" height="${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${side}" height="${side}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`
  );
}
