import { NextResponse } from "next/server";
import { getMpToken, sweepExpiredOrders } from "@/lib/mercadopago";

// GET /api/checkout
// Medios de cobro online disponibles en la tienda (sin datos sensibles).
// De paso libera el stock de órdenes de Mercado Pago vencidas (como mucho cada 5 minutos).
export async function GET() {
  const mercadoPago = Boolean(await getMpToken().catch(() => null));
  if (mercadoPago) sweepExpiredOrders().catch((err) => console.error("[MercadoPago] Error liberando órdenes vencidas:", err));
  return NextResponse.json({ mercadoPago }, { headers: { "Cache-Control": "no-store" } });
}
