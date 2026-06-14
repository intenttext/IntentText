/**
 * audit.ts — append-only audit trail for privileged/security-relevant actions.
 * Logging must never break the request it describes, so failures are swallowed.
 */
import { getCollections } from "./db.js";

export async function writeAudit(entry: {
  action: string;
  actor: string;
  subject: string;
  meta?: Record<string, unknown>;
  ip: string;
}): Promise<void> {
  try {
    const { audit } = getCollections();
    await audit.insertOne({
      action: entry.action,
      actor: entry.actor,
      subject: entry.subject,
      meta: entry.meta ?? {},
      ip: entry.ip,
      at: new Date(),
    });
  } catch {
    // Audit storage unavailable — do not fail the underlying operation.
  }
}
