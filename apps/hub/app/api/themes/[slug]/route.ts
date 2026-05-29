import { NextRequest, NextResponse } from "next/server";
import { getThemeBySlug, incrementThemeInstalls } from "@/lib/themes";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const theme = await getThemeBySlug(params.slug);
    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }
    return NextResponse.json({ theme });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch theme" },
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
    if (body.action === "install") {
      await incrementThemeInstalls(params.slug);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
