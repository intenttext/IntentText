import { getThemeBySlug } from "@/lib/themes";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export default async function ThemeDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const theme = await getThemeBySlug(params.slug);
  if (!theme) notFound();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(theme.theme_json);
  } catch {
    // ignore
  }

  const colors = (parsed.colors ?? {}) as Record<string, string>;
  const fonts = (parsed.fonts ?? {}) as Record<string, string>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/themes"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Themes
      </Link>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Preview */}
        <div className="lg:w-1/2">
          <div
            className="rounded-xl border p-8"
            style={{
              background: colors.background ?? "#fff",
              color: colors.text ?? "#1a1a2e",
              borderColor: colors.border ?? "#e5e7eb",
              fontFamily: fonts.body ?? "system-ui",
            }}
          >
            <h2
              className="mb-4 text-xl font-bold"
              style={{ color: colors.heading ?? colors.text ?? "#0f0f23" }}
            >
              Heading
            </h2>
            <p className="mb-3" style={{ lineHeight: fonts.leading ?? "1.6" }}>
              This is body text rendered in the <strong>{theme.title}</strong>{" "}
              theme. It demonstrates the color palette and font choices.
            </p>
            <p
              className="mb-3 text-sm"
              style={{ color: colors.muted ?? "#6b7280" }}
            >
              Muted text for secondary information.
            </p>
            <div
              className="rounded px-3 py-2 text-sm"
              style={{ background: colors["code-bg"] ?? "#f8fafc" }}
            >
              <code style={{ fontFamily: fonts.mono ?? "monospace" }}>
                code block preview
              </code>
            </div>
          </div>

          {/* Color swatches */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(colors).map(([key, val]) => (
              <div key={key} className="text-center">
                <div
                  className="h-8 w-8 rounded border border-[var(--border)]"
                  style={{ background: val }}
                  title={`${key}: ${val}`}
                />
                <span className="text-[10px] text-[var(--text-muted)]">
                  {key}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div className="lg:w-1/2">
          <h1 className="mb-2 text-2xl font-bold">{theme.title}</h1>
          <p className="mb-4 text-[var(--text-muted)]">{theme.description}</p>

          <div className="mb-6 space-y-1 text-sm text-[var(--text-muted)]">
            <p>
              Installs:{" "}
              <span className="text-[var(--text)]">{theme.installs}</span>
            </p>
            <p>
              Tier: <span className="text-[var(--text)]">{theme.tier}</span>
            </p>
            <p>
              Added:{" "}
              <span className="text-[var(--text)]">
                {new Date(theme.created_at).toLocaleDateString()}
              </span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg bg-[var(--surface-2)] p-4">
              <p className="mb-1 text-xs text-[var(--text-muted)]">
                Install via CLI
              </p>
              <code className="text-sm text-[var(--purple)]">
                intenttext theme install {theme.slug}
              </code>
            </div>
            <div className="rounded-lg bg-[var(--surface-2)] p-4">
              <p className="mb-1 text-xs text-[var(--text-muted)]">
                Use in document
              </p>
              <code className="text-sm text-[var(--purple)]">
                meta: | theme: {theme.slug}
              </code>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const theme = await getThemeBySlug(params.slug);
  if (!theme) return {};
  return {
    title: `${theme.title} Theme — IntentText Hub`,
    description: theme.description,
  };
}
