import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { Apple, MonitorDown, Cpu, ShieldAlert } from "lucide-react";

/* ── Desktop download page ───────────────────────────────────────────────────
 * Pulls the latest installers straight from the GitHub Release assets so the
 * links always point at the newest build (asset names carry the version, so we
 * resolve them at runtime rather than hard-coding URLs). Auto-detects the
 * visitor's OS to surface the right installer first; everything else stays
 * listed below. Falls back to the Releases page if the API is unreachable.
 */

const REPO = "intenttext/IntentText";
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

type Asset = { name: string; url: string; size: number };
type OS = "mac" | "windows" | "other";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "other";
  const s = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (s.includes("mac")) return "mac";
  if (s.includes("win")) return "windows";
  return "other";
}

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// macOS: .dmg / .app.tar.gz · Windows: .msi / .exe / .nsis
function classify(name: string): OS | null {
  const n = name.toLowerCase();
  if (n.endsWith(".dmg")) return "mac";
  if (n.endsWith(".msi") || n.endsWith(".exe")) return "windows";
  return null;
}

function DownloadButton({
  asset,
  primary,
}: {
  asset: Asset;
  primary?: boolean;
}) {
  return (
    <Link
      className={`button button--lg ${primary ? "button--primary" : "button--secondary"}`}
      href={asset.url}
      style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}
    >
      <MonitorDown size={18} />
      {asset.name}
      {asset.size ? (
        <span style={{ opacity: 0.7, fontWeight: 400 }}>
          ({fmtSize(asset.size)})
        </span>
      ) : null}
    </Link>
  );
}

export default function Download(): React.ReactElement {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [version, setVersion] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [os, setOs] = useState<OS>("other");

  useEffect(() => {
    setOs(detectOS());
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        setVersion((data.tag_name || "").replace(/^desktop-v?/, "v"));
        const list: Asset[] = (data.assets || [])
          .filter((a: any) => classify(a.name))
          .map((a: any) => ({
            name: a.name,
            url: a.browser_download_url,
            size: a.size,
          }));
        setAssets(list);
      })
      .catch(() => setFailed(true));
  }, []);

  const mac = (assets || []).filter((a) => classify(a.name) === "mac");
  const win = (assets || []).filter((a) => classify(a.name) === "windows");
  const ordered: { os: OS; label: string; icon: React.ReactNode; items: Asset[] }[] =
    [
      { os: "mac", label: "macOS", icon: <Apple size={22} />, items: mac },
      {
        os: "windows",
        label: "Windows",
        icon: <Cpu size={22} />,
        items: win,
      },
    ].sort((a, b) => (a.os === os ? -1 : b.os === os ? 1 : 0));

  return (
    <Layout
      title="Download Dotit Desktop"
      description="Download the Dotit desktop app for macOS and Windows — a native editor and trust workbench for .it documents."
    >
      <main className="container margin-vert--xl">
        <div className="text--center margin-bottom--lg">
          <h1>Download Dotit for desktop</h1>
          <p style={{ fontSize: "1.1rem", maxWidth: 640, margin: "0 auto" }}>
            A native, local-first app for <code>.it</code> documents — WYSIWYG
            editor, workspace-wide search, and trust operations (seal, sign,
            verify). {version ? <>Latest: <strong>{version}</strong>.</> : null}
          </p>
        </div>

        {failed ? (
          <div className="text--center">
            <p>Couldn’t load the latest build automatically.</p>
            <Link className="button button--primary button--lg" href={RELEASES_URL}>
              View all downloads on GitHub
            </Link>
          </div>
        ) : !assets ? (
          <p className="text--center">Loading the latest release…</p>
        ) : assets.length === 0 ? (
          <div className="text--center">
            <p>
              No installers are attached to the latest release yet. They’ll
              appear here once the first desktop build publishes.
            </p>
            <Link className="button button--secondary button--lg" href={RELEASES_URL}>
              Check the Releases page
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
              maxWidth: 880,
              margin: "0 auto",
            }}
          >
            {ordered.map((group) => (
              <div
                key={group.os}
                className="card"
                style={{
                  padding: "1.5rem",
                  border:
                    group.os === os
                      ? "2px solid var(--ifm-color-primary)"
                      : "1px solid var(--ifm-color-emphasis-300)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: ".5rem",
                    marginBottom: "1rem",
                  }}
                >
                  {group.icon}
                  <h2 style={{ margin: 0 }}>{group.label}</h2>
                  {group.os === os ? (
                    <span className="badge badge--primary">Your system</span>
                  ) : null}
                </div>
                {group.items.length ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: ".75rem",
                    }}
                  >
                    {group.items.map((a, i) => (
                      <DownloadButton key={a.name} asset={a} primary={i === 0} />
                    ))}
                  </div>
                ) : (
                  <p style={{ opacity: 0.7 }}>No build for this platform yet.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className="margin-top--xl"
          style={{ maxWidth: 720, margin: "3rem auto 0" }}
        >
          <div
            style={{
              display: "flex",
              gap: ".75rem",
              padding: "1rem 1.25rem",
              borderRadius: 10,
              background: "var(--ifm-color-warning-contrast-background)",
              border: "1px solid var(--ifm-color-warning-dark)",
            }}
          >
            <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>These builds are not yet code-signed.</strong>
              <ul style={{ margin: ".5rem 0 0" }}>
                <li>
                  <strong>macOS:</strong> right-click the app → <em>Open</em>{" "}
                  the first time to bypass Gatekeeper.
                </li>
                <li>
                  <strong>Windows:</strong> on the SmartScreen prompt, click{" "}
                  <em>More info → Run anyway</em>.
                </li>
              </ul>
              <p style={{ margin: ".5rem 0 0", opacity: 0.8 }}>
                Signed &amp; notarized installers are coming. Prefer to build
                from source? See the{" "}
                <Link to="/docs/guide/quick-start">documentation</Link>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
