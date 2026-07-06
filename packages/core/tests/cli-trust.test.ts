import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The CLI is the surface a bank wires into a CI/deploy gate (`dotit verify f.it`). It
// MUST fail closed: stripping the seal must not pass (exit 2), tampering must fail
// (exit 1), and re-sealing an already-sealed file must not fabricate a signer in the
// audit log. These spawn the real built CLI and assert on exit codes (findings #29/#30).

const PKG = join(__dirname, "..");
const CLI = join(PKG, "cli.js");
let dir: string;

function run(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

const write = (name: string, body: string) => {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
};

beforeAll(() => {
  if (!existsSync(join(PKG, "dist", "index.js"))) {
    execSync("npm run build", { cwd: PKG, stdio: "ignore" });
  }
  dir = mkdtempSync(join(tmpdir(), "it-cli-"));
});

describe("CLI trust gates fail closed", () => {
  it("verify: exit 0 intact, 1 tampered, 2 unsealed (fail closed)", () => {
    const p = write("d.it", "title: Order\n\ntext: Transfer USD 100 to account 111.\n");
    expect(run(["seal", p, "--signer", "CFO"]).code).toBe(0);
    expect(run(["verify", p]).code).toBe(0);

    const unsealed = write("u.it", "title: Order\n\ntext: Transfer USD 100 to account 111.\n");
    const ur = run(["verify", unsealed]);
    expect(ur.code).toBe(2);
    expect(ur.out).toMatch(/NOT sealed/i);

    const tampered = write(
      "t.it",
      readFileSync(p, "utf8").replace("USD 100", "USD 900000"),
    );
    expect(run(["verify", tampered]).code).toBe(1);
  });

  it("seal: an already-sealed file is a no-op that does NOT fabricate a signer", () => {
    const p = write("s.it", "title: Order\n\ntext: Pay the vendor.\n");
    run(["seal", p, "--signer", "Alice"]);
    const r = run(["seal", p, "--signer", "Mallory Attacker"]);
    expect(r.out).toMatch(/already sealed/i);
    expect(r.out).not.toMatch(/Mallory/);
    // The file still names Alice, not Mallory.
    expect(readFileSync(p, "utf8")).not.toMatch(/Mallory/);
  });

  it("verify: fails (exit 1) and reports hidden content", () => {
    const p = write(
      "h.it",
      "title: Contract\n\nThe fee is 5000 QAR.\n\ntext: Buyer waives all claims. | color: transparent\n",
    );
    run(["seal", p, "--signer", "X"]);
    const r = run(["verify", p]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Hidden/i);
  });
});
