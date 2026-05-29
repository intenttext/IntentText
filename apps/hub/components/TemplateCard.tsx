import Link from "next/link";
import type { HubTemplate } from "@/types/hub";

const categoryColors: Record<string, { bg: string; text: string }> = {
  agent: { bg: "rgba(167,139,250,0.12)", text: "var(--purple)" },
  workflow: { bg: "rgba(96,165,250,0.12)", text: "var(--blue)" },
  document: { bg: "rgba(74,222,128,0.12)", text: "var(--green)" },
  business: { bg: "rgba(96,165,250,0.12)", text: "var(--blue)" },
  editorial: { bg: "rgba(251,191,36,0.12)", text: "var(--yellow)" },
  book: { bg: "rgba(251,146,60,0.12)", text: "var(--orange)" },
  personal: { bg: "rgba(74,222,128,0.12)", text: "var(--green)" },
  organization: { bg: "rgba(96,165,250,0.12)", text: "var(--blue)" },
  developer: { bg: "rgba(167,139,250,0.12)", text: "var(--purple)" },
  other: { bg: "rgba(136,146,176,0.12)", text: "var(--text-muted)" },
};

export default function TemplateCard({ template }: { template: HubTemplate }) {
  const colors = categoryColors[template.category] ?? categoryColors.document;

  return (
    <Link
      href={`/templates/${template.slug}`}
      className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm shadow-black/10 transition-all hover:border-[var(--purple)] hover:shadow-md hover:shadow-purple-500/5"
    >
      <span
        className="mb-3 inline-block w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase"
        style={{ background: colors.bg, color: colors.text }}
      >
        {template.category}
      </span>
      {template.trust?.frozen && (
        <span className="mb-3 ml-2 inline-block w-fit rounded-full bg-[rgba(251,113,133,0.12)] px-2.5 py-1 text-xs font-semibold text-[var(--red)]">
          🔒 Sealed
        </span>
      )}
      {template.trust?.tracked && !template.trust?.frozen && (
        <span className="mb-3 ml-2 inline-block w-fit rounded-full bg-[rgba(96,165,250,0.12)] px-2.5 py-1 text-xs font-semibold text-[var(--blue)]">
          📋 Tracked
        </span>
      )}
      <h3 className="mb-1 text-lg font-bold text-[var(--text)] group-hover:text-[var(--purple)]">
        {template.name}
      </h3>
      <p className="mb-4 line-clamp-2 text-sm text-[var(--text-muted)]">
        {template.description}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
          >
            {tag}
          </span>
        ))}
      </div>
      <span className="mt-3 text-xs font-medium text-[var(--purple)] opacity-0 transition-opacity group-hover:opacity-100">
        View template →
      </span>
    </Link>
  );
}
