"use client";

import { useState, useCallback } from "react";
import ItSourceViewer from "./ItSourceViewer";

export default function SubmitForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("agent");
  const [tagsInput, setTagsInput] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ slug: string } | null>(null);

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
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            category,
            tags: tagsInput,
            author,
            source,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrors(data.errors ?? [data.error ?? "Submission failed."]);
        } else {
          setSuccess({ slug: data.slug });
        }
      } catch {
        setErrors(["Network error. Please try again."]);
      } finally {
        setSubmitting(false);
      }
    },
    [name, description, category, tagsInput, author, source]
  );

  if (success) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="mb-4 text-4xl">✓</div>
        <h2 className="mb-2 text-xl font-bold text-[var(--green)]">
          Template submitted!
        </h2>
        <p className="mb-4 text-[var(--text-muted)]">
          Your template has been published.
        </p>
        <a
          href={`/templates/${success.slug}`}
          className="text-[var(--purple)] hover:underline"
        >
          View your template →
        </a>
      </div>
    );
  }

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
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
          placeholder="Customer Support Agent"
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
          placeholder="Multilingual support agent with CRM integration"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {description.length}/120
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
        >
          <option value="agent">Agent</option>
          <option value="workflow">Workflow</option>
          <option value="document">Document</option>
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
          placeholder="crm, whatsapp, arabic"
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
          Author / GitHub username{" "}
          <span className="text-[var(--text-muted)]">(optional)</span>
        </label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--purple)]"
          placeholder="your-github-username"
        />
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
          placeholder="title: My Template&#10;---&#10;step: First step&#10;  Do something important"
        />
      </div>

      {/* Live preview */}
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
        {submitting ? "Submitting…" : "Submit Template"}
      </button>
    </form>
  );
}
