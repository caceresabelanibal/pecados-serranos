import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { applyPendingCommission } from "@/lib/commission";

// PUT /api/admin/comisiones  { resellerId, productId, commissionUnit }
// Sólo admin: define la comisión por unidad de un artículo para una revendedora en las ventas
// donde quedó "a definir" (ej: vendido con su código sin habérsele entregado). Las próximas
// ventas de ese artículo con su código usan este mismo valor si no tiene un lote entregado.
export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const resellerId = typeof body?.resellerId === "string" ? body.resellerId : "";
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const unit = Number(body?.commissionUnit);
  if (!resellerId || !productId || body?.commissionUnit === "" || body?.commissionUnit === null || !Number.isFinite(unit) || unit < 0) {
    return NextResponse.json({ error: "Ingresá un monto válido (0 o más)." }, { status: 400 });
  }

  const reseller = await prisma.pecadoReseller.findUnique({ where: { id: resellerId }, select: { id: true } });
  if (!reseller) return NextResponse.json({ error: "Revendedor no encontrado." }, { status: 404 });

  const updatedSales = await prisma.$transaction((tx) => applyPendingCommission(tx, resellerId, productId, unit));
  return NextResponse.json({ success: true, updatedSales });
}
