import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

interface StockItem {
  productId: string | null;
  quantity: number;
  consignmentId: string | null;
}

// Devuelve el stock de los ítems de una venta: lo que salió de un lote en consignación vuelve
// a "en mano" de la revendedora; lo que salió del depósito vuelve al stock de la tienda.
export async function restoreSaleStock(
  db: Db,
  sale: { resellerId: string | null; notes: string; stockApplied?: boolean; items: StockItem[] }
) {
  // Compra online que nunca se pagó: no había descontado stock
  if (sale.stockApplied === false) return;
  for (const i of sale.items) {
    let lotId = i.consignmentId;
    // Ventas anteriores a que se guardara el lote: se busca el lote de ese artículo con unidades vendidas
    if (!lotId && sale.resellerId && i.productId && /consignaci|Rendición de lote/.test(sale.notes)) {
      const lot = await db.pecadoConsignment.findFirst({
        where: { resellerId: sale.resellerId, productId: i.productId, quantitySold: { gte: i.quantity } },
        orderBy: { date: "desc" },
        select: { id: true },
      });
      lotId = lot?.id ?? null;
    }
    if (lotId) {
      await db.$executeRaw`
        UPDATE "PecadoConsignment"
        SET "quantitySold" = GREATEST(0, "quantitySold" - ${i.quantity}),
            "status" = CASE WHEN GREATEST(0, "quantitySold" - ${i.quantity}) + "quantityReturned" >= "quantityGiven" THEN 'settled' ELSE 'active' END,
            "updatedAt" = NOW()
        WHERE id = ${lotId}`;
    } else if (i.productId) {
      await db.pecadoProduct.updateMany({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
    }
  }
}

// Anula una venta: devuelve el stock y la marca como anulada (no se borra, así un panel
// abierto con datos viejos no la vuelve a crear). Devuelve false si ya estaba anulada.
export async function cancelSale(db: Db, saleId: string): Promise<boolean> {
  const sale = await db.pecadoSale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!sale || sale.status === "cancelled") return false;
  // Se marca primero y de forma condicional: dos anulaciones simultáneas no devuelven el stock dos veces
  const marked = await db.pecadoSale.updateMany({
    where: { id: saleId, status: { not: "cancelled" } },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
  if (marked.count === 0) return false;
  await restoreSaleStock(db, sale);
  return true;
}

// Confirma una compra pendiente (pagada con Mercado Pago o cobrada en mano por el admin):
// recién ahí se descuenta el stock del depósito.
//  - strict: si falta stock de algún artículo no se confirma nada (error "NO_STOCK" con el título).
//  - no strict (pago ya acreditado): se confirma igual; el stock queda en 0 y se avisa en las notas.
// Devuelve false si la compra ya no estaba pendiente.
export async function confirmPendingSale(
  db: Prisma.TransactionClient,
  saleId: string,
  data: { paymentMethod?: string; mpPaymentId?: string },
  strict: boolean
): Promise<boolean> {
  const sale = await db.pecadoSale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!sale || sale.status !== "pending") return false;
  // Se marca primero y de forma condicional: dos confirmaciones simultáneas no descuentan dos veces
  const marked = await db.pecadoSale.updateMany({
    where: { id: saleId, status: "pending" },
    data: { status: "completed", stockApplied: true, ...data },
  });
  if (marked.count === 0) return false;
  if (sale.stockApplied) return true;

  const short: string[] = [];
  for (const i of sale.items) {
    if (!i.productId) continue;
    const upd = await db.pecadoProduct.updateMany({
      where: { id: i.productId, stock: { gte: i.quantity } },
      data: { stock: { decrement: i.quantity } },
    });
    if (upd.count === 0) {
      if (strict) throw Object.assign(new Error("NO_STOCK"), { title: i.productTitle });
      await db.pecadoProduct.updateMany({ where: { id: i.productId }, data: { stock: 0 } });
      short.push(i.productTitle);
    }
  }
  if (short.length > 0) {
    await db.pecadoSale.update({
      where: { id: saleId },
      data: { notes: [sale.notes, `⚠ Pagada sin stock suficiente de: ${short.join(", ")}`].filter(Boolean).join(" | ") },
    });
  }
  return true;
}

// Ventas que la asociada cargó ella misma y todavía no rindió: las puede editar o anular
export function isEditableByReseller(
  sale: { resellerId: string | null; channel: string; status: string; settledAt: Date | null; notes: string },
  resellerId: string
): boolean {
  return (
    sale.resellerId === resellerId &&
    sale.channel === "reseller" &&
    sale.status !== "cancelled" &&
    !sale.settledAt &&
    sale.notes.includes("Registrada por la asociada")
  );
}
