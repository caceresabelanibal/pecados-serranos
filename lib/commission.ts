import type { Prisma, PrismaClient } from "@prisma/client";

// -------------------------------------------------------------
// Comisión de revendedoras: monto fijo por unidad, definido POR PRODUCTO en Flujo de stock
// (la misma para todas las revendedoras y para cualquier forma de venta: mercadería en mano,
// depósito o compra con su código).
//  - Si el producto todavía no tiene comisión, se usa la de ventas/lotes anteriores (datos viejos).
//  - Si no hay ninguna: queda "a definir" y se completa sola cuando se carga la del producto.
// -------------------------------------------------------------

type Db = PrismaClient | Prisma.TransactionClient;

export async function commissionUnitFor(db: Db, resellerId: string, productId: string | null | undefined): Promise<number | null> {
  if (!productId) return null;
  const product = await db.pecadoProduct.findUnique({ where: { id: productId }, select: { commissionPerUnit: true } });
  if (product?.commissionPerUnit !== null && product?.commissionPerUnit !== undefined) return product.commissionPerUnit;
  const lot = await db.pecadoConsignment.findFirst({
    where: { resellerId, productId, commissionPerUnit: { not: null } },
    orderBy: { date: "desc" },
    select: { commissionPerUnit: true },
  });
  if (lot?.commissionPerUnit !== null && lot?.commissionPerUnit !== undefined) return lot.commissionPerUnit;
  const item = await db.pecadoSaleItem.findFirst({
    where: { productId, commissionUnit: { not: null }, sale: { resellerId, status: { not: "cancelled" } } },
    orderBy: { sale: { date: "desc" } },
    select: { commissionUnit: true },
  });
  return item?.commissionUnit ?? null;
}

// Completa la comisión de los artículos de ese producto que quedaron "a definir" en ventas de
// revendedoras (de todas) y recalcula el total de cada venta. No pisa comisiones ya definidas.
// Devuelve cuántas ventas se actualizaron.
export async function applyPendingCommission(db: Db, productId: string, unit: number): Promise<number> {
  const pending = await db.pecadoSaleItem.findMany({
    where: { productId, commissionUnit: null, sale: { resellerId: { not: null }, status: { not: "cancelled" } } },
    select: { id: true, saleId: true, quantity: true },
  });
  for (const i of pending) {
    await db.pecadoSaleItem.update({
      where: { id: i.id },
      data: withCommission({ quantity: i.quantity }, unit),
    });
  }
  const saleIds = [...new Set(pending.map((i) => i.saleId))];
  for (const saleId of saleIds) {
    const items = await db.pecadoSaleItem.findMany({ where: { saleId }, select: { quantity: true, commissionUnit: true, commission: true } });
    await db.pecadoSale.update({ where: { id: saleId }, data: commissionTotals(items) });
  }
  return saleIds.length;
}

export interface CommissionedItem {
  quantity: number;
  commissionUnit: number | null;
  commission: number;
}

export function withCommission<T extends { quantity: number }>(item: T, unit: number | null): T & CommissionedItem {
  return { ...item, commissionUnit: unit, commission: unit === null ? 0 : Math.round(unit * item.quantity * 100) / 100 };
}

export function commissionTotals(items: CommissionedItem[]) {
  return {
    commissionTotal: Math.round(items.reduce((t, i) => t + i.commission, 0) * 100) / 100,
    commissionPending: items.some((i) => i.commissionUnit === null),
  };
}
