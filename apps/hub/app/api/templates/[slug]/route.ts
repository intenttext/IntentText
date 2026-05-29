import { NextRequest, NextResponse } from "next/server";
import { getTemplateBySlug, incrementDownloads } from "@/lib/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const template = await getTemplateBySlug(params.slug);
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    if (body.action === "download") {
      await incrementDownloads(params.slug);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
