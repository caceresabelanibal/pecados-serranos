import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DUMMY_PASSWORD_HASH, getClientIp, isSameOriginJson, rateLimit, resetRateLimit, verifyPasswordHash } from "@/lib/auth";
import { RESELLER_COOKIE, createResellerSessionToken, resellerCookieOptions } from "@/lib/reseller-auth";

// POST /api/asociado/login  { user, password }
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const key = `asociado-login:${ip}`;
  const rl = rateLimit(key, ip === "direct" ? 20 : 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const username = typeof body?.user === "string" ? body.user.trim().toLowerCase().slice(0, 30) : "";

  const reseller = username
    ? await prisma.pecadoReseller.findUnique({
        where: { username },
        select: { id: true, active: true, passwordHash: true },
      })
    : null;

  // Siempre se verifica un hash (aunque el usuario no exista) para no revelar usuarios por tiempo de respuesta
  const ok = verifyPasswordHash(body?.password, reseller?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!reseller || !reseller.active || !reseller.passwordHash || !ok) {
    console.warn(`[Asociado] Login fallido desde ${ip}`);
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  resetRateLimit(key);
  const res = NextResponse.json({ success: true });
  res.cookies.set(RESELLER_COOKIE, createResellerSessionToken(reseller.id, reseller.passwordHash), resellerCookieOptions(request));
  return res;
}
