import { NextRequest, NextResponse } from "next/server";
import { getTemplates } from "@/lib/templates";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "all";
  const domain = searchParams.get("domain") ?? undefined;
  const tier = searchParams.get("tier") ?? undefined;
  const search = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const skip = parseInt(searchParams.get("skip") ?? "0");

  try {
    const templates = await getTemplates({
      category,
      domain,
      tier,
      search,
      limit,
      skip,
    });
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 },
    );
  }
}
