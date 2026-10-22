import crypto from "crypto";

// -------------------------------------------------------------
// Autenticación de administrador (100% del lado del servidor)
// - La contraseña NUNCA viaja al navegador ni está en el código:
//   se configura como hash scrypt en ADMIN_PASSWORD_HASH.
// - La sesión es una cookie HttpOnly firmada con HMAC.
// -------------------------------------------------------------

export const SESSION_COOKIE = "ps_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

function getAdminUser(): string {
  return process.env.ADMIN_USER || "admin";
}

// Formato: scrypt:<saltHex>:<hashHex>
function getAdminPasswordHash(): string | null {
  const h = process.env.ADMIN_PASSWORD_HASH;
  if (!h || !h.startsWith("scrypt:")) return null;
  return h;
}

// La clave de firma incluye el hash de la contraseña: si se cambia la contraseña,
// todas las sesiones existentes quedan invalidadas automáticamente.
function getSigningKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  const pwHash = getAdminPasswordHash();
  if (!secret || secret.length < 32 || !pwHash) return null;
  return crypto.createHash("sha256").update(`${secret}|${pwHash}`).digest();
}

export function isAuthConfigured(): boolean {
  return getSigningKey() !== null;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyCredentials(user: unknown, password: unknown): boolean {
  const stored = getAdminPasswordHash();
  if (!stored || typeof user !== "string" || typeof password !== "string") return false;
  if (password.length > 256 || user.length > 64) return false;

  const [, saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);

  // Siempre se calcula el scrypt (aunque el usuario no coincida) para no filtrar timing
  const userOk = safeEqual(
    crypto.createHash("sha256").update(user.trim()).digest(),
    crypto.createHash("sha256").update(getAdminUser()).digest()
  );
  return safeEqual(actual, expected) && userOk;
}

export function createSessionToken(): string {
  const key = getSigningKey();
  if (!key) throw new Error("Autenticación no configurada");
  const payload = Buffer.from(
    JSON.stringify({ u: getAdminUser(), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string | undefined): boolean {
  const key = getSigningKey();
  if (!key || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac("sha256", key).update(payload).digest();
  if (!safeEqual(Buffer.from(sig, "base64url"), expectedSig)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
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

export function isAdminRequest(request: Request): boolean {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

function isHttps(request: Request): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.TRUST_PROXY === "true" && request.headers.get("x-forwarded-proto") === "https";
}

export function sessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

// Protección CSRF para peticiones que modifican datos: sólo JSON y mismo origen.
export function isSameOriginJson(request: Request): boolean {
  const ct = request.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("application/json")) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // navegadores siempre envían Origin en POST cross-site
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// Rate limiting en memoria (suficiente para una sola instancia)
// -------------------------------------------------------------
export function getClientIp(request: Request): string {
  // Sólo confiar en X-Forwarded-For cuando hay un reverse proxy propio delante
  if (process.env.TRUST_PROXY === "true") {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "direct";
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

// -------------------------------------------------------------
// Hash de contraseñas (mismo formato que ADMIN_PASSWORD_HASH): scrypt:<saltHex>:<hashHex>
// -------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPasswordHash(password: unknown, stored: string | null | undefined): boolean {
  if (typeof password !== "string" || password.length > 256 || !stored || !stored.startsWith("scrypt:")) return false;
  const [, saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return safeEqual(actual, expected);
}

// Hash "dummy" para igualar tiempos cuando el usuario no existe
export const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));
