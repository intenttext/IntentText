import { findUserByUsername } from "@/lib/users";
import { getCommunityTemplatesByUsername } from "@/lib/templates";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export default async function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const user = await findUserByUsername(params.username);
  if (!user) notFound();

  const templates = await getCommunityTemplatesByUsername(user.username);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Hub
      </Link>

      <div className="mb-8 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatar_url}
          alt={user.username}
          width={64}
          height={64}
          className="rounded-full"
        />
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Joined {new Date(user.joined_at).toLocaleDateString()} ·{" "}
            {user.published_templates} template
            {user.published_templates !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-bold">Published Templates</h2>

      {templates.length === 0 ? (
        <p className="py-8 text-center text-[var(--text-muted)]">
          No published templates yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <Link
              key={t.slug}
              href={`/templates/${t.slug}`}
              className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--purple)]"
            >
              <h3 className="mb-1 font-medium group-hover:text-[var(--purple)]">
                {t.name}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                {t.description}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>{t.category}</span>
                {t.tier && (
                  <>
                    <span>·</span>
                    <span>{t.tier}</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const user = await findUserByUsername(params.username);
  if (!user) return {};
  return {
    title: `${user.name} (@${user.username}) — IntentText Hub`,
    description: `${user.name}'s templates on IntentText Hub.`,
  };
}
