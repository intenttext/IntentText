/**
 * path-guard.test.ts — adversarial tests for the desktop fs capability guard (G-12).
 *
 * The threat: a hostile `.it` XSSes the renderer, then calls the fs IPC handlers with
 * crafted paths to escape the user's folders. These tests are the escape attempts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PathGuard, assertOpenableExternally } from "../src/main/path-guard";

let base: string; // canonical temp sandbox
let vault: string; // the granted root
let outside: string; // a sibling the renderer must NOT reach

beforeAll(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "pg-")));
  vault = join(base, "vault");
  outside = join(base, "secret");
  mkdirSync(vault, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(vault, "doc.it"), "title: ok");
  writeFileSync(join(outside, "passwords.txt"), "TOP SECRET");
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

function guard(): PathGuard {
  const g = new PathGuard(); // no persist, no implicit roots
  g.grantDir(vault);
  return g;
}

describe("G-12: fs capability guard", () => {
  it("allows a file inside the granted vault", () => {
    const g = guard();
    expect(g.resolveInside(join(vault, "doc.it"))).toBe(
      realpathSync(join(vault, "doc.it")),
    );
  });

  it("rejects an absolute path outside any granted root", () => {
    const g = guard();
    expect(() => g.resolveInside(join(outside, "passwords.txt"))).toThrow(
      /outside granted|not found or not allowed/,
    );
  });

  it("rejects a ../ traversal that escapes the vault", () => {
    const g = guard();
    expect(() =>
      g.resolveInside(join(vault, "..", "secret", "passwords.txt")),
    ).toThrow(/outside granted/);
  });

  it("rejects a symlink INSIDE the vault that points OUT", () => {
    const g = guard();
    const link = join(vault, "escape");
    symlinkSync(outside, link); // vault/escape -> ../secret
    // reading "through" the symlink must resolve to the real (outside) target → blocked
    expect(() => g.resolveInside(join(link, "passwords.txt"))).toThrow(
      /outside granted/,
    );
  });

  it("rejects creating a NEW file outside the vault, allows inside", () => {
    const g = guard();
    expect(() =>
      g.resolveInside(join(outside, "evil.it"), { allowCreate: true }),
    ).toThrow(/outside granted/);
    // a brand-new file inside the vault is allowed (write target)
    expect(g.resolveInside(join(vault, "new.it"), { allowCreate: true })).toBe(
      join(realpathSync(vault), "new.it"),
    );
  });

  it("rejects a not-yet-existing path without allowCreate (no read of phantom files)", () => {
    const g = guard();
    expect(() => g.resolveInside(join(vault, "missing.it"))).toThrow(
      /not found or not allowed/,
    );
  });

  it("rejects a new file whose parent symlinks out of the vault", () => {
    const g = guard();
    const linkDir = join(vault, "outlink");
    symlinkSync(outside, linkDir); // vault/outlink -> ../secret
    expect(() =>
      g.resolveInside(join(linkDir, "evil.it"), { allowCreate: true }),
    ).toThrow(/outside granted/);
  });

  it("rejects empty / non-string paths", () => {
    const g = guard();
    expect(() => g.resolveInside("")).toThrow(/invalid path/);
    expect(() => g.resolveInside(undefined)).toThrow(/invalid path/);
    expect(() => g.resolveInside(42)).toThrow(/invalid path/);
  });

  it("grantFile grants the file's directory", () => {
    const g = new PathGuard();
    g.grantFile(join(vault, "doc.it"));
    expect(g.resolveInside(join(vault, "doc.it"))).toBeTruthy();
  });

  it("open_external allowlist: refuses executables/scripts, allows documents", () => {
    expect(() => assertOpenableExternally("/x/malware.sh")).toThrow(/refusing/);
    expect(() => assertOpenableExternally("/x/app.app")).toThrow(/refusing/);
    expect(() => assertOpenableExternally("/x/run.exe")).toThrow(/refusing/);
    expect(() => assertOpenableExternally("/x/report.pdf")).not.toThrow();
    expect(() => assertOpenableExternally("/x/doc.it")).not.toThrow();
  });

  it("persists grants for a later session (same persistPath)", () => {
    const persistPath = join(base, "granted-roots.json");
    new PathGuard({ persistPath }).grantDir(vault);
    // a fresh guard (app restart) loads the persisted grant
    const restarted = new PathGuard({ persistPath });
    expect(restarted.resolveInside(join(vault, "doc.it"))).toBeTruthy();
  });
});
