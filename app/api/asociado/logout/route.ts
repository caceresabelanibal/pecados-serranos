import { NextResponse } from "next/server";
import { RESELLER_COOKIE, resellerCookieOptions } from "@/lib/reseller-auth";

// POST /api/asociado/logout
export async function POST(request: Request) {
  const res = NextResponse.json({ success: true });
  res.cookies.set(RESELLER_COOKIE, "", { ...resellerCookieOptions(request), maxAge: 0 });
  return res;
}
