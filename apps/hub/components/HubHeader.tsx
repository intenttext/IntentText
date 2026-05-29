"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

export default function HubHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      if (search) {
        params.set("q", search);
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.push(`/?${params.toString()}`);
    },
    [search, searchParams, router],
  );

  return (
    <header className="bg-gradient-to-b from-[var(--surface-2)] to-[var(--bg)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--purple)]">
              IntentText Hub
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              The registry for .it templates — browse agent definitions,
              workflow patterns, and document templates.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 sm:w-1/3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--purple)]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:border-[var(--purple)]"
            >
              Search
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
