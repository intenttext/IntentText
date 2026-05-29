import connectToDatabase from "./mongodb";
import type { HubTheme } from "../types/hub";

export async function getThemes(options: {
  status?: string;
  tier?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<HubTheme[]> {
  const { db } = await connectToDatabase();
  const collection = db.collection<HubTheme>("themes");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {};

  if (options.status) filter.status = options.status;
  if (options.tier) filter.tier = options.tier;

  if (options.search) {
    filter.$or = [
      { title: { $regex: options.search, $options: "i" } },
      { description: { $regex: options.search, $options: "i" } },
    ];
  }

  return collection
    .find(filter)
    .sort({ created_at: -1 })
    .limit(options.limit ?? 50)
    .skip(options.skip ?? 0)
    .toArray();
}

export async function getThemeBySlug(slug: string): Promise<HubTheme | null> {
  const { db } = await connectToDatabase();
  return db.collection<HubTheme>("themes").findOne({ slug });
}

export async function submitTheme(
  theme: Omit<
    HubTheme,
    "_id" | "installs" | "stars" | "created_at" | "updated_at"
  >,
): Promise<{ success: boolean; slug?: string; error?: string }> {
  const { db } = await connectToDatabase();
  const collection = db.collection<HubTheme>("themes");

  const existing = await collection.findOne({ slug: theme.slug });
  if (existing) {
    return { success: false, error: "A theme with this slug already exists." };
  }

  const doc: HubTheme = {
    ...theme,
    installs: 0,
    stars: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await collection.insertOne(doc as any);
  return { success: true, slug: theme.slug };
}

export async function incrementThemeInstalls(slug: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("themes").updateOne({ slug }, { $inc: { installs: 1 } });
}

export async function getPendingThemes(): Promise<HubTheme[]> {
  const { db } = await connectToDatabase();
  return db
    .collection<HubTheme>("themes")
    .find({ status: "pending_review" })
    .sort({ created_at: 1 })
    .toArray();
}

export async function approveTheme(
  slug: string,
  reviewedBy: string,
): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("themes").updateOne(
    { slug },
    {
      $set: {
        status: "approved",
        tier: "curated",
        reviewed_by: reviewedBy,
        updated_at: new Date(),
      },
    },
  );
}

export async function rejectTheme(
  slug: string,
  reviewedBy: string,
  reason: string,
): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("themes").updateOne(
    { slug },
    {
      $set: {
        status: "rejected",
        reviewed_by: reviewedBy,
        review_feedback: reason,
        updated_at: new Date(),
      },
    },
  );
}
