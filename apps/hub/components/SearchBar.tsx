"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

export default function SearchBar() {
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
      router.push(`/?${params.toString()}`);
    },
    [search, searchParams, router]
  );

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--purple)]"
      />
      <button
        type="submit"
        className="rounded-lg bg-[var(--purple)] px-4 py-2 text-sm font-medium text-[var(--surface-2)] hover:opacity-90"
      >
        Search
      </button>
    </form>
  );
}
