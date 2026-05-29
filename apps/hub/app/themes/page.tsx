import Link from "next/link";
import { getThemes } from "@/lib/themes";
import type { HubTheme } from "@/types/hub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Themes — IntentText Hub",
  description: "Browse IntentText themes — styles for your documents.",
};

function ThemeCard({ theme }: { theme: HubTheme }) {
  let parsed: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
  } = {};
  try {
    parsed = JSON.parse(theme.theme_json);
  } catch {
    // ignore
  }

  const bgColor = parsed.colors?.background ?? "#ffffff";
  const textColor = parsed.colors?.text ?? "#1a1a2e";
  const accentColor = parsed.colors?.accent ?? "#2563eb";

  return (
    <Link
      href={`/themes/${theme.slug}`}
      className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-colors hover:border-[var(--purple)]"
    >
      {/* Color preview strip */}
      <div
        className="flex h-24 items-center justify-center text-sm font-medium"
        style={{ background: bgColor, color: textColor }}
      >
        <span style={{ color: accentColor }}>Aa</span>
        <span className="ml-2">Sample Text</span>
      </div>
      <div className="p-4">
        <h3 className="mb-1 font-bold text-[var(--text)] group-hover:text-[var(--purple)]">
          {theme.title}
        </h3>
        <p className="mb-3 line-clamp-2 text-sm text-[var(--text-muted)]">
          {theme.description}
        </p>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{theme.installs} installs</span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              theme.tier === "curated"
                ? "bg-[rgba(74,222,128,0.12)] text-[var(--green)]"
                : "bg-[rgba(96,165,250,0.12)] text-[var(--blue)]"
            }`}
          >
            {theme.tier}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function ThemesPage() {
  const themes = await getThemes({ status: "approved", limit: 50 });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Hub
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Themes</h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        Browse IntentText themes. Install any theme with{" "}
        <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">
          intenttext theme install &lt;name&gt;
        </code>
      </p>

      {themes.length === 0 ? (
        <p className="py-12 text-center text-[var(--text-muted)]">
          No themes available yet. The 8 built-in themes are included with{" "}
          <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">
            @intenttext/core
          </code>
          .
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((t) => (
            <ThemeCard key={t.slug} theme={t} />
          ))}
        </div>
      )}
    </main>
  );
}
