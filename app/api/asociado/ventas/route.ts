import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOriginJson, rateLimit } from "@/lib/auth";
import { getSessionReseller } from "@/lib/reseller-auth";
import { isProductComplete, precioPublicoTC } from "@/lib/pricing";
import { PAYMENT_METHOD_OPTIONS, isCashPriceMethod, type PaymentMethod } from "@/app/products";

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 100;

// POST /api/asociado/ventas
// El asociado registra una venta propia. El revendedor sale de la sesión (no se puede elegir),
// los precios y el stock los calcula el servidor y el stock se descuenta al confirmar.
export async function POST(request: Request) {
  const reseller = await getSessionReseller(request);
  if (!reseller) {
    return NextResponse.json({ error: "Tu sesión expiró. Ingresá de nuevo." }, { status: 401 });
  }
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const rl = rateLimit(`asociado-venta:${reseller.id}`, 60, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas ventas seguidas. Probá en un rato." }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const paymentMethod: PaymentMethod = PAYMENT_METHOD_OPTIONS.some((o) => o.value === body?.paymentMethod)
    ? body.paymentMethod
    : "efectivo";
  const buyerName = typeof body?.buyerName === "string" ? body.buyerName.trim().slice(0, 80) : "";
  const buyerPhone = typeof body?.buyerPhone === "string" ? body.buyerPhone.replace(/[^0-9+]/g, "").slice(0, 20) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 300) : "";
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Agregá al menos un producto." }, { status: 400 });
  }

  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const id = typeof it?.productId === "string" ? it.productId : "";
    const qty = Number(it?.quantity);
    if (!id || id.length > 64 || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return NextResponse.json({ error: "Venta inválida." }, { status: 400 });
    }
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const items: { productId: string; productSku: string; productTitle: string; quantity: number; unitPrice: number; subtotal: number }[] = [];
      for (const [id, qty] of wanted) {
        const p = await tx.pecadoProduct.findUnique({ where: { id } });
        if (!p || !p.active || !isProductComplete(p)) throw new Error("NOT_FOUND");
        const upd = await tx.pecadoProduct.updateMany({
          where: { id: p.id, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (upd.count === 0) throw Object.assign(new Error("NO_STOCK"), { title: p.title, stock: p.stock });
        // Efectivo / transferencia / Mercado Pago: Precio Público FT. Tarjeta y otros: Precio Público TC.
        const unitPrice = isCashPriceMethod(paymentMethod) ? p.precioEfectivo : precioPublicoTC(p.precioEfectivo);
        items.push({
          productId: p.id,
          productSku: p.sku,
          productTitle: p.title,
          quantity: qty,
          unitPrice,
          subtotal: Math.round(unitPrice * qty * 100) / 100,
        });
      }

      return tx.pecadoSale.create({
        data: {
          buyerName: buyerName || "Cliente",
          buyerPhone,
          channel: "reseller",
          resellerId: reseller.id,
          resellerName: reseller.name,
          totalAmount: Math.round(items.reduce((t, i) => t + i.subtotal, 0) * 100) / 100,
          paymentMethod,
          status: "completed",
          notes: [notes, isCashPriceMethod(paymentMethod) ? "Descuento por pago en efectivo (Precio Público FT)" : "", "Registrada por la asociada"]
            .filter(Boolean)
            .join(" | "),
          items: { create: items },
        },
      });
    });
    return NextResponse.json({ success: true, saleId: sale.id, totalAmount: sale.totalAmount });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg === "NO_STOCK") {
      return NextResponse.json({ error: `No hay stock suficiente de "${err.title}" (disponible: ${err.stock}).` }, { status: 409 });
    }
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Algún producto ya no está disponible." }, { status: 404 });
    }
    console.error("[Asociado] Error registrando venta:", err);
    return NextResponse.json({ error: "No se pudo registrar la venta." }, { status: 500 });
  }
}
