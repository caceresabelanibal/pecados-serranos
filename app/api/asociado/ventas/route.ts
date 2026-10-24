import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSameOriginJson, rateLimit } from "@/lib/auth";
import { getSessionReseller } from "@/lib/reseller-auth";
import { commissionTotals, commissionUnitFor, withCommission, type CommissionedItem } from "@/lib/commission";
import { isEditableByReseller, restoreSaleStock } from "@/lib/sales";
import { isProductComplete, precioPublicoTC } from "@/lib/pricing";
import { PAYMENT_METHOD_OPTIONS, isCashPriceMethod, type PaymentMethod } from "@/app/products";

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 100;

type Reseller = NonNullable<Awaited<ReturnType<typeof getSessionReseller>>>;
type SaleItemData = {
  productId: string;
  productSku: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  consignmentId: string | null;
} & CommissionedItem;

interface SaleInput {
  paymentMethod: PaymentMethod;
  buyerName: string;
  buyerPhone: string;
  notes: string;
  wanted: Map<string, number>;
}

// Valida el cuerpo de la venta (alta o edición). Devuelve un mensaje de error o los datos.
function parseSaleInput(body: any): SaleInput | string {
  const paymentMethod: PaymentMethod = PAYMENT_METHOD_OPTIONS.some((o) => o.value === body?.paymentMethod)
    ? body.paymentMethod
    : "efectivo";
  const buyerName = typeof body?.buyerName === "string" ? body.buyerName.trim().slice(0, 80) : "";
  const buyerPhone = typeof body?.buyerPhone === "string" ? body.buyerPhone.replace(/[^0-9+]/g, "").slice(0, 20) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 300) : "";
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) return "Agregá al menos un producto.";

  // Cada ítem sale de su mercadería en consignación ("c:<id>") o del depósito de la tienda ("p:<id>")
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const cid = typeof it?.consignmentId === "string" ? it.consignmentId : "";
    const pid = typeof it?.productId === "string" ? it.productId : "";
    const key = cid ? `c:${cid}` : pid ? `p:${pid}` : "";
    const qty = Number(it?.quantity);
    if (!key || key.length > 70 || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) return "Venta inválida.";
    wanted.set(key, (wanted.get(key) || 0) + qty);
  }
  return { paymentMethod, buyerName, buyerPhone, notes, wanted };
}

