import type { Prisma, PrismaClient } from "@prisma/client";

// -------------------------------------------------------------
// Comisión de revendedoras: monto fijo por unidad, definido por el admin
// lote por lote (artículo por artículo) al entregar mercadería.
//  - Venta de un lote: comisión de ese lote.
//  - Venta con su código o del depósito: la del último lote de ese artículo
//    entregado a esa revendedora; si nunca se le entregó, la última que el admin
//    le definió a mano para ese artículo en una venta. Si no hay ninguna: a definir.
// -------------------------------------------------------------

type Db = PrismaClient | Prisma.TransactionClient;

export async function commissionUnitFor(db: Db, resellerId: string, productId: string | null | undefined): Promise<number | null> {
  if (!productId) return null;
  const lot = await db.pecadoConsignment.findFirst({
    where: { resellerId, productId, commissionPerUnit: { not: null } },
    orderBy: { date: "desc" },
    select: { commissionPerUnit: true },
  });
  if (lot?.commissionPerUnit !== null && lot?.commissionPerUnit !== undefined) return lot.commissionPerUnit;
  const item = await db.pecadoSaleItem.findFirst({
    where: { productId, commissionUnit: { not: null }, sale: { resellerId } },
    orderBy: { sale: { date: "desc" } },
    select: { commissionUnit: true },
  });
  return item?.commissionUnit ?? null;
}

// Define la comisión de los artículos que quedaron "a definir" en ventas de esa revendedora
// (por ejemplo, vendidos con su código sin habérsele entregado) y recalcula el total de cada venta.
// Devuelve cuántas ventas se actualizaron. No pisa comisiones ya definidas.
export async function applyPendingCommission(db: Db, resellerId: string, productId: string, unit: number): Promise<number> {
  const pending = await db.pecadoSaleItem.findMany({
    where: { productId, commissionUnit: null, sale: { resellerId } },
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
