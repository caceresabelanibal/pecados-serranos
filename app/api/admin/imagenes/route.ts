import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { productImageUrl, resolveProductImage } from "@/lib/product-images";

const SUPPLIER_HOST = "resources.sexshopargentino.com.ar";

function isExternalCustomUrl(image: string): boolean {
  if (!image.startsWith("https://")) return false;
  try {
    return new URL(image).host !== SUPPLIER_HOST;
  } catch {
    return false;
  }
}

// POST /api/admin/imagenes  { force?: boolean }
// Descarga y guarda en la base las fotos que falten (o todas si force) y
// apunta cada producto a su foto guardada.
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const products = await prisma.pecadoProduct.findMany({
    where: { active: true },
    select: { sku: true, image: true },
    orderBy: { sku: "asc" },
  });

  const saved: { sku: string; source: string }[] = [];
  const missing: string[] = [];
  const skipped: string[] = [];

  for (const p of products) {
    if (isExternalCustomUrl(p.image)) {
      skipped.push(p.sku);
      continue;
    }
    const img = await resolveProductImage(p.sku, { force });
    if (!img) {
      missing.push(p.sku);
      continue;
    }
    saved.push({ sku: p.sku, source: img.sourceUrl });
    const url = productImageUrl(p.sku);
    if (p.image !== url) {
      await prisma.pecadoProduct.update({ where: { sku: p.sku }, data: { image: url } });
    }
  }

  return NextResponse.json({ success: true, total: products.length, saved, missing, skipped });
}
