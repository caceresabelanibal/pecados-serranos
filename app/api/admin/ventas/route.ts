import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { cancelSale, confirmPendingSale } from "@/lib/sales";
import { syncSale } from "@/lib/mercadopago";

async function readAdminBody(request: Request): Promise<any | NextResponse> {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  try {
    return (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
}

// PUT /api/admin/ventas  { ids: string[], settled: boolean }
// Sólo admin: marca ventas de revendedora como rendidas (pagadas a la tienda) o las vuelve a "sin rendir".
export async function PUT(request: Request) {
  const body = await readAdminBody(request);
  if (body instanceof NextResponse) return body;
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 500) : [];
  if (ids.length === 0 || typeof body.settled !== "boolean") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const res = await prisma.pecadoSale.updateMany({
    where: { id: { in: ids }, channel: "reseller", status: { not: "cancelled" } },
    data: { settledAt: body.settled ? new Date() : null },
  });
  return NextResponse.json({ success: true, updated: res.count });
}

// POST /api/admin/ventas  { id, action: "confirmar" | "revisar" }
// Sólo admin, compras online pendientes:
//  - confirmar: compra en efectivo en mano: el dinero llegó. Recién ahí se descuenta el stock.
//  - revisar: compra con Mercado Pago: consulta el estado real del pago en Mercado Pago.
export async function POST(request: Request) {
  const body = await readAdminBody(request);
  if (body instanceof NextResponse) return body;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const sale = await prisma.pecadoSale.findUnique({ where: { id }, select: { status: true, paymentMethod: true } });
  if (!sale || sale.status !== "pending") {
    return NextResponse.json({ error: "La compra ya no está pendiente." }, { status: 409 });
  }

  if (body.action === "revisar") {
    try {
      const status = await syncSale(id);
      return NextResponse.json({ success: true, status });
    } catch {
      return NextResponse.json({ error: "No se pudo consultar Mercado Pago. Probá en unos minutos." }, { status: 502 });
    }
  }
  if (body.action !== "confirmar") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  // Una compra con Mercado Pago se confirma sola cuando se acredita el pago (no a mano)
  if (sale.paymentMethod === "mercadopago") {
    return NextResponse.json({ error: "Las compras con Mercado Pago se confirman solas cuando se acredita el pago." }, { status: 409 });
  }
  try {
    const done = await prisma.$transaction((tx) => confirmPendingSale(tx, id, {}, true));
    if (!done) return NextResponse.json({ error: "La compra ya no está pendiente." }, { status: 409 });
    return NextResponse.json({ success: true, status: "completed" });
  } catch (err: any) {
    if (err?.message === "NO_STOCK") {
      return NextResponse.json({ error: `No hay stock suficiente de "${err.title}". Revisá el stock antes de confirmar.` }, { status: 409 });
    }
    console.error("[Admin] Error confirmando compra:", err);
    return NextResponse.json({ error: "No se pudo confirmar la compra." }, { status: 500 });
  }
}

// DELETE /api/admin/ventas  { id }
// Sólo admin: anula una venta y devuelve el stock (al depósito o al lote de la revendedora).
export async function DELETE(request: Request) {
  const body = await readAdminBody(request);
  if (body instanceof NextResponse) return body;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const done = await prisma.$transaction((tx) => cancelSale(tx, id));
  if (!done) return NextResponse.json({ error: "La venta no existe o ya estaba anulada." }, { status: 404 });
  return NextResponse.json({ success: true });
}
