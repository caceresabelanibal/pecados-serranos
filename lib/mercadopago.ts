import { prisma } from "@/lib/prisma";
import { cancelSale, confirmPendingSale } from "@/lib/sales";

// -------------------------------------------------------------
// Cobro con Mercado Pago (Checkout Pro)
//  - El admin carga el Access Token de producción de SU cuenta: la plata entra a esa cuenta.
//  - La tienda arma la orden (precios del servidor; el stock se descuenta recién cuando el pago
//    se acredita), crea una "preferencia" y el
//    cliente paga en la pantalla de Mercado Pago (dinero en cuenta, tarjetas, Mercado Crédito, efectivo).
//  - Mercado Pago avisa por webhook; el estado se confirma SIEMPRE consultando su API con el
//    token (nunca se confía en los datos que llegan en la URL o en el aviso).
// -------------------------------------------------------------

const API = "https://api.mercadopago.com";
const KEY_TOKEN = "mpAccessToken";
const KEY_ENABLED = "mpEnabled";
const KEY_ACCOUNT = "mpAccount";

// Tiempo para pagar: pasado este plazo la orden sin pago se anula
export const PAYMENT_WINDOW_MIN = 60;
export const TOKEN_PATTERN = /^(APP_USR|TEST)-[A-Za-z0-9-]{20,200}$/;

export interface MpAccount {
  id: number;
  nickname: string;
  email: string;
  siteId: string;
}

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.pecadoSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string | null) {
  if (value === null) {
    await prisma.pecadoSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.pecadoSetting.upsert({
    where: { key },
    create: { key, value, updatedAt: new Date() },
    update: { value, updatedAt: new Date() },
  });
}

export async function getMpToken(): Promise<string | null> {
  const [token, enabled] = await Promise.all([getSetting(KEY_TOKEN), getSetting(KEY_ENABLED)]);
  return token && enabled === "true" ? token : null;
}

// Estado para el panel admin (el token nunca sale completo del servidor)
export async function getMpStatus() {
  const [token, enabled, account] = await Promise.all([getSetting(KEY_TOKEN), getSetting(KEY_ENABLED), getSetting(KEY_ACCOUNT)]);
  let acc: MpAccount | null = null;
  try {
    acc = account ? JSON.parse(account) : null;
  } catch {}
  return {
    configured: Boolean(token),
    enabled: Boolean(token) && enabled === "true",
    testMode: Boolean(token?.startsWith("TEST-")),
    tokenHint: token ? `${token.slice(0, 8)}…${token.slice(-4)}` : "",
    account: acc,
  };
}

export async function saveMpConfig(opts: { token?: string | null; enabled?: boolean; account?: MpAccount | null }) {
  if (opts.token !== undefined) await setSetting(KEY_TOKEN, opts.token);
  if (opts.account !== undefined) await setSetting(KEY_ACCOUNT, opts.account ? JSON.stringify(opts.account) : null);
  if (opts.enabled !== undefined) await setSetting(KEY_ENABLED, opts.enabled ? "true" : "false");
}

async function mp<T = any>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(`MP_${res.status}`), { status: res.status, data });
  }
  return data as T;
}

// Valida un token consultando la cuenta a la que pertenece
export async function fetchMpAccount(token: string): Promise<MpAccount> {
  const me = await mp<any>(token, "/users/me");
  return { id: me.id, nickname: me.nickname || "", email: me.email || "", siteId: me.site_id || "" };
}

export interface PreferenceInput {
  saleId: string;
  baseUrl: string;
  buyerName: string;
  items: { sku: string; title: string; quantity: number; unitPrice: number }[];
}

export async function createPreference(token: string, input: PreferenceInput): Promise<{ id: string; initPoint: string }> {
  const now = new Date();
  const back = (estado: string) => `${input.baseUrl}/?pago=${estado}&venta=${encodeURIComponent(input.saleId)}`;
  const pref = await mp<any>(token, "/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": `pref-${input.saleId}` },
    body: JSON.stringify({
      items: input.items.map((i) => ({
        id: i.sku,
        title: i.title.slice(0, 250),
        quantity: i.quantity,
        unit_price: Math.round(i.unitPrice * 100) / 100,
        currency_id: "ARS",
      })),
      payer: { name: input.buyerName.slice(0, 80) },
      external_reference: input.saleId,
      back_urls: { success: back("aprobado"), pending: back("pendiente"), failure: back("error") },
      auto_return: "approved",
      notification_url: `${input.baseUrl}/api/mercadopago/webhook`,
      statement_descriptor: "PECADOS SERRANOS",
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: new Date(now.getTime() + PAYMENT_WINDOW_MIN * 60 * 1000).toISOString(),
    }),
  });
  // Con credenciales de prueba se usa el checkout de prueba
  return { id: pref.id, initPoint: token.startsWith("TEST-") ? pref.sandbox_init_point || pref.init_point : pref.init_point };
}

