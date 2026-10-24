import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { cancelSale } from "@/lib/sales";

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
