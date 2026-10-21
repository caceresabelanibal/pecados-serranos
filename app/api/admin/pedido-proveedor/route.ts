import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_PLAN_ITEMS = 500;

async function readPlan() {
  const items = await prisma.pecadoPurchasePlanItem.findMany({ orderBy: { createdAt: "asc" } });
  return items.map((i) => ({
    productSku: i.productSku,
    productTitle: i.productTitle,
    tipo: i.tipo,
    quantity: i.quantity,
    costoSinIva: i.costoSinIva,
    image: i.image,
    fromInterest: i.fromInterest,
  }));
}

// GET /api/admin/pedido-proveedor
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json({ items: await readPlan() }, { headers: NO_STORE });
}

// PUT /api/admin/pedido-proveedor  { items: PurchasePlanItem[] }
// Reemplaza el pedido completo y sincroniza el estado de los interesados:
// los productos incluidos pasan a "ordered" y los que se quitan vuelven a "pending".
export async function PUT(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const raw = Array.isArray(body?.items) ? body.items : null;
  if (!raw || raw.length > MAX_PLAN_ITEMS) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const bySku = new Map<string, {
    productSku: string;
    productTitle: string;
    tipo: string;
    quantity: number;
    costoSinIva: number;
    image: string;
    fromInterest: boolean;
  }>();
  for (const it of raw) {
    const sku = typeof it?.productSku === "string" ? it.productSku.trim().toUpperCase() : "";
    const quantity = Number(it?.quantity);
    const costo = Number(it?.costoSinIva);
    if (!/^[A-Z0-9._-]{1,40}$/.test(sku) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return NextResponse.json({ error: `Artículo inválido en el pedido (${sku || "sin código"}).` }, { status: 400 });
    }
    bySku.set(sku, {
      productSku: sku,
      productTitle: String(it?.productTitle || `Artículo ${sku}`).slice(0, 500),
      tipo: String(it?.tipo || "").slice(0, 100),
      quantity,
      costoSinIva: Number.isFinite(costo) && costo >= 0 ? costo : 0,
      image:
        typeof it?.image === "string" && it.image.length <= 1000 && !it.image.startsWith("data:") ? it.image : "",
      fromInterest: Boolean(it?.fromInterest),
    });
  }

  const skus = [...bySku.keys()];
  try {
    await prisma.$transaction([
      prisma.pecadoPurchasePlanItem.deleteMany({ where: { productSku: { notIn: skus } } }),
      ...[...bySku.values()].map((data) =>
        prisma.pecadoPurchasePlanItem.upsert({ where: { productSku: data.productSku }, update: data, create: data })
      ),
      prisma.pecadoInterest.updateMany({
        where: { status: "pending", productSku: { in: skus } },
        data: { status: "ordered" },
      }),
      prisma.pecadoInterest.updateMany({
        where: { status: "ordered", productSku: { notIn: skus } },
        data: { status: "pending" },
      }),
    ]);
  } catch (err) {
    console.error("[Pedido proveedor] Error guardando:", err);
    return NextResponse.json({ error: "No se pudo guardar el pedido." }, { status: 500 });
  }

  return NextResponse.json({ success: true, items: await readPlan() });
}
