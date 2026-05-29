import { getSession } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { getTemplatesByOwner } from "@/lib/templates";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Account — IntentText Hub",
};

export default async function AccountPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const user = await findUserById(session.user_id);
  if (!user) redirect("/login");

  const templates = await getTemplatesByOwner(user.id);

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
            Joined {new Date(user.joined_at).toLocaleDateString()} · {user.role}
          </p>
        </div>
        <div className="ml-auto">
          <a
            href="/api/auth/logout"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-muted)] hover:border-[var(--red)] hover:text-[var(--red)]"
          >
            Sign out
          </a>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold">Your Templates</h2>
        <Link
          href="/publish"
          className="rounded-lg bg-[var(--purple)] px-4 py-2 text-sm font-medium text-[var(--surface-2)] hover:opacity-90"
        >
          Publish New
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="py-8 text-center text-[var(--text-muted)]">
          You haven&apos;t published any templates yet.
        </p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.slug}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div>
                <Link
                  href={`/templates/${t.slug}`}
                  className="font-medium text-[var(--text)] hover:text-[var(--purple)]"
                >
                  {t.name}
                </Link>
                <p className="text-sm text-[var(--text-muted)]">
                  {t.description}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span
                  className={`rounded-full px-2.5 py-1 font-medium ${
                    t.status === "approved"
                      ? "bg-[rgba(166,227,161,0.15)] text-[var(--green)]"
                      : t.status === "community"
                        ? "bg-[rgba(137,180,250,0.15)] text-[var(--blue)]"
                        : t.status === "pending_review" ||
                            t.status === "pending"
                          ? "bg-[rgba(249,226,175,0.15)] text-[var(--yellow)]"
                          : t.status === "changes_requested"
                            ? "bg-[rgba(250,179,135,0.15)] text-[var(--orange)]"
                            : "bg-[rgba(243,139,168,0.15)] text-[var(--red)]"
                  }`}
                >
                  {t.status === "pending_review" ? "In Review" : t.status}
                </span>
                {t.tier && (
                  <span className="text-[var(--text-muted)]">{t.tier}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
