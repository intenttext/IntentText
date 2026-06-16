import Link from "next/link";
import type { Metadata } from "next";
import ResponsesDashboard from "@/components/ResponsesDashboard";

export const metadata: Metadata = {
  title: "Form Responses — IntentText Hub",
  description: "Collected, trust-verified form submissions.",
};

export default function ResponsesPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Hub
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Form Responses</h1>
      <p className="mb-8 text-[var(--text-muted)]">
        Completed forms submitted to <code>/api/responses</code>. Each is
        trust-verified on arrival — the structure seal (author) and completion seal
        (filler) are checked before it is stored.
      </p>
      <ResponsesDashboard />
    </main>
  );
}
