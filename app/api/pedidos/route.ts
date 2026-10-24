import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, isSameOriginJson, rateLimit } from "@/lib/auth";
import { SKU_PATTERN, isProductComplete, precioPublicoTC } from "@/lib/pricing";
import { findResellerByCode, normalizeResellerCode } from "@/lib/reseller-auth";
import { commissionTotals, commissionUnitFor, withCommission } from "@/lib/commission";
import { createPreference, getMpToken, publicBaseUrl, sweepExpiredOrders, syncSale } from "@/lib/mercadopago";
import { cancelSale } from "@/lib/sales";

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 10;

// POST /api/pedidos
// Compra pública desde el carrito. El servidor toma los precios y el stock de la base de datos:
// el navegador sólo indica SKU y cantidad.
// La compra queda "pending" y NO descuenta stock hasta que se cobra:
//  - checkout "mercadopago" (si está configurado): se devuelve el link de pago; se confirma sola
//    cuando Mercado Pago acredita el pago.
//  - efectivo en mano (pedido por WhatsApp): la confirma el admin cuando recibe el dinero.
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const perIp = rateLimit(`order:${ip}`, ip === "direct" ? 60 : 5, 10 * 60 * 1000);
  const global = rateLimit("order:global", 200, 60 * 60 * 1000);
  if (!perIp.ok || !global.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos seguidos. Escribinos directamente por WhatsApp." },
      { status: 429, headers: { "Retry-After": String(Math.max(perIp.retryAfter, global.retryAfter)) } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const buyerName = typeof body?.buyerName === "string" ? body.buyerName.trim().slice(0, 80) : "";
  const buyerAddress = typeof body?.buyerAddress === "string" ? body.buyerAddress.trim().slice(0, 200) : "";
  if (buyerName.length < 3 || buyerAddress.length < 3) {
    return NextResponse.json({ error: "Completá tu nombre completo y la dirección de entrega." }, { status: 400 });
  }
  const mpToken = body?.checkout === "mercadopago" ? await getMpToken() : null;
  if (body?.checkout === "mercadopago" && !mpToken) {
    return NextResponse.json({ error: "El pago online no está disponible en este momento." }, { status: 503 });
  }
  // Si este navegador ya había abierto un pago y vuelve a "Finalizar compra", la orden anterior
  // sin pagar se anula (no se acumulan órdenes). Si en realidad ya estaba pagada, no se crea otra.
  const previousOrder = typeof body?.previousOrder === "string" ? body.previousOrder.slice(0, 64) : "";
  if (mpToken && previousOrder) {
    try {
      const prev = await prisma.pecadoSale.findUnique({ where: { id: previousOrder }, select: { channel: true, paymentMethod: true, status: true } });
      if (prev && prev.channel === "web_whatsapp" && prev.paymentMethod === "mercadopago") {
        const st = await syncSale(previousOrder, { abandoned: true });
        if (st === "completed") {
          return NextResponse.json({ alreadyPaid: true, saleId: previousOrder });
        }
      }
    } catch (err: any) {
      console.error("[MercadoPago] Error revisando la orden anterior:", previousOrder, err?.message);
    }
  }

  // Anula las órdenes de Mercado Pago vencidas sin pago
  await sweepExpiredOrders().catch((err) => console.error("[MercadoPago] Error liberando órdenes vencidas:", err));
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // Normalizar y agrupar por SKU
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const sku = typeof it?.sku === "string" ? it.sku.trim().toUpperCase() : "";
    const qty = Number(it?.quantity);
    if (!SKU_PATTERN.test(sku) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
    wanted.set(sku, (wanted.get(sku) || 0) + qty);
  }

  // Código de revendedora (opcional): si se ingresa, tiene que existir
  const resellerCode = normalizeResellerCode(body?.resellerCode);
  const codeOwner = resellerCode ? await findResellerByCode(resellerCode) : null;
  if (resellerCode && !codeOwner) {
    return NextResponse.json({ error: "El código de revendedora no es válido." }, { status: 400 });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const items: { productId: string; productSku: string; productTitle: string; quantity: number; unitPrice: number; subtotal: number }[] = [];
      for (const [sku, qty] of wanted) {
        const p = await tx.pecadoProduct.findUnique({ where: { sku } });
        if (!p || !p.active || !isProductComplete(p)) throw new Error("NOT_FOUND");
        // Tiene que haber stock, pero no se descuenta hasta que la compra se pague
        if (p.stock < qty) throw new Error("NO_STOCK");
        // Precio único de la tienda: Precio Público TC
        const unitPrice = precioPublicoTC(p.precioEfectivo);
        items.push({
          productId: p.id,
          productSku: p.sku,
          productTitle: p.title,
          quantity: qty,
          unitPrice,
          subtotal: unitPrice * qty,
        });
      }

      // Compra con código: comisión de la revendedora según lo que tiene asignado para cada artículo
      const finalItems = codeOwner
        ? await Promise.all(items.map(async (i) => withCommission(i, await commissionUnitFor(tx, codeOwner.id, i.productId))))
        : items;
      const commission = codeOwner ? commissionTotals(finalItems as any) : { commissionTotal: 0, commissionPending: false };

      return tx.pecadoSale.create({
        data: {
          buyerName,
          channel: "web_whatsapp",
          resellerId: codeOwner?.id ?? null,
          resellerName: codeOwner?.name ?? null,
          resellerCode: codeOwner?.code ?? null,
          ...commission,
          totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
          paymentMethod: mpToken ? "mercadopago" : "efectivo",
          status: "pending",
          stockApplied: false,
          notes: buyerAddress ? `Dirección: ${buyerAddress}` : "",
          items: { create: finalItems },
        },
        include: { items: true },
      });
    });

    if (mpToken) {
      try {
        const pref = await createPreference(mpToken, {
          saleId: sale.id,
          baseUrl: publicBaseUrl(request),
          buyerName,
          items: sale.items.map((i) => ({ sku: i.productSku, title: i.productTitle, quantity: i.quantity, unitPrice: i.unitPrice })),
        });
        await prisma.pecadoSale.update({ where: { id: sale.id }, data: { mpPreferenceId: pref.id } });
        return NextResponse.json({ success: true, saleId: sale.id, totalAmount: sale.totalAmount, paymentUrl: pref.initPoint });
      } catch (err: any) {
        // Sin link de pago no hay compra
        console.error("[MercadoPago] Error creando el pago:", err?.message, JSON.stringify(err?.data || {}));
        await prisma.$transaction((tx) => cancelSale(tx, sale.id));
        return NextResponse.json({ error: "No se pudo iniciar el pago con Mercado Pago. Probá de nuevo en unos minutos." }, { status: 502 });
      }
    }

    return NextResponse.json({ success: true, saleId: sale.id, totalAmount: sale.totalAmount });
  } catch (err: any) {
    if (err?.message === "NO_STOCK") {
      return NextResponse.json({ error: "Algún producto ya no tiene stock suficiente." }, { status: 409 });
    }
    if (err?.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Algún producto ya no está disponible." }, { status: 404 });
    }
    console.error("[Pedidos] Error registrando pedido:", err);
    return NextResponse.json({ error: "No se pudo registrar el pedido." }, { status: 500 });
  }
}
