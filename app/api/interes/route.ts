import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, isSameOriginJson, rateLimit } from "@/lib/auth";

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 10;

// POST /api/interes
// Registro público de interés en productos sin stock. No descuenta stock ni genera una venta.
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const perIp = rateLimit(`interest:${ip}`, ip === "direct" ? 60 : 5, 10 * 60 * 1000);
  const global = rateLimit("interest:global", 300, 60 * 60 * 1000);
  if (!perIp.ok || !global.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes seguidas. Escribinos directamente por WhatsApp." },
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
  const notes = typeof body?.buyerAddress === "string" ? body.buyerAddress.trim().slice(0, 200) : "";
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const sku = typeof it?.sku === "string" ? it.sku.trim().toUpperCase() : "";
    const qty = Number(it?.quantity);
    if (!/^[A-Z0-9._-]{1,40}$/.test(sku) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }
    wanted.set(sku, Math.min(MAX_QTY_PER_ITEM, (wanted.get(sku) || 0) + qty));
  }

  try {
    const products = await prisma.pecadoProduct.findMany({
      where: { sku: { in: [...wanted.keys()] }, active: true },
      select: { id: true, sku: true, title: true },
    });
    if (products.length !== wanted.size) {
      return NextResponse.json({ error: "Algún producto ya no está disponible." }, { status: 404 });
    }

    await prisma.pecadoInterest.createMany({
      data: products.map((p) => ({
        productId: p.id,
        productSku: p.sku,
        productTitle: p.title,
        quantity: wanted.get(p.sku) || 1,
        buyerName: buyerName || "Cliente Web WhatsApp",
        notes,
      })),
    });

    return NextResponse.json({ success: true, count: products.length });
  } catch (err) {
    console.error("[Interés] Error registrando interés:", err);
    return NextResponse.json({ error: "No se pudo registrar el interés." }, { status: 500 });
  }
}
