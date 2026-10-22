import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, isSameOriginJson, rateLimit } from "@/lib/auth";
import { SKU_PATTERN, isProductComplete, precioPublicoTC } from "@/lib/pricing";
import { findResellerByCode, normalizeResellerCode } from "@/lib/reseller-auth";

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 10;

// POST /api/pedidos
// Pedido público desde el carrito (WhatsApp). El servidor toma los precios y el stock
// de la base de datos: el navegador sólo indica SKU y cantidad.
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
        // Descuento atómico: sólo si hay stock suficiente
        const upd = await tx.pecadoProduct.updateMany({
          where: { id: p.id, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (upd.count === 0) throw new Error("NO_STOCK");
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

      return tx.pecadoSale.create({
        data: {
          buyerName: buyerName || "Cliente Web WhatsApp",
          channel: "web_whatsapp",
          resellerId: codeOwner?.id ?? null,
          resellerName: codeOwner?.name ?? null,
          resellerCode: codeOwner?.code ?? null,
          totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
          paymentMethod: "otro",
          status: "completed",
          notes: buyerAddress ? `Dirección: ${buyerAddress}` : "",
          items: { create: items },
        },
      });
    });

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
