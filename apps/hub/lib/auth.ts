import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import type { SessionData } from "../types/hub";

const SESSION_COOKIE = "hub_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var not set");
  return secret;
}

function sign(payload: string): string {
  const mac = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${mac}`;
}

function verify(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  try {
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  return payload;
}

export function setSession(session: SessionData): void {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const token = sign(payload);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function getSession(): SessionData | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
