import { Suspense } from "react";
import { getTemplates, getTemplateCount } from "@/lib/templates";
import TemplateGrid from "@/components/TemplateGrid";
import HubHeader from "@/components/HubHeader";

const PAGE_SIZE = 12;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string; page?: string };
}) {
  const category = searchParams.category ?? "all";
  const search = searchParams.q ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const skip = (page - 1) * PAGE_SIZE;

  const [templates, total] = await Promise.all([
    getTemplates({ category, search, limit: PAGE_SIZE, skip }),
    getTemplateCount({ category, search }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main>
      <Suspense>
        <HubHeader />
      </Suspense>
      <Suspense>
        <TemplateGrid
          templates={JSON.parse(JSON.stringify(templates))}
          category={category}
          search={search}
          page={page}
          totalPages={totalPages}
          total={total}
        />
      </Suspense>

      {/* Coming Soon */}
      <section className="mx-auto max-w-6xl border-t border-[var(--border)] px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-muted)]">
              Explore
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              <a
                href="/themes"
                className="text-[var(--purple)] hover:underline"
              >
                Browse Themes
              </a>
              {" · "}
              <a
                href="/publish"
                className="text-[var(--purple)] hover:underline"
              >
                Publish a Template
              </a>
              {" · "}
              Star &amp; fork · Org templates
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl border-t border-[var(--border)] px-6 py-8">
        <div className="flex flex-col items-center gap-3 text-sm text-[var(--text-muted)]">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/intenttext/intenttext"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text)] transition-colors"
            >
              GitHub
            </a>
            <span>·</span>
            <a
              href="https://www.npmjs.com/package/@intenttext/core"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text)] transition-colors"
            >
              npm
            </a>
            <span>·</span>
            <a
              href="https://iteditor.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text)] transition-colors"
            >
              Editor
            </a>
            <span>·</span>
            <a
              href="https://itdocs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text)] transition-colors"
            >
              Docs
            </a>
          </div>
          <p>IntentText — The first document format that is natively JSON.</p>
        </div>
      </footer>
    </main>
  );
}
