"use client";

import { useState } from "react";
import type { HubTemplate } from "@/types/hub";
import ItSourceViewer from "./ItSourceViewer";
import Link from "next/link";

const categoryColors: Record<string, { bg: string; text: string }> = {
  agent: { bg: "rgba(203,166,247,0.15)", text: "var(--purple)" },
  workflow: { bg: "rgba(137,180,250,0.15)", text: "var(--blue)" },
  document: { bg: "rgba(166,227,161,0.15)", text: "var(--green)" },
  business: { bg: "rgba(137,180,250,0.15)", text: "var(--blue)" },
  editorial: { bg: "rgba(249,226,175,0.15)", text: "var(--yellow)" },
  book: { bg: "rgba(250,179,135,0.15)", text: "var(--orange)" },
  personal: { bg: "rgba(166,227,161,0.15)", text: "var(--green)" },
  organization: { bg: "rgba(137,180,250,0.15)", text: "var(--blue)" },
  developer: { bg: "rgba(203,166,247,0.15)", text: "var(--purple)" },
  other: { bg: "rgba(147,153,178,0.15)", text: "var(--text-muted)" },
};

export default function TemplateDetail({
  template,
}: {
  template: HubTemplate;
}) {
  const [copied, setCopied] = useState(false);
  const colors = categoryColors[template.category] ?? categoryColors.document;

  async function handleCopy() {
    await navigator.clipboard.writeText(template.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    // Increment download count
    fetch(`/api/templates/${template.slug}`, { method: "POST" });

    const blob = new Blob([template.source], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.slug}.it`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Hub
      </Link>
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left: Source viewer */}
        <div className="lg:w-[60%]">
          <ItSourceViewer source={template.source} />
        </div>

        {/* Right: Metadata */}
        <div className="lg:w-[40%]">
          <span
            className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase"
            style={{ background: colors.bg, color: colors.text }}
          >
            {template.category}
          </span>
          <h1 className="mb-2 text-2xl font-bold">{template.name}</h1>
          <p className="mb-4 text-[var(--text-muted)]">
            {template.description}
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mb-6 space-y-1 text-sm text-[var(--text-muted)]">
            <p>
              Author:{" "}
              <span className="text-[var(--text)]">{template.author}</span>
            </p>
            <p>
              Downloads:{" "}
              <span className="text-[var(--text)]">{template.downloads}</span>
            </p>
            <p>
              Views:{" "}
              <span className="text-[var(--text)]">{template.views}</span>
            </p>
            <p>
              Added:{" "}
              <span className="text-[var(--text)]">
                {new Date(template.createdAt).toLocaleDateString()}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleCopy}
              className="rounded-lg bg-[var(--purple)] px-4 py-2.5 text-sm font-medium text-[var(--surface-2)] hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy source"}
            </button>
            <button
              onClick={handleDownload}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:border-[var(--purple)]"
            >
              Download .it
            </button>
            <a
              href={`https://iteditor.vercel.app?source=${encodeURIComponent(template.source)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-center text-sm font-medium text-[var(--text)] hover:border-[var(--purple)]"
            >
              Open in Editor
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
