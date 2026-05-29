import type { HubTemplate } from "@/types/hub";
import TemplateCard from "./TemplateCard";
import CategoryTabs from "./CategoryTabs";
import Link from "next/link";

function buildPageUrl(page: number, params: URLSearchParams) {
  const p = new URLSearchParams(params);
  if (page > 1) p.set("page", String(page));
  else p.delete("page");
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export default function TemplateGrid({
  templates,
  category,
  search,
  page,
  totalPages,
  total,
}: {
  templates: HubTemplate[];
  category: string;
  search: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category);
  if (search) params.set("q", search);

  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <CategoryTabs active={category} />
        <span className="text-sm text-[var(--text-muted)]">
          {total === 0 ? "No" : total} template
          {total !== 1 ? "s" : ""}
          {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
        </span>
      </div>
      {templates.length === 0 ? (
        <p className="py-12 text-center text-[var(--text-muted)]">
          No templates found. Try a different search or category.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1, params)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:border-[var(--purple)]"
            >
              ← Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1, params)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:border-[var(--purple)]"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
