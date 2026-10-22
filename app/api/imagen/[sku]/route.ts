import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { SKU_PATTERN } from "@/lib/pricing";
import { getStoredImage, productImageUrl, resolveProductImage, saveDataUriImage } from "@/lib/product-images";

const ALLOWED_IMAGE = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_CHARS = 8 * 1024 * 1024; // ~6 MB de imagen
const SUPPLIER_HOST = "resources.sexshopargentino.com.ar";

function imageResponse(data: Buffer, mime: string, cache = "public, max-age=3600, stale-while-revalidate=86400") {
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

function isExternalCustomUrl(image: string | null | undefined): boolean {
  if (!image || !image.startsWith("https://")) return false;
  try {
    return new URL(image).host !== SUPPLIER_HOST;
  } catch {
    return false;
  }
}

// GET /api/pecados/imagen/[sku]
// Foto del producto guardada en PostgreSQL. Si todavía no está, se descarga del proveedor
// (o se toma el archivo local), se guarda en la base y se sirve.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const cleanSku = decodeURIComponent(sku).trim().toUpperCase();

  if (SKU_PATTERN.test(cleanSku)) {
    try {
      const product = await prisma.pecadoProduct.findUnique({ where: { sku: cleanSku }, select: { image: true } });

      // URL externa elegida a mano por el administrador
      if (isExternalCustomUrl(product?.image)) {
        return NextResponse.redirect(product!.image as string, { status: 307 });
      }

      const stored = await getStoredImage(cleanSku);
      if (stored) return imageResponse(stored.data, stored.mime);

      // Imagen antigua guardada como data URI en el producto: se pasa a la tabla de imágenes
      if (product?.image?.startsWith("data:image/") && ALLOWED_IMAGE.test(product.image)) {
        if (await saveDataUriImage(cleanSku, product.image)) {
          await prisma.pecadoProduct.update({ where: { sku: cleanSku }, data: { image: productImageUrl(cleanSku) } });
          const saved = await getStoredImage(cleanSku);
          if (saved) return imageResponse(saved.data, saved.mime);
        }
      }

      const resolved = await resolveProductImage(cleanSku);
      if (resolved) return imageResponse(resolved.data, resolved.mime);
    } catch (err) {
      console.warn(`[Image API] Error obteniendo imagen para SKU ${cleanSku}:`, err);
    }
  }

  // Sin foto: logo genérico (no se guarda, para reintentar más adelante)
  const fallbackPath = path.join(process.cwd(), "public", "pecados", "logo-transparent.png");
  if (fs.existsSync(fallbackPath)) {
    return imageResponse(fs.readFileSync(fallbackPath), "image/png", "public, max-age=600");
  }
  return new NextResponse("Imagen no encontrada", { status: 404 });
}

// POST /api/pecados/imagen/[sku]  { image }
// Admin: guarda la foto subida (data URI) en la base, o una URL https externa.
export async function POST(request: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (!isSameOriginJson(request)) {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }

    const { sku } = await params;
    const cleanSku = decodeURIComponent(sku).trim().toUpperCase();
    const { image } = await request.json();

    const validImage =
      typeof image === "string" &&
      image.length <= MAX_IMAGE_CHARS &&
      (ALLOWED_IMAGE.test(image) || /^https:\/\/[^\s"'<>]+$/.test(image));
    if (!SKU_PATTERN.test(cleanSku) || !validImage) {
      return NextResponse.json(
        { error: "Imagen inválida: sólo PNG, JPEG, WEBP o GIF (máx. 6 MB) o una URL https." },
        { status: 400 }
      );
    }

    if (image.startsWith("data:")) {
      if (!(await saveDataUriImage(cleanSku, image))) {
        return NextResponse.json({ error: "No se pudo procesar la imagen." }, { status: 400 });
      }
      await prisma.pecadoProduct.update({ where: { sku: cleanSku }, data: { image: productImageUrl(cleanSku) } });
    } else {
      await prisma.pecadoProduct.update({ where: { sku: cleanSku }, data: { image } });
    }
    return NextResponse.json({ success: true, sku: cleanSku, message: "Imagen guardada en la base de datos." });
  } catch (error) {
    console.error("[Image API] Error guardando imagen en base de datos:", error);
    return NextResponse.json({ error: "Error al guardar imagen en la base de datos." }, { status: 500 });
  }
}
