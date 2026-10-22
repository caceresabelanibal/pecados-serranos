import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sessionCookieOptions } from "@/lib/auth";

// -------------------------------------------------------------
// Sesión del perfil "Asociado" (revendedor). Independiente de la del administrador.
// El token incluye una huella del hash de la contraseña: si el admin la cambia
// o da de baja al revendedor, la sesión deja de ser válida.
// -------------------------------------------------------------

export const RESELLER_COOKIE = "ps_asociado_session";
const TTL_SECONDS = 12 * 60 * 60;

export const RESELLER_CODE_PATTERN = /^[A-Z0-9_-]{2,20}$/;
export const RESELLER_USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeResellerCode(code: unknown): string {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

function signingKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.createHash("sha256").update(`${secret}|asociado`).digest();
}

function passwordFingerprint(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("base64url").slice(0, 22);
}

export function createResellerSessionToken(resellerId: string, passwordHash: string): string {
  const key = signingKey();
  if (!key) throw new Error("SESSION_SECRET no configurado");
  const payload = Buffer.from(
    JSON.stringify({ r: resellerId, pv: passwordFingerprint(passwordHash), exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function resellerCookieOptions(request: Request) {
  return { ...sessionCookieOptions(request), maxAge: TTL_SECONDS };
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export interface SessionReseller {
  id: string;
  name: string;
  zone: string;
  code: string | null;
}

// Revendedor de la sesión actual (o null). Verifica firma, vencimiento, que siga activo y la contraseña vigente.
export async function getSessionReseller(request: Request): Promise<SessionReseller | null> {
  const key = signingKey();
  const token = readCookie(request, RESELLER_COOKIE);
  if (!key || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", key).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let data: { r?: string; pv?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.r || !data.pv || typeof data.exp !== "number" || data.exp <= Math.floor(Date.now() / 1000)) return null;

  const reseller = await prisma.pecadoReseller.findUnique({
    where: { id: data.r },
    select: { id: true, name: true, zone: true, code: true, active: true, passwordHash: true },
  });
  if (!reseller || !reseller.active || !reseller.passwordHash) return null;
  if (passwordFingerprint(reseller.passwordHash) !== data.pv) return null;
  return { id: reseller.id, name: reseller.name, zone: reseller.zone, code: reseller.code };
}

// Revendedora activa dueña de un código (o null)
export async function findResellerByCode(code: string) {
  if (!RESELLER_CODE_PATTERN.test(code)) return null;
  return prisma.pecadoReseller.findFirst({
    where: { code, active: true },
    select: { id: true, name: true, code: true },
  });
}
