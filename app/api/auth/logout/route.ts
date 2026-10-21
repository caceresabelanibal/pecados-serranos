import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

// POST /api/auth/logout
export async function POST(request: Request) {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(request), maxAge: 0 });
  return res;
}
