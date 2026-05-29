import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { upsertUserFromGithub } from "@/lib/users";
import { setSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const storedState = cookies().get("oauth_state")?.value;
  const returnTo = cookies().get("oauth_return_to")?.value ?? "/";

  // Clear OAuth cookies
  cookies().set("oauth_state", "", { path: "/", maxAge: 0 });
  cookies().set("oauth_return_to", "", { path: "/", maxAge: 0 });

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", request.nextUrl.origin),
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=not_configured", request.nextUrl.origin),
    );
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(
      new URL("/login?error=token_failed", request.nextUrl.origin),
    );
  }

  // Fetch GitHub user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(
      new URL("/login?error=profile_failed", request.nextUrl.origin),
    );
  }

  const ghUser = await userRes.json();

  // Upsert user in our database
  const user = await upsertUserFromGithub({
    github_id: ghUser.id,
    username: ghUser.login,
    name: ghUser.name ?? ghUser.login,
    avatar_url: ghUser.avatar_url,
  });

  // Set session cookie
  setSession({
    user_id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    role: user.role,
  });

  return NextResponse.redirect(new URL(returnTo, request.nextUrl.origin));
}
