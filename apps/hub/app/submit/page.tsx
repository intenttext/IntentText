import SubmitForm from "@/components/SubmitForm";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit a Template — IntentText Hub",
  description: "Submit your IntentText template to the Hub.",
};

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--purple)] hover:underline"
      >
        ← Back to Hub
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Submit a Template</h1>
      <p className="mb-8 text-[var(--text-muted)]">
        Share your IntentText template with the community. Templates are
        validated automatically.
      </p>
      <SubmitForm />
    </main>
  );
}