// Descuenta el stock y arma los ítems con precio y comisión (dentro de la transacción)
async function buildSale(tx: Prisma.TransactionClient, reseller: Reseller, input: SaleInput) {
  const items: SaleItemData[] = [];
  let fromConsignment = false;
  for (const [key, qty] of input.wanted) {
    const id = key.slice(2);
    if (key.startsWith("c:")) {
      // Venta de su mercadería: se descuenta de lo que tiene en mano (el stock del depósito
      // ya bajó al entregársela). Sólo consignaciones propias con unidades pendientes.
      const n = await tx.$executeRaw`
        UPDATE "PecadoConsignment"
        SET "quantitySold" = "quantitySold" + ${qty},
            "status" = CASE WHEN "quantitySold" + ${qty} + "quantityReturned" >= "quantityGiven" THEN 'settled' ELSE 'active' END,
            "updatedAt" = NOW()
        WHERE id = ${id} AND "resellerId" = ${reseller.id}
          AND "quantityGiven" - "quantitySold" - "quantityReturned" >= ${qty}`;
      const c = await tx.pecadoConsignment.findUnique({ where: { id } });
      if (!c || c.resellerId !== reseller.id) throw new Error("NOT_FOUND");
      if (n === 0) {
        throw Object.assign(new Error("NO_STOCK"), {
          title: `${c.productTitle} (tu mercadería)`,
          stock: Math.max(0, c.quantityGiven - c.quantitySold - c.quantityReturned),
        });
      }
      fromConsignment = true;
      // Comisión: la del lote vendido
      items.push(
        withCommission(
          {
            productId: c.productId,
            productSku: c.productSku,
            productTitle: c.productTitle,
            quantity: qty,
            unitPrice: c.unitAgreedPrice,
            subtotal: Math.round(c.unitAgreedPrice * qty * 100) / 100,
            consignmentId: c.id,
          },
          c.commissionPerUnit
        )
      );
      continue;
    }

    const p = await tx.pecadoProduct.findUnique({ where: { id } });
    if (!p || !p.active || !isProductComplete(p)) throw new Error("NOT_FOUND");
    const upd = await tx.pecadoProduct.updateMany({
      where: { id: p.id, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (upd.count === 0) throw Object.assign(new Error("NO_STOCK"), { title: p.title, stock: p.stock });
    // Efectivo / transferencia / Mercado Pago: Precio Público FT. Tarjeta y otros: Precio Público TC.
    const unitPrice = isCashPriceMethod(input.paymentMethod) ? p.precioEfectivo : precioPublicoTC(p.precioEfectivo);
    // Del depósito: comisión asignada a esta revendedora para ese artículo
    items.push(
      withCommission(
        {
          productId: p.id,
          productSku: p.sku,
          productTitle: p.title,
          quantity: qty,
          unitPrice,
          subtotal: Math.round(unitPrice * qty * 100) / 100,
          consignmentId: null,
        },
        await commissionUnitFor(tx, reseller.id, p.id)
      )
    );
  }

  return {
    items,
    data: {
      buyerName: input.buyerName || "Cliente",
      buyerPhone: input.buyerPhone,
      ...commissionTotals(items),
      totalAmount: Math.round(items.reduce((t, i) => t + i.subtotal, 0) * 100) / 100,
      paymentMethod: input.paymentMethod,
      notes: [
        input.notes,
        fromConsignment ? "Vendido de su mercadería en consignación" : "",
        isCashPriceMethod(input.paymentMethod) ? "Descuento por pago en efectivo (Precio Público FT)" : "",
        "Registrada por la asociada",
      ]
        .filter(Boolean)
        .join(" | "),
    },
  };
}

function errorResponse(err: any, action: string) {
  const msg = String(err?.message || "");
  if (msg === "NO_STOCK") {
    return NextResponse.json({ error: `No hay stock suficiente de "${err.title}" (disponible: ${err.stock}).` }, { status: 409 });
  }
  if (msg === "NOT_FOUND") {
    return NextResponse.json({ error: "Algún producto ya no está disponible." }, { status: 404 });
  }
  if (msg === "NOT_EDITABLE") {
    return NextResponse.json({ error: "Esta venta ya no se puede modificar (fue rendida a la tienda o anulada)." }, { status: 409 });
  }
  console.error(`[Asociado] Error al ${action} venta:`, err);
  return NextResponse.json({ error: `No se pudo ${action} la venta.` }, { status: 500 });
}

// Sesión de asociada, mismo origen y límite de operaciones. Devuelve la revendedora y el cuerpo, o la respuesta de error.
async function guard(request: Request): Promise<{ reseller: Reseller; body: any } | NextResponse> {
  const reseller = await getSessionReseller(request);
  if (!reseller) {
    return NextResponse.json({ error: "Tu sesión expiró. Ingresá de nuevo." }, { status: 401 });
  }
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const rl = rateLimit(`asociado-venta:${reseller.id}`, 60, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas operaciones seguidas. Probá en un rato." }, { status: 429 });
  }
  try {
    return { reseller, body: await request.json() };
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
}

// Bloquea la venta dentro de la transacción y verifica que la asociada la pueda modificar
async function lockEditableSale(tx: Prisma.TransactionClient, id: string, resellerId: string) {
  await tx.$executeRaw`SELECT id FROM "PecadoSale" WHERE id = ${id} FOR UPDATE`;
  const sale = await tx.pecadoSale.findUnique({ where: { id }, include: { items: true } });
  if (!sale || !isEditableByReseller(sale, resellerId)) throw new Error("NOT_EDITABLE");
  return sale;
}

// POST /api/asociado/ventas
// El asociado registra una venta propia. El revendedor sale de la sesión (no se puede elegir),
// los precios y el stock los calcula el servidor y el stock se descuenta al confirmar.
export async function POST(request: Request) {
  const g = await guard(request);
  if (g instanceof NextResponse) return g;
  const input = parseSaleInput(g.body);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const built = await buildSale(tx, g.reseller, input);
      return tx.pecadoSale.create({
        data: {
          ...built.data,
          channel: "reseller",
          resellerId: g.reseller.id,
          resellerName: g.reseller.name,
          status: "completed",
          items: { create: built.items },
        },
      });
    });
    return NextResponse.json({ success: true, saleId: sale.id, totalAmount: sale.totalAmount });
  } catch (err: any) {
    return errorResponse(err, "registrar");
  }
}

// PUT /api/asociado/ventas  { id, ...mismos datos que el alta }
// Edita una venta propia sin rendir: devuelve el stock de la venta original y vuelve a
// descontar con los datos nuevos, todo en una transacción. Mantiene el número y la fecha.
export async function PUT(request: Request) {
  const g = await guard(request);
  if (g instanceof NextResponse) return g;
  const id = typeof g.body?.id === "string" ? g.body.id : "";
  if (!id) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const input = parseSaleInput(g.body);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const current = await lockEditableSale(tx, id, g.reseller.id);
      await restoreSaleStock(tx, current);
      await tx.pecadoSaleItem.deleteMany({ where: { saleId: id } });
      const built = await buildSale(tx, g.reseller, input);
      return tx.pecadoSale.update({ where: { id }, data: { ...built.data, items: { create: built.items } } });
    });
    return NextResponse.json({ success: true, saleId: sale.id, totalAmount: sale.totalAmount });
  } catch (err: any) {
    return errorResponse(err, "editar");
  }
}

// DELETE /api/asociado/ventas  { id }
// Anula una venta propia sin rendir (ej: la clienta se arrepintió): el stock vuelve a donde estaba.
export async function DELETE(request: Request) {
  const g = await guard(request);
  if (g instanceof NextResponse) return g;
  const id = typeof g.body?.id === "string" ? g.body.id : "";
  if (!id) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const current = await lockEditableSale(tx, id, g.reseller.id);
      await tx.pecadoSale.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } });
      await restoreSaleStock(tx, current);
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err, "anular");
  }
}
