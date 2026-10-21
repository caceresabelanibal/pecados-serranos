import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";

// GET /api/auth/me
export async function GET(request: Request) {
  return NextResponse.json(
    { isAdmin: isAdminRequest(request) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
