import { NextRequest, NextResponse } from "next/server";
import { getThemes } from "@/lib/themes";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "approved";
  const tier = searchParams.get("tier") ?? undefined;
  const search = searchParams.get("q") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const skip = parseInt(searchParams.get("skip") ?? "0");

  try {
    const themes = await getThemes({ status, tier, search, limit, skip });
    return NextResponse.json({ themes });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch themes" },
      { status: 500 },
    );
  }
}
