// path-guard.ts — capability-scoped filesystem access for the main process (G-12).
//
// The renderer is an untrusted surface: a hostile `.it` document could XSS the
// page and then call the `invoke` fs handlers (read_file/write_file/delete_file/
// rename_file/open_external/…). Without scoping, that is arbitrary full-disk read
// and write. PathGuard enforces a capability model: a renderer-supplied path is
// reachable ONLY if it resolves (symlinks included) to a location inside a folder
// the user GRANTED — and grants come only from trusted sources (an OS dialog, a
// file-association open, the persisted vault registry), never from the renderer.
//
// Pure node fs/path so it is unit-testable without Electron. The Electron layer
// (index.ts) constructs one guard, seeds it, and calls resolveInside()/
// assertOpenableExternally() in every fs handler.

import {
  realpathSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, basename, sep, extname } from "node:path";

/** Extensions allowed for `open_external` (shell.openPath) — never executables/scripts. */
export const EXTERNAL_OPEN_EXTENSIONS = new Set([
  ".it", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp",
  ".txt", ".csv", ".json", ".md", ".html", ".docx", ".xlsx", ".pptx",
]);

export interface PathGuardOptions {
  /** A JSON file (in userData) where in-session grants are persisted. Main-only. */
  persistPath?: string;
  /** Always-allowed roots (e.g. the OS temp dir for export/print scratch). */
  implicitRoots?: string[];
}

export class PathGuard {
  #roots = new Set<string>(); // canonical absolute directory paths
  #persistPath?: string;

  constructor(opts: PathGuardOptions = {}) {
    this.#persistPath = opts.persistPath;
    for (const r of opts.implicitRoots ?? []) this.#add(r);
    this.#load();
  }

  /** Canonicalize a directory (resolve symlinks if it exists) and register it. */
  #add(dir: string): void {
    if (typeof dir !== "string" || !dir) return;
    try {
      this.#roots.add(existsSync(dir) ? realpathSync(dir) : resolve(dir));
    } catch {
      this.#roots.add(resolve(dir));
    }
  }

  #load(): void {
    if (!this.#persistPath || !existsSync(this.#persistPath)) return;
    try {
      const arr = JSON.parse(readFileSync(this.#persistPath, "utf8"));
      if (Array.isArray(arr)) for (const r of arr) this.#add(r);
    } catch {
      /* corrupt/absent — start empty */
    }
  }

  #persist(): void {
    if (!this.#persistPath) return;
    try {
      mkdirSync(dirname(this.#persistPath), { recursive: true });
      writeFileSync(this.#persistPath, JSON.stringify([...this.#roots]));
    } catch {
      /* best-effort */
    }
  }

  /**
   * Grant a directory as an allowed root. TRUSTED callers only — OS dialog results,
   * file-association argv, the persisted vault registry. NEVER pass a raw
   * renderer-supplied value here.
   */
  grantDir(dir: string): void {
    this.#add(dir);
    this.#persist();
  }

  /** Grant a file's containing directory (e.g. a dialog-picked / associated file). */
  grantFile(file: string): void {
    if (typeof file === "string" && file) this.grantDir(dirname(file));
  }

  /** Seed many roots at once (startup: vault registry + persisted grants). */
  seed(dirs: Iterable<string>): void {
    for (const d of dirs) this.#add(d);
    this.#persist();
  }

  roots(): string[] {
    return [...this.#roots];
  }

  #isInside(canon: string): boolean {
    for (const root of this.#roots) {
      const r = root.endsWith(sep) ? root.slice(0, -1) : root;
      if (canon === r || canon.startsWith(r + sep)) return true;
    }
    return false;
  }

  /**
   * Canonicalize a renderer-supplied path and assert it is inside a granted root.
   * Resolves symlinks (so a symlink inside a granted root that points OUT is
   * rejected). For a not-yet-existing path (a write/rename target), canonicalizes the
   * nearest existing ancestor (catching a symlinked parent) and re-appends the tail.
   * Throws on any path outside the granted set. Returns the canonical absolute path.
   */
  resolveInside(p: unknown, opts: { allowCreate?: boolean } = {}): string {
    if (typeof p !== "string" || p.length === 0) {
      throw new Error("invalid path");
    }
    let canon: string;
    if (existsSync(p)) {
      canon = realpathSync(p);
    } else {
      if (!opts.allowCreate) throw new Error(`path not found or not allowed: ${p}`);
      const abs = resolve(p);
      const tail: string[] = [basename(abs)];
      let parent = dirname(abs);
      while (!existsSync(parent) && parent !== dirname(parent)) {
        tail.unshift(basename(parent));
        parent = dirname(parent);
      }
      const realParent = existsSync(parent) ? realpathSync(parent) : parent;
      canon = resolve(realParent, ...tail);
    }
    if (!this.#isInside(canon)) {
      throw new Error(`path outside granted folders: ${p}`);
    }
    return canon;
  }
}

/** Reject opening a file type that could execute. Use for `open_external`. */
export function assertOpenableExternally(p: string): void {
  const ext = extname(p).toLowerCase();
  if (!EXTERNAL_OPEN_EXTENSIONS.has(ext)) {
    throw new Error(`refusing to open file type: ${ext || "(no extension)"}`);
  }
}
