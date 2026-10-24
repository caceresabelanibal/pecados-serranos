import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/auth";
import { handleNotification } from "@/lib/mercadopago";

// POST /api/mercadopago/webhook
// Aviso de Mercado Pago cuando cambia un pago. Sólo dispara una consulta a la API de Mercado Pago
// con el token de la tienda: el contenido del aviso no se usa como dato confiable.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`mp-webhook:${ip}`, 300, 60 * 1000).ok) return new NextResponse(null, { status: 429 });

  const url = new URL(request.url);
  let body: any = null;
  try {
    body = await request.json();
  } catch {}
  const topic = String(body?.type || body?.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "");
  const id = String(body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
  // merchant_order (formato viejo) trae la URL completa en "resource"
  const resourceId = String(body?.resource || "").match(/(\d+)$/)?.[1] || "";

  try {
    await handleNotification(topic, id || resourceId);
  } catch (err: any) {
    console.error("[MercadoPago] Error procesando aviso:", topic, id, err?.message);
    // 500: Mercado Pago reintenta el aviso más tarde
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}

export const GET = POST;
