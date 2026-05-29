"use client";

import { useState, useEffect, useCallback } from "react";
import ItSourceViewer from "@/components/ItSourceViewer";
import type { HubTemplate } from "@/types/hub";
import type { SessionData } from "@/types/hub";

export default function ReviewPage() {
  const [user, setUser] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<HubTemplate[]>([]);
  const [selected, setSelected] = useState<HubTemplate | null>(null);
  const [feedback, setFeedback] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user ?? null);
        if (d.user && (d.user.role === "admin" || d.user.role === "reviewer")) {
          loadQueue();
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/admin/approve");
    if (res.ok) {
      const data = await res.json();
      setQueue(Array.isArray(data) ? data : []);
    }
  }, []);

  const handleAction = useCallback(
    async (action: string) => {
      if (!selected) return;
      setActing(true);
      try {
        await fetch("/api/admin/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: selected.slug,
            action,
            feedback: feedback || undefined,
            reason: feedback || undefined,
          }),
        });
        setSelected(null);
        setFeedback("");
        await loadQueue();
      } finally {
        setActing(false);
      }
    },
    [selected, feedback, loadQueue],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12 text-center text-[var(--text-muted)]">
        Loading…
      </main>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "reviewer")) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold">Access Denied</h1>
        <p className="text-[var(--text-muted)]">
          Only reviewers and admins can access the review queue.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">Review Queue</h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        {queue.length} template{queue.length !== 1 ? "s" : ""} pending review.
      </p>

      <div className="flex gap-6">
        {/* Queue list */}
        <div className="w-1/3 space-y-2">
          {queue.length === 0 ? (
            <p className="py-8 text-center text-[var(--text-muted)]">
              Queue is empty. All caught up!
            </p>
          ) : (
            queue.map((t) => (
              <button
                key={t.slug}
                onClick={() => {
                  setSelected(t);
                  setFeedback("");
                }}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selected?.slug === t.slug
                    ? "border-[var(--purple)] bg-[rgba(203,166,247,0.08)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--purple)]"
                }`}
              >
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  by {t.author} · {t.category}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1">
          {selected ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {selected.description}
                </p>
                <div className="mt-2 flex gap-2 text-xs text-[var(--text-muted)]">
                  <span>by {selected.author}</span>
                  <span>·</span>
                  <span>{selected.category}</span>
                  {selected.domain && (
                    <>
                      <span>·</span>
                      <span>{selected.domain}</span>
                    </>
                  )}
                </div>
              </div>

              <ItSourceViewer source={selected.source} />

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Feedback / Reason
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
                  placeholder="Optional feedback for the author…"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleAction("approve")}
                  disabled={acting}
                  className="rounded-lg bg-[var(--green)] px-6 py-2.5 text-sm font-medium text-[var(--surface-2)] hover:opacity-90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction("request_changes")}
                  disabled={acting}
                  className="rounded-lg bg-[var(--orange)] px-6 py-2.5 text-sm font-medium text-[var(--surface-2)] hover:opacity-90 disabled:opacity-50"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => handleAction("reject")}
                  disabled={acting}
                  className="rounded-lg bg-[var(--red)] px-6 py-2.5 text-sm font-medium text-[var(--surface-2)] hover:opacity-90 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-[var(--text-muted)]">
              Select a template from the queue to review.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
