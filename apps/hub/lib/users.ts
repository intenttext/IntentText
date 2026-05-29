import connectToDatabase from "./mongodb";
import type { HubUser } from "../types/hub";
import { randomUUID } from "crypto";

export async function findUserByGithubId(
  githubId: number,
): Promise<HubUser | null> {
  const { db } = await connectToDatabase();
  return db.collection<HubUser>("users").findOne({ github_id: githubId });
}

export async function findUserByUsername(
  username: string,
): Promise<HubUser | null> {
  const { db } = await connectToDatabase();
  return db.collection<HubUser>("users").findOne({ username });
}

export async function findUserById(id: string): Promise<HubUser | null> {
  const { db } = await connectToDatabase();
  return db.collection<HubUser>("users").findOne({ id });
}

export async function upsertUserFromGithub(profile: {
  github_id: number;
  username: string;
  name: string;
  avatar_url: string;
}): Promise<HubUser> {
  const { db } = await connectToDatabase();
  const collection = db.collection<HubUser>("users");

  const existing = await collection.findOne({ github_id: profile.github_id });
  if (existing) {
    // Update profile fields that may have changed on GitHub
    await collection.updateOne(
      { github_id: profile.github_id },
      {
        $set: {
          username: profile.username,
          name: profile.name,
          avatar_url: profile.avatar_url,
        },
      },
    );
    return { ...existing, ...profile };
  }

  const user: HubUser = {
    id: randomUUID(),
    github_id: profile.github_id,
    username: profile.username,
    name: profile.name,
    avatar_url: profile.avatar_url,
    role: "user",
    joined_at: new Date(),
    published_templates: 0,
    published_themes: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await collection.insertOne(user as any);
  return user;
}

export async function getUserTemplates(userId: string) {
  const { db } = await connectToDatabase();
  return db
    .collection("templates")
    .find({ owner_id: userId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getUserThemes(userId: string) {
  const { db } = await connectToDatabase();
  return db
    .collection("themes")
    .find({ owner_id: userId })
    .sort({ created_at: -1 })
    .toArray();
}
