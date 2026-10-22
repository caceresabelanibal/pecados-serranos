import type { Prisma, PrismaClient } from "@prisma/client";

// -------------------------------------------------------------
// Comisión de revendedoras: monto fijo por unidad, definido por el admin
// lote por lote (artículo por artículo) al entregar mercadería.
//  - Venta de un lote: comisión de ese lote.
//  - Venta con su código o del depósito: la del último lote de ese artículo
//    entregado a esa revendedora. Si nunca se le entregó: sin comisión definida.
// -------------------------------------------------------------

type Db = PrismaClient | Prisma.TransactionClient;

export async function commissionUnitFor(db: Db, resellerId: string, productId: string | null | undefined): Promise<number | null> {
  if (!productId) return null;
  const lot = await db.pecadoConsignment.findFirst({
    where: { resellerId, productId, commissionPerUnit: { not: null } },
    orderBy: { date: "desc" },
    select: { commissionPerUnit: true },
  });
  return lot?.commissionPerUnit ?? null;
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
