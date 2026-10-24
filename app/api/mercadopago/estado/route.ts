import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, isSameOriginJson, rateLimit } from "@/lib/auth";
import { syncSale } from "@/lib/mercadopago";

// POST /api/mercadopago/estado  { venta, abandoned? }
// Al volver de Mercado Pago la tienda consulta el estado real de la compra.
// abandoned = volvió sin pagar: si no hay ningún pago en curso, la orden se anula y el stock se libera.
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const ip = getClientIp(request);
  if (!rateLimit(`mp-estado:${ip}`, 30, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Demasiadas consultas. Probá en un rato." }, { status: 429 });
  }
  let body: any = null;
  try {
    body = await request.json();
  } catch {}
  const id = typeof body?.venta === "string" ? body.venta.slice(0, 64) : "";
  if (!id) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    const status = await syncSale(id, { abandoned: body?.abandoned === true });
    if (status === "none") return NextResponse.json({ error: "No encontramos la compra." }, { status: 404 });
    const sale = await prisma.pecadoSale.findUnique({ where: { id }, include: { items: true } });
    return NextResponse.json(
      {
        status,
        saleId: id,
        totalAmount: sale?.totalAmount ?? 0,
        items: (sale?.items || []).map((i) => ({ title: i.productTitle, quantity: i.quantity, subtotal: i.subtotal })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[MercadoPago] Error consultando estado:", id, err?.message);
    return NextResponse.json({ error: "No pudimos consultar el pago. Probá en unos minutos." }, { status: 502 });
  }
}
