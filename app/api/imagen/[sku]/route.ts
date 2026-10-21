import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";

const ALLOWED_IMAGE = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_CHARS = 8 * 1024 * 1024; // ~6 MB de imagen
const SKU_RE = /^[A-Z0-9._-]{1,40}$/;

// GET /api/pecados/imagen/[sku]
// Sirve la imagen del producto directamente desde PostgreSQL (Base64, URL o archivo local) usando su SKU
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku } = await params;
  const cleanSku = decodeURIComponent(sku).trim().toUpperCase();

  // 1. Intentar consultar la imagen almacenada en la base de datos PostgreSQL
  const hasPostgres = Boolean(
    process.env.DATABASE_URL &&
      (process.env.DATABASE_URL.startsWith("postgres://") ||
        process.env.DATABASE_URL.startsWith("postgresql://"))
  );

  if (hasPostgres) {
    try {
      const product = await prisma.pecadoProduct.findUnique({
        where: { sku: cleanSku },
        select: { image: true },
      });

      if (product?.image) {
        // A) Si la imagen está guardada como Data URI Base64 directamente en PostgreSQL
        if (product.image.startsWith("data:image/")) {
          const matches = product.image.match(ALLOWED_IMAGE);
          if (matches) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], "base64");
            return new NextResponse(buffer, {
              headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; sandbox",
              },
            });
          }
        }

        // B) Si la imagen está guardada como URL remota
        if (product.image.startsWith("https://")) {
          return NextResponse.redirect(product.image, { status: 307 });
        }
      }
    } catch (err) {
      console.warn(`[Image API] Error consultando imagen para SKU ${cleanSku} en PostgreSQL:`, err);
    }
  }

  // 2. Respaldo: Archivos locales en public/pecados/products/
  const possibleExtensions = [".jpg", ".png", ".jpeg", ".webp"];
  for (const ext of SKU_RE.test(cleanSku) ? possibleExtensions : []) {
    const filePath = path.join(process.cwd(), "public", "pecados", "products", `${cleanSku}${ext}`);
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
    }
  }

  // 3. Fallback genérico: Logo transparente
  const fallbackPath = path.join(process.cwd(), "public", "pecados", "logo-transparent.png");
  if (fs.existsSync(fallbackPath)) {
    const fileBuffer = fs.readFileSync(fallbackPath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return new NextResponse("Imagen no encontrada", { status: 404 });
}

// POST /api/pecados/imagen/[sku]
// Guarda o actualiza la imagen directamente en la base de datos PostgreSQL para el SKU indicado
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (!isSameOriginJson(request)) {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }

    const { sku } = await params;
    const cleanSku = decodeURIComponent(sku).trim().toUpperCase();
    const body = await request.json();
    const { image } = body;

    const validImage =
      typeof image === "string" &&
      image.length <= MAX_IMAGE_CHARS &&
      (ALLOWED_IMAGE.test(image) || /^https:\/\/[^\s"'<>]+$/.test(image));
    if (!validImage) {
      return NextResponse.json(
        { error: "Imagen inválida: sólo PNG, JPEG, WEBP o GIF (máx. 6 MB) o una URL https." },
        { status: 400 }
      );
    }

    const hasPostgres = Boolean(
      process.env.DATABASE_URL &&
        (process.env.DATABASE_URL.startsWith("postgres://") ||
          process.env.DATABASE_URL.startsWith("postgresql://"))
    );

    if (hasPostgres) {
      await prisma.pecadoProduct.update({
        where: { sku: cleanSku },
        data: { image },
      });
      return NextResponse.json({
        success: true,
        sku: cleanSku,
        message: "Imagen guardada exitosamente en la base de datos PostgreSQL.",
      });
    }

    return NextResponse.json({
      success: true,
      sku: cleanSku,
      warning: "DATABASE_URL no configurada; la imagen fue recibida pero requiere PostgreSQL conectada para persistir en DB.",
    });
  } catch (error) {
    console.error("[Image API] Error guardando imagen en base de datos:", error);
    return NextResponse.json({ error: "Error al guardar imagen en la base de datos." }, { status: 500 });
  }
}
