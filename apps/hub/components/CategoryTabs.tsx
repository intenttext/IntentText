"use client";

import { useRouter, useSearchParams } from "next/navigation";

const categories = [
  { key: "all", label: "All" },
  { key: "agent", label: "Agents" },
  { key: "workflow", label: "Workflows" },
  { key: "document", label: "Documents" },
  { key: "business", label: "Business" },
  { key: "editorial", label: "Editorial" },
  { key: "developer", label: "Developer" },
  { key: "sealed", label: "🔒 Sealed" },
];

export default function CategoryTabs({ active }: { active: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick(category: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "all") {
      params.delete("category");
    } else {
      params.set("category", category);
    }
    params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-2">
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => handleClick(cat.key)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            active === cat.key
              ? "bg-[var(--purple)] text-[var(--surface-2)]"
              : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
