import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { submitTemplate } from "@/lib/templates";
import { validateSubmission } from "@/lib/validate-submission";
import { findUserById } from "@/lib/users";

export async function POST(request: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await findUserById(session.user_id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      domain,
      tags,
      source,
      example_data,
      recommended_theme,
    } = body;

    if (!name || !description || !source) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, source" },
        { status: 400 },
      );
    }

    const validation = validateSubmission(source, {
      name,
      category: category ?? domain ?? "other",
      description,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 },
      );
    }

    const slug = `${user.username}/${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

    const parsedTags = Array.isArray(tags)
      ? tags
      : (tags ?? "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

    const result = await submitTemplate({
      slug,
      name,
      description,
      category: category ?? "document",
      domain: domain ?? "other",
      tags: parsedTags,
      author: user.username,
      owner_id: user.id,
      source,
      example_data: example_data ?? undefined,
      recommended_theme: recommended_theme ?? undefined,
      document: validation.document!,
      status: "community",
      tier: "community",
      autoApproved: false,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json(
      { success: true, slug: result.slug, tier: "community" },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
