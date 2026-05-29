import { NextRequest, NextResponse } from "next/server";
import {
  getReviewQueue,
  approveTemplate,
  rejectTemplate,
  requestChanges,
} from "@/lib/templates";
import { getSession } from "@/lib/auth";

function isAuthorized(request: NextRequest): boolean {
  // Check session-based auth (reviewer or admin role)
  const session = getSession();
  if (session && (session.role === "admin" || session.role === "reviewer")) {
    return true;
  }
  // Fallback: bearer token for API/CLI usage
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;
  return token === adminToken;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await getReviewQueue();
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug, action, reason, feedback } = await request.json();

    if (!slug || !action) {
      return NextResponse.json(
        { error: "Missing slug or action" },
        { status: 400 },
      );
    }

    const session = getSession();
    const reviewerName = session?.username ?? "admin";

    if (action === "approve") {
      await approveTemplate(slug, reviewerName);
      return NextResponse.json({ success: true, action: "approved", slug });
    }

    if (action === "request_changes") {
      await requestChanges(
        slug,
        reviewerName,
        feedback ?? "Changes requested.",
      );
      return NextResponse.json({
        success: true,
        action: "changes_requested",
        slug,
      });
    }

    if (action === "reject") {
      await rejectTemplate(
        slug,
        reviewerName,
        reason ?? "Does not meet quality standards.",
      );
      return NextResponse.json({ success: true, action: "rejected", slug });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Admin action failed" }, { status: 500 });
  }
}
