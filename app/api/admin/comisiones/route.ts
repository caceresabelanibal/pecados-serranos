import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { applyPendingCommission } from "@/lib/commission";

// PUT /api/admin/comisiones  { productId, commissionUnit }
// Sólo admin: comisión de revendedora por unidad de un producto (la misma para todas las revendedoras).
//  - commissionUnit número >= 0: se guarda en el producto y completa las ventas que la tenían "a definir".
//  - commissionUnit null o "": el producto queda sin comisión definida (las ventas nuevas quedan "a definir").
export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const clear = body?.commissionUnit === null || body?.commissionUnit === "";
  const unit = Number(body?.commissionUnit);
  if (!productId || (!clear && (!Number.isFinite(unit) || unit < 0 || unit > 1e9))) {
    return NextResponse.json({ error: "Ingresá un monto válido (0 o más)." }, { status: 400 });
  }

  const product = await prisma.pecadoProduct.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  const updatedSales = await prisma.$transaction(async (tx) => {
    await tx.pecadoProduct.update({ where: { id: productId }, data: { commissionPerUnit: clear ? null : Math.round(unit * 100) / 100 } });
    return clear ? 0 : applyPendingCommission(tx, productId, Math.round(unit * 100) / 100);
  });
  return NextResponse.json({ success: true, updatedSales });
}
