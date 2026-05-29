import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const publicDir = path.join(root, "public");
const tauriIconsDir = path.join(root, "src-tauri", "icons");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function cp(src, dst) {
  fs.copyFileSync(src, dst);
  console.log(
    `copied ${path.relative(root, src)} -> ${path.relative(root, dst)}`,
  );
}

function hasCmd(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", shell: "/bin/zsh" });
    return true;
  } catch {
    return false;
  }
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit", shell: "/bin/zsh" });
}

ensureDir(tauriIconsDir);

const png512 = path.join(publicDir, "android-chrome-512x512.png");
const png192 = path.join(publicDir, "android-chrome-192x192.png");
const png32 = path.join(publicDir, "favicon-32x32.png");
const ico = path.join(publicDir, "favicon.ico");

if (
  !fs.existsSync(png512) ||
  !fs.existsSync(png192) ||
  !fs.existsSync(png32) ||
  !fs.existsSync(ico)
) {
  throw new Error(
    "Missing required public icon assets. Expected favicon.ico, favicon-32x32.png, android-chrome-192x192.png, android-chrome-512x512.png.",
  );
}

cp(png512, path.join(tauriIconsDir, "icon.png"));
cp(png32, path.join(tauriIconsDir, "32x32.png"));
cp(png192, path.join(tauriIconsDir, "128x128.png"));
cp(png512, path.join(tauriIconsDir, "256x256.png"));
cp(png512, path.join(tauriIconsDir, "128x128@2x.png"));
cp(ico, path.join(tauriIconsDir, "icon.ico"));

if (hasCmd("sips") && hasCmd("iconutil")) {
  const iconset = path.join(tauriIconsDir, "dotit.iconset");
  ensureDir(iconset);

  run(
    `sips -z 16 16 "${png512}" --out "${path.join(iconset, "icon_16x16.png")}" >/dev/null`,
  );
  run(
    `sips -z 32 32 "${png512}" --out "${path.join(iconset, "icon_16x16@2x.png")}" >/dev/null`,
  );
  run(
    `sips -z 32 32 "${png512}" --out "${path.join(iconset, "icon_32x32.png")}" >/dev/null`,
  );
  run(
    `sips -z 64 64 "${png512}" --out "${path.join(iconset, "icon_32x32@2x.png")}" >/dev/null`,
  );
  run(
    `sips -z 128 128 "${png512}" --out "${path.join(iconset, "icon_128x128.png")}" >/dev/null`,
  );
  run(
    `sips -z 256 256 "${png512}" --out "${path.join(iconset, "icon_128x128@2x.png")}" >/dev/null`,
  );
  run(
    `sips -z 256 256 "${png512}" --out "${path.join(iconset, "icon_256x256.png")}" >/dev/null`,
  );
  run(
    `sips -z 512 512 "${png512}" --out "${path.join(iconset, "icon_256x256@2x.png")}" >/dev/null`,
  );
  run(
    `sips -z 512 512 "${png512}" --out "${path.join(iconset, "icon_512x512.png")}" >/dev/null`,
  );
  run(`cp "${png512}" "${path.join(iconset, "icon_512x512@2x.png")}"`);
  run(
    `iconutil -c icns "${iconset}" -o "${path.join(tauriIconsDir, "icon.icns")}"`,
  );
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log(
    "generated src-tauri/icons/icon.icns from public/android-chrome-512x512.png",
  );
} else {
  console.warn(
    "sips/iconutil not available, keeping existing .icns if present",
  );
}
