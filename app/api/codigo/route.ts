import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/auth";
import { findResellerByCode, normalizeResellerCode } from "@/lib/reseller-auth";

// GET /api/codigo?c=XXXX
// Valida un código de revendedora en el carrito. Sólo responde si es válido (no revela de quién es).
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`codigo:${ip}`, ip === "direct" ? 200 : 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false, error: "Demasiados intentos. Probá más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const code = normalizeResellerCode(new URL(request.url).searchParams.get("c"));
  const reseller = code ? await findResellerByCode(code) : null;
  return NextResponse.json({ valid: Boolean(reseller), code }, { headers: { "Cache-Control": "no-store" } });
}
