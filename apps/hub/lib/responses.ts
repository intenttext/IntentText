import connectToDatabase from "./mongodb";

/** A collected form submission (the Hub side of @dotit/core's submitForm). */
export interface FormResponse {
  /** Deterministic id derived from the content hash. */
  id: string;
  /** Caller-supplied form/template id, or null. */
  formId: string | null;
  /** Structured answers (field key → value). */
  answers: Record<string, string>;
  /** Content hash of the submitted document. */
  hash: string;
  /** ISO instant the recipient submitted. */
  submittedAt: string;
  /** Verified trust verdict at receive time. */
  trust: {
    structureSealed: boolean;
    structureBy: string | null;
    completionSealed: boolean;
    intact: boolean;
  };
  /** The full `.it` source — the record of truth. */
  source: string;
  createdAt: Date;
}

const COLLECTION = "form_responses";

/** Persist a verified response. Idempotent on `id` (re-submits update in place). */
export async function storeResponse(
  record: Omit<FormResponse, "createdAt">,
): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection<FormResponse>(COLLECTION);
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ formId: 1, createdAt: -1 });
  await collection.updateOne(
    { id: record.id },
    { $set: { ...record, createdAt: new Date() } },
    { upsert: true },
  );
}

/** List collected responses (newest first), optionally filtered by form. */
export async function getResponses(options: {
  formId?: string;
  limit?: number;
  skip?: number;
} = {}): Promise<FormResponse[]> {
  const { db } = await connectToDatabase();
  const collection = db.collection<FormResponse>(COLLECTION);
  const filter: Record<string, unknown> = {};
  if (options.formId) filter.formId = options.formId;
  return collection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 100)
    .skip(options.skip ?? 0)
    .toArray();
}

export async function getResponseCount(formId?: string): Promise<number> {
  const { db } = await connectToDatabase();
  const collection = db.collection<FormResponse>(COLLECTION);
  return collection.countDocuments(formId ? { formId } : {});
}
