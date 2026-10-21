import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  getClientIp,
  isAuthConfigured,
  isSameOriginJson,
  rateLimit,
  resetRateLimit,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth";

// POST /api/auth/login
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!isAuthConfigured()) {
    console.error("[Auth] Falta configurar ADMIN_PASSWORD_HASH y/o SESSION_SECRET.");
    return NextResponse.json({ error: "Acceso administrador no disponible." }, { status: 503 });
  }

  const ip = getClientIp(request);
  const key = `login:${ip}`;
  // 5 intentos cada 15 minutos por IP (20 si no hay proxy que informe la IP real)
  const limit = ip === "direct" ? 20 : 5;
  const rl = rateLimit(key, limit, 15 * 60 * 1000);
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

  if (!verifyCredentials(body?.user, body?.password)) {
    console.warn(`[Auth] Login fallido desde ${ip}`);
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  resetRateLimit(key);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions(request));
  return res;
}
