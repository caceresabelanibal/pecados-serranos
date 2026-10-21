import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

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
          const matches = product.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], "base64");
            return new NextResponse(buffer, {
              headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
              },
            });
          }
        }

        // B) Si la imagen está guardada como URL remota
        if (product.image.startsWith("http://") || product.image.startsWith("https://")) {
          return NextResponse.redirect(product.image, { status: 307 });
        }
      }
    } catch (err) {
      console.warn(`[Image API] Error consultando imagen para SKU ${cleanSku} en PostgreSQL:`, err);
    }
  }

  // 2. Respaldo: Archivos locales en public/pecados/products/
  const possibleExtensions = [".jpg", ".png", ".jpeg", ".webp"];
  for (const ext of possibleExtensions) {
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
    const { sku } = await params;
    const cleanSku = decodeURIComponent(sku).trim().toUpperCase();
    const body = await request.json();
    const { image, adminPass } = body;

    if (adminPass !== "multipaginas2026") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (!image) {
      return NextResponse.json({ error: "Debe proporcionar los datos de la imagen." }, { status: 400 });
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
