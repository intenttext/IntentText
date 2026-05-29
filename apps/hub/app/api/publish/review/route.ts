import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { submitForReview } from "@/lib/templates";

export async function POST(request: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { slug } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const success = await submitForReview(slug, session.user_id);
    if (!success) {
      return NextResponse.json(
        {
          error:
            "Cannot submit for review. Template not found or not eligible.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, slug });
  } catch {
    return NextResponse.json(
      { error: "Submit for review failed" },
      { status: 500 },
    );
  }
}
