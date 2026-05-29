import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  clearSession();
  return NextResponse.json({ success: true });
}

export async function GET() {
  clearSession();
  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  );
}
