import { mkdir, cp, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const sourceDir = path.join(
  projectRoot,
  "node_modules",
  "@intenttext",
  "core",
  "dist",
  "rust-wasm",
);
const targetDir = path.join(projectRoot, "public", "rust-wasm");

async function run() {
  try {
    const sourceStats = await stat(sourceDir);
    if (!sourceStats.isDirectory()) {
      throw new Error(`Source is not a directory: ${sourceDir}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[prepare:wasm] Missing Rust/WASM assets at ${sourceDir}`);
    console.error(`[prepare:wasm] ${message}`);
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
  console.log(`[prepare:wasm] Copied Rust/WASM assets to ${targetDir}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prepare:wasm] Failed: ${message}`);
  process.exit(1);
});
