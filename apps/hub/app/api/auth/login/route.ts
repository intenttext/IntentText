import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");
  cookies().set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/";
  cookies().set("oauth_return_to", returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
}
