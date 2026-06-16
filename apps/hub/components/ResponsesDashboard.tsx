"use client";

import { useEffect, useState } from "react";

interface ResponseRow {
  id: string;
  formId: string | null;
  answers: Record<string, string>;
  hash: string;
  submittedAt: string;
  trust: {
    structureSealed: boolean;
    structureBy: string | null;
    completionSealed: boolean;
    intact: boolean;
  };
}

export default function ResponsesDashboard() {
  const [rows, setRows] = useState<ResponseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/responses")
      .then(async (r) => {
        if (r.status === 401) throw new Error("Sign in to view collected responses.");
        if (!r.ok) throw new Error("Could not load responses.");
        return r.json();
      })
      .then((d) => setRows(d.responses ?? []))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-[var(--text-muted)]">{error}</p>;
  if (!rows) return <p className="text-[var(--text-muted)]">Loading…</p>;
  if (rows.length === 0)
    return (
      <p className="text-[var(--text-muted)]">
        No responses yet. Recipients submit completed forms via{" "}
        <code>submitForm(source, {`{ endpoint: "/api/responses" }`})</code>.
      </p>
    );

  const keys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r.answers))),
  ).slice(0, 6);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            <th className="py-2 pr-4 font-semibold">Submitted</th>
            <th className="py-2 pr-4 font-semibold">Form</th>
            {keys.map((k) => (
              <th key={k} className="py-2 pr-4 font-semibold">{k}</th>
            ))}
            <th className="py-2 pr-4 font-semibold">Trust</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border)] align-top">
              <td className="py-2 pr-4 whitespace-nowrap text-[var(--text-muted)]">
                {new Date(r.submittedAt).toLocaleString()}
              </td>
              <td className="py-2 pr-4">{r.formId ?? "—"}</td>
              {keys.map((k) => (
                <td key={k} className="py-2 pr-4">{r.answers[k] ?? ""}</td>
              ))}
              <td className="py-2 pr-4 whitespace-nowrap">
                {r.trust.intact ? (
                  <span className="text-[var(--green,#16a34a)]" title={
                    [
                      r.trust.structureSealed ? `structure by ${r.trust.structureBy ?? "?"}` : "",
                      r.trust.completionSealed ? "answers signed" : "",
                    ].filter(Boolean).join(" · ") || "no seal"
                  }>
                    ✓ {r.trust.completionSealed ? "signed" : r.trust.structureSealed ? "authentic" : "received"}
                  </span>
                ) : (
                  <span className="text-[var(--red,#dc2626)]">✗ tampered</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
