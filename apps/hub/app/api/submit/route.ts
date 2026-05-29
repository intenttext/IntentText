import { NextRequest, NextResponse } from "next/server";
import { submitTemplate } from "@/lib/templates";
import { validateSubmission } from "@/lib/validate-submission";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, tags, author, source } = body;

    if (!name || !description || !category || !source) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, description, category, source",
        },
        { status: 400 }
      );
    }

    const validation = validateSubmission(source, {
      name,
      category,
      description,
    });
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

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
      category,
      tags: parsedTags,
      author: author || "community",
      source,
      document: validation.document!,
      status: "pending",
      autoApproved: false,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json(
      {
        success: true,
        slug: result.slug,
        warnings: validation.warnings,
        message:
          process.env.REQUIRE_APPROVAL === "true"
            ? "Template submitted for review."
            : "Template published successfully.",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