type PayStatus = "approved" | "pending" | "rejected" | "none";

// Estado real de los pagos de una orden según Mercado Pago
async function paymentsFor(token: string, saleId: string) {
  const r = await mp<any>(token, `/v1/payments/search?external_reference=${encodeURIComponent(saleId)}&sort=date_created&criteria=desc&limit=20`);
  return (r?.results || []) as { id: number; status: string; transaction_amount: number; external_reference: string }[];
}

// Revisa una orden pendiente y la actualiza: aprobada -> completada; sin pago y "abandoned" -> anulada.
// Devuelve el estado resultante.
export async function syncSale(saleId: string, opts: { abandoned?: boolean } = {}): Promise<PayStatus | "cancelled" | "completed"> {
  const token = await getMpToken();
  const sale = await prisma.pecadoSale.findUnique({ where: { id: saleId } });
  if (!sale || sale.paymentMethod !== "mercadopago") return "none";
  if (sale.status === "completed") return "completed";
  if (sale.status === "cancelled") return "cancelled";
  if (!token) return "pending";

  const payments = await paymentsFor(token, saleId);
  const approved = payments.find((p) => p.status === "approved" && p.external_reference === saleId);
  if (approved) {
    // Se confirma sólo si se pagó el total de la orden
    if (approved.transaction_amount + 0.01 >= sale.totalAmount) {
      // Pago acreditado: recién ahora se descuenta el stock
      await prisma.$transaction((tx) => confirmPendingSale(tx, saleId, { mpPaymentId: String(approved.id) }, false));
      return "completed";
    }
    console.error(`[MercadoPago] Pago ${approved.id} por ${approved.transaction_amount} menor al total ${sale.totalAmount} de ${saleId}`);
    return "pending";
  }
  const live = payments.some((p) => ["pending", "in_process", "authorized", "in_mediation"].includes(p.status));
  if (live) return "pending";

  const expired = Date.now() - sale.date.getTime() > (PAYMENT_WINDOW_MIN + 15) * 60 * 1000;
  if (opts.abandoned || expired) {
    await prisma.$transaction((tx) => cancelSale(tx, saleId));
    return "cancelled";
  }
  return payments.length > 0 ? "rejected" : "pending";
}

// Procesa un aviso de Mercado Pago (pago u orden de compra)
export async function handleNotification(topic: string, id: string) {
  const token = await getMpToken();
  if (!token || !/^[0-9]{1,20}$/.test(id)) return;
  let refs: string[] = [];
  if (topic === "payment") {
    const p = await mp<any>(token, `/v1/payments/${id}`);
    refs = [p?.external_reference];
  } else if (topic === "merchant_order") {
    const o = await mp<any>(token, `/merchant_orders/${id}`);
    refs = [o?.external_reference];
  }
  for (const ref of refs.filter((r) => typeof r === "string" && r.length > 0 && r.length <= 64)) {
    await syncSale(ref);
  }
}

// Anula las órdenes de Mercado Pago que vencieron sin pago
let lastSweep = 0;
export async function sweepExpiredOrders() {
  if (Date.now() - lastSweep < 5 * 60 * 1000) return;
  lastSweep = Date.now();
  const limit = new Date(Date.now() - (PAYMENT_WINDOW_MIN + 15) * 60 * 1000);
  const stale = await prisma.pecadoSale.findMany({
    where: { paymentMethod: "mercadopago", status: "pending", date: { lt: limit } },
    select: { id: true },
    take: 50,
  });
  for (const s of stale) {
    try {
      await syncSale(s.id);
    } catch (err) {
      console.error("[MercadoPago] Error revisando orden vencida", s.id, err);
    }
  }
}

// URL pública del sitio (detrás de Caddy llega el host original y X-Forwarded-Proto)
export function publicBaseUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}
