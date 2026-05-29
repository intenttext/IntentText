"use client";

import { useState, useCallback, useEffect } from "react";
import ItSourceViewer from "@/components/ItSourceViewer";
import Link from "next/link";

const domains = [
  { key: "business", label: "Business" },
  { key: "editorial", label: "Editorial" },
  { key: "book", label: "Book" },
  { key: "personal", label: "Personal" },
  { key: "agent", label: "Agent" },
  { key: "organization", label: "Organization" },
  { key: "developer", label: "Developer" },
  { key: "other", label: "Other" },
];

export default function PublishPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("business");
  const [tagsInput, setTagsInput] = useState("");
  const [source, setSource] = useState("");
  const [exampleData, setExampleData] = useState("");
  const [recommendedTheme, setRecommendedTheme] = useState("corporate");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ slug: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setAuthenticated(!!d.user))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors([]);
      setSuccess(null);

      const clientErrors: string[] = [];
      if (!name.trim()) clientErrors.push("Name is required.");
      if (!description.trim()) clientErrors.push("Description is required.");
      if (!source.trim()) clientErrors.push("Source is required.");
      if (clientErrors.length > 0) {
        setErrors(clientErrors);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            domain,
            category: domain === "agent" ? "agent" : "document",
            tags: tagsInput,
            source,
            example_data: exampleData || undefined,
            recommended_theme: recommendedTheme || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrors(data.errors ?? [data.error ?? "Publish failed."]);
        } else {
          setSuccess({ slug: data.slug });
        }
      } catch {
        setErrors(["Network error. Please try again."]);
      } finally {
        setSubmitting(false);
      }
    },
    [
      name,
      description,
      domain,
      tagsInput,
      source,
      exampleData,
      recommendedTheme,
    ],
  );

  if (authenticated === null) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12 text-center text-[var(--text-muted)]">
        Loading…
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold">Sign in to publish</h1>
        <p className="mb-6 text-[var(--text-muted)]">
          You need a GitHub account to publish templates and themes.
        </p>
        <a
          href="/api/auth/login?returnTo=/publish"
          className="inline-flex items-center gap-2 rounded-lg bg-[#24292f] px-6 py-3 text-sm font-medium text-white hover:bg-[#32383f]"
        >
          Sign in with GitHub
        </a>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12 text-center">
        <div className="mb-4 text-4xl">✓</div>
        <h2 className="mb-2 text-xl font-bold text-[var(--green)]">
          Template published!
        </h2>
        <p className="mb-4 text-[var(--text-muted)]">
          Your template is live in the community tier.
        </p>
        <a
          href={`/templates/${success.slug}`}
          className="text-[var(--purple)] hover:underline"
        >
          View your template →
        </a>
      </main>
    );
  }

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Hub
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Publish a Template</h1>
      <p className="mb-8 text-[var(--text-muted)]">
        Your template will be published immediately in the community tier.
        Submit for curation review to appear in the main catalog.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.length > 0 && (
          <div className="rounded-lg border border-[var(--red)] bg-[rgba(243,139,168,0.1)] p-4">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-[var(--red)]">
                {err}
              </p>
            ))}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
            placeholder="Invoice Standard"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 120))}
            maxLength={120}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
            placeholder="Standard invoice with line items and tax"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {description.length}/120
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Domain</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
          >
            {domains.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Recommended Theme
          </label>
          <select
            value={recommendedTheme}
            onChange={(e) => setRecommendedTheme(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
          >
            <option value="corporate">Corporate</option>
            <option value="minimal">Minimal</option>
            <option value="warm">Warm</option>
            <option value="technical">Technical</option>
            <option value="print">Print</option>
            <option value="legal">Legal</option>
            <option value="editorial">Editorial</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
            placeholder="invoice, finance, billing"
          />
          {parsedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            IntentText Source
          </label>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
            placeholder="title: My Template&#10;meta: | type: template | domain: business | description: ...&#10;---&#10;section: First Section&#10;..."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Example Data (JSON){" "}
            <span className="text-[var(--text-muted)]">— optional</span>
          </label>
          <textarea
            value={exampleData}
            onChange={(e) => setExampleData(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
            placeholder='{ "company": "Acme Corp", "items": [...] }'
          />
        </div>

        {source.trim() && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
              Source Preview
            </h3>
            <ItSourceViewer source={source} />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[var(--purple)] px-4 py-3 text-sm font-medium text-[var(--surface-2)] hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Publishing…" : "Publish to Community"}
        </button>
      </form>
    </main>
  );
}
