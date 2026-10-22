import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Product, Sale, Reseller, Consignment, PurchaseRecord } from "@/app/products";
import { INITIAL_PRODUCTS, INITIAL_RESELLERS, INITIAL_PURCHASES } from "@/lib/initial-data";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { isProductComplete, isValidMultiplier, precioPublicoTC, proveedorConIva } from "@/lib/pricing";
import { productImageUrl, saveDataUriImage } from "@/lib/product-images";

// Valores de precio normalizados con las fórmulas del flujo de caja (el servidor es la fuente de verdad)
function normalizePricing(p: any) {
  const costoSinIva = Math.max(0, Number(p.costoSinIva) || 0);
  const costoConIva = proveedorConIva(costoSinIva);
  const mult = Number(p.multiplicadorGanancia);
  const multiplicadorGanancia = isValidMultiplier(mult) ? mult : 0;
  const precioEfectivo = Math.max(0, Number(p.precioEfectivo ?? p.price) || 0);
  return {
    costoSinIva,
    costoConIva,
    multiplicadorGanancia,
    gananciaSugerida: costoConIva * multiplicadorGanancia,
    precioEfectivo,
    precioTarjeta: precioPublicoTC(precioEfectivo),
  };
}

// Cache de respaldo en memoria si la base de datos está desconectada
let memoryProducts: Product[] = [...INITIAL_PRODUCTS];
let memorySales: Sale[] = [];
let memoryResellers: Reseller[] = [...INITIAL_RESELLERS];
let memoryConsignments: Consignment[] = [];
let memoryPurchases: PurchaseRecord[] = [...INITIAL_PURCHASES];
let memoryWhatsappNumber = "541161314128";
let serverUpdatedAt: string | null = null;

// Helper para verificar y resolver la conexión de base de datos
function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function isPostgresConfigured(): boolean {
  const url = getDatabaseUrl();
  return Boolean(url && (url.startsWith("postgres://") || url.startsWith("postgresql://")));
}

let tablesEnsured = false;

// Auto-inicialización resiliente de tablas si la base de datos está recién creada en Neon/Supabase
async function ensureTablesExist() {
  if (tablesEnsured) return;

  const DDL_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS "PecadoProduct" (
      "id" TEXT NOT NULL,
      "sku" TEXT NOT NULL,
      "tipo" TEXT NOT NULL DEFAULT 'Conjunto de lencería',
      "category" TEXT NOT NULL DEFAULT 'Conjunto de lencería',
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "costoSinIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "costoConIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "multiplicadorGanancia" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
      "gananciaSugerida" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "precioEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "precioTarjeta" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "precioFinalProveedor" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "stock" INTEGER NOT NULL DEFAULT 0,
      "minStock" INTEGER NOT NULL DEFAULT 2,
      "observaciones" TEXT NOT NULL DEFAULT '',
      "image" TEXT NOT NULL DEFAULT '/pecados/auriculares.jpg',
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PecadoProduct_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PecadoProduct_sku_key" ON "PecadoProduct"("sku")`,
    `CREATE INDEX IF NOT EXISTS "PecadoProduct_sku_idx" ON "PecadoProduct"("sku")`,
    `CREATE INDEX IF NOT EXISTS "PecadoProduct_tipo_idx" ON "PecadoProduct"("tipo")`,
    `CREATE TABLE IF NOT EXISTS "PecadoReseller" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL DEFAULT '',
      "zone" TEXT NOT NULL DEFAULT '',
      "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PecadoReseller_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "PecadoSale" (
      "id" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "buyerName" TEXT NOT NULL DEFAULT 'Cliente Mostrador',
      "buyerPhone" TEXT NOT NULL DEFAULT '',
      "channel" TEXT NOT NULL DEFAULT 'direct_sale',
      "resellerId" TEXT,
      "resellerName" TEXT,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paymentMethod" TEXT NOT NULL DEFAULT 'efectivo',
      "status" TEXT NOT NULL DEFAULT 'completed',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PecadoSale_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "PecadoSale_date_idx" ON "PecadoSale"("date")`,
    `CREATE TABLE IF NOT EXISTS "PecadoSaleItem" (
      "id" TEXT NOT NULL,
      "saleId" TEXT NOT NULL,
      "productId" TEXT,
      "productSku" TEXT NOT NULL DEFAULT 'S/C',
      "productTitle" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      CONSTRAINT "PecadoSaleItem_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "PecadoSaleItem_saleId_idx" ON "PecadoSaleItem"("saleId")`,
    `CREATE TABLE IF NOT EXISTS "PecadoConsignment" (
      "id" TEXT NOT NULL,
      "resellerId" TEXT NOT NULL,
      "resellerName" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "productId" TEXT NOT NULL,
      "productSku" TEXT NOT NULL DEFAULT 'S/C',
      "productTitle" TEXT NOT NULL,
      "quantityGiven" INTEGER NOT NULL DEFAULT 0,
      "unitAgreedPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "quantitySold" INTEGER NOT NULL DEFAULT 0,
      "quantityReturned" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'active',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PecadoConsignment_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "PecadoConsignment_resellerId_idx" ON "PecadoConsignment"("resellerId")`,
    `CREATE INDEX IF NOT EXISTS "PecadoConsignment_status_idx" ON "PecadoConsignment"("status")`,
    `CREATE TABLE IF NOT EXISTS "PecadoPurchase" (
      "id" TEXT NOT NULL,
      "fileName" TEXT NOT NULL DEFAULT 'Importación Excel',
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "source" TEXT NOT NULL DEFAULT 'excel_import',
      "notes" TEXT NOT NULL DEFAULT '',
      "totalItems" INTEGER NOT NULL DEFAULT 0,
      "newItems" INTEGER NOT NULL DEFAULT 0,
      "restockItems" INTEGER NOT NULL DEFAULT 0,
      "totalUnits" INTEGER NOT NULL DEFAULT 0,
      "totalCostSinIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalCostConIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalSaleEstimated" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "rawItemsJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PecadoPurchase_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "PecadoPurchase_date_idx" ON "PecadoPurchase"("date")`,
    `CREATE TABLE IF NOT EXISTS "PecadoSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PecadoSetting_pkey" PRIMARY KEY ("key")
    )`,
  ];

  try {
    for (const sql of DDL_STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    tablesEnsured = true;
    console.log("[PostgreSQL] Tablas verificadas e inicializadas en la base de datos.");
  } catch (initErr) {
    console.warn("[PostgreSQL] ensureTablesExist aviso:", initErr);
  }
}

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" };

// Campos de producto visibles para el público (sin costos, márgenes ni notas internas)
function toPublicProduct(p: Product) {
  const tc = precioPublicoTC(p.precioEfectivo ?? 0);
  return {
    id: p.id,
    sku: p.sku,
    tipo: p.tipo,
    category: p.category,
    title: p.title,
    description: p.description,
    price: tc,
    precioTarjeta: tc,
    stock: p.stock,
    image: p.image,
  };
}

// GET /api/productos
// Público: sólo catálogo con precios de venta. Administrador (cookie de sesión): estado comercial completo.
export async function GET(request: Request) {
  if (isAdminRequest(request)) {
    // Catálogo inicial (para "restablecer catálogo" y restaurar respaldos) — sólo admin
    if (new URL(request.url).searchParams.get("initial") === "1") {
      return NextResponse.json(
        { products: INITIAL_PRODUCTS, resellers: INITIAL_RESELLERS },
        { headers: NO_STORE }
      );
    }
    return getFullState();
  }

  const full = await getFullState();

  let data: any = {};
  try {
    data = await full.json();
  } catch {}
  return NextResponse.json(
    {
      products: Array.isArray(data.products)
        ? data.products.filter((p: Product) => isProductComplete(p)).map(toPublicProduct)
        : [],
      sales: [],
      resellers: [],
      consignments: [],
      purchases: [],
      whatsappNumber: data.whatsappNumber,
      updatedAt: data.updatedAt,
    },
    { headers: NO_STORE }
  );
}

// Lee de la base de datos PostgreSQL real (Prisma) con sincronización bidireccional
async function getFullState() {
  const hasPostgres = isPostgresConfigured();

  if (hasPostgres) {
    try {
      await ensureTablesExist();
      // 1. Obtener productos de PostgreSQL
      let dbProducts = await prisma.pecadoProduct.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
      });

      // Si la base de datos está vacía o sólo contiene el producto de prueba 'PEC-001':
      if (dbProducts.length === 0 || (dbProducts.length === 1 && dbProducts[0].sku === "PEC-001")) {
        console.log("[PostgreSQL] Sembrando los 30 productos oficiales importados...");
        await prisma.pecadoProduct.deleteMany({ where: { sku: "PEC-001" } });
        for (const p of INITIAL_PRODUCTS) {
          await prisma.pecadoProduct.upsert({
            where: { sku: p.sku },
            update: {
              tipo: p.tipo || p.category || "Conjunto de lencería",
              category: p.category || "Conjunto de lencería",
              title: p.title,
              description: p.description || "",
              costoSinIva: p.costoSinIva || 0,
              costoConIva: p.costoConIva || p.costPrice || 0,
              multiplicadorGanancia: p.multiplicadorGanancia || 2.0,
              gananciaSugerida: p.gananciaSugerida || 0,
              precioEfectivo: p.precioEfectivo || p.price || 0,
              precioTarjeta: p.precioTarjeta || 0,
              precioFinalProveedor: p.precioFinalProveedor || 0,
              stock: p.stock || 0,
              minStock: p.minStock ?? 1,
              observaciones: p.observaciones || "",
              image: p.image || "/pecados/auriculares.jpg",
              active: true,
            },
            create: {
              sku: p.sku,
              tipo: p.tipo || p.category || "Conjunto de lencería",
              category: p.category || "Conjunto de lencería",
              title: p.title,
              description: p.description || "",
              costoSinIva: p.costoSinIva || 0,
              costoConIva: p.costoConIva || p.costPrice || 0,
              multiplicadorGanancia: p.multiplicadorGanancia || 2.0,
              gananciaSugerida: p.gananciaSugerida || 0,
              precioEfectivo: p.precioEfectivo || p.price || 0,
              precioTarjeta: p.precioTarjeta || 0,
              precioFinalProveedor: p.precioFinalProveedor || 0,
              stock: p.stock || 0,
              minStock: p.minStock ?? 1,
              observaciones: p.observaciones || "",
              image: p.image || "/pecados/auriculares.jpg",
              active: true,
            },
          });
        }
        dbProducts = await prisma.pecadoProduct.findMany({
          where: { active: true },
          orderBy: { createdAt: "desc" },
        });
      }

      // 2. Obtener revendedores de PostgreSQL
      let dbResellers = await prisma.pecadoReseller.findMany({
        orderBy: { createdAt: "desc" },
      });

      if (dbResellers.length === 0) {
        for (const r of INITIAL_RESELLERS) {
          await prisma.pecadoReseller.create({
            data: {
              name: r.name,
              phone: r.phone || "",
              zone: r.zone || "",
              commissionPercent: r.commissionPercent || 15,
              notes: r.notes || "",
            },
          });
        }
        dbResellers = await prisma.pecadoReseller.findMany({
          orderBy: { createdAt: "desc" },
        });
      }

      // 3. Obtener ventas con sus ítems
      const dbSales = await prisma.pecadoSale.findMany({
        include: { items: true },
        orderBy: { date: "desc" },
      });

      // 4. Obtener consignaciones
      const dbConsignments = await prisma.pecadoConsignment.findMany({
        orderBy: { date: "desc" },
      });

      // Mapear a tipos de la aplicación
      const formattedProducts: Product[] = dbProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        tipo: p.tipo,
        category: p.category,
        title: p.title,
        description: p.description,
        costoSinIva: p.costoSinIva,
        costoConIva: p.costoConIva,
        costPrice: p.costoConIva,
        multiplicadorGanancia: p.multiplicadorGanancia,
        gananciaSugerida: p.gananciaSugerida,
        precioEfectivo: p.precioEfectivo,
        price: p.precioEfectivo,
        precioTarjeta: p.precioTarjeta,
        precioFinalProveedor: p.precioFinalProveedor,
        stock: p.stock,
        minStock: p.minStock,
        observaciones: p.observaciones,
        image: p.image,
      }));

      const formattedResellers: Reseller[] = dbResellers.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        zone: r.zone,
        commissionPercent: r.commissionPercent,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      }));

      const formattedSales: Sale[] = dbSales.map((s) => ({
        id: s.id,
        date: s.date.toISOString(),
        buyerName: s.buyerName,
        buyerPhone: s.buyerPhone,
        channel: s.channel as any,
        resellerId: s.resellerId || undefined,
        resellerName: s.resellerName || undefined,
        totalAmount: s.totalAmount,
        paymentMethod: s.paymentMethod as any,
        status: s.status as any,
        notes: s.notes,
        items: s.items.map((i) => ({
          productId: i.productId || "",
          productSku: i.productSku,
          productTitle: i.productTitle,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        })),
      }));

      const formattedConsignments: Consignment[] = dbConsignments.map((c) => ({
        id: c.id,
        resellerId: c.resellerId,
        resellerName: c.resellerName,
        date: c.date.toISOString(),
        productId: c.productId,
        productSku: c.productSku,
        productTitle: c.productTitle,
        quantityGiven: c.quantityGiven,
        unitAgreedPrice: c.unitAgreedPrice,
        quantitySold: c.quantitySold,
        quantityReturned: c.quantityReturned,
        status: c.status as any,
        notes: c.notes,
      }));

      // 5. Obtener historial de compras / importaciones de proveedores
      let dbPurchases: any[] = [];
      try {
        dbPurchases = await prisma.$queryRawUnsafe<any[]>(
          `SELECT "id", "fileName", "date", "source", "notes", "totalItems", "newItems", "restockItems", "totalUnits", "totalCostSinIva", "totalCostConIva", "totalSaleEstimated", "rawItemsJson" FROM "PecadoPurchase" ORDER BY "date" DESC`
        );
      } catch (pErr) {
        console.warn("[PostgreSQL] Error consultando PecadoPurchase:", pErr);
      }

      if (dbPurchases.length === 0 && INITIAL_PURCHASES.length > 0) {
        // Sembrar automáticamente la compra inicial oficial de ExportdelPedido.xlsx
        const init = INITIAL_PURCHASES[0];
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "PecadoPurchase" ("id", "fileName", "date", "source", "notes", "totalItems", "newItems", "restockItems", "totalUnits", "totalCostSinIva", "totalCostConIva", "totalSaleEstimated", "rawItemsJson")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT ("id") DO NOTHING`,
            init.id,
            init.fileName,
            new Date(init.date),
            init.source,
            init.notes || "",
            init.totalItems,
            init.newItems,
            init.restockItems,
            init.totalUnits,
            init.totalCostSinIva,
            init.totalCostConIva,
            init.totalSaleEstimated,
            JSON.stringify(init.items)
          );
          dbPurchases = [init];
        } catch (seedErr) {
          console.warn("[PostgreSQL] Error sembrando compra inicial:", seedErr);
        }
      }

      const formattedPurchases: PurchaseRecord[] = dbPurchases.map((p) => {
        let items = [];
        try {
          items = typeof p.rawItemsJson === "string" ? JSON.parse(p.rawItemsJson) : (p.rawItemsJson || []);
        } catch {
          items = [];
        }
        return {
          id: p.id,
          fileName: p.fileName || "Compra Excel",
          date: p.date instanceof Date ? p.date.toISOString() : String(p.date),
          source: (p.source as any) || "excel_import",
          notes: p.notes || "",
          totalItems: Number(p.totalItems || 0),
          newItems: Number(p.newItems || 0),
          restockItems: Number(p.restockItems || 0),
          totalUnits: Number(p.totalUnits || 0),
          totalCostSinIva: Number(p.totalCostSinIva || 0),
          totalCostConIva: Number(p.totalCostConIva || 0),
          totalSaleEstimated: Number(p.totalSaleEstimated || 0),
          items,
        };
      });

      // 6. Obtener configuraciones de la tienda desde PostgreSQL
      try {
        const dbSettings = await prisma.$queryRawUnsafe<any[]>(
          `SELECT "key", "value" FROM "PecadoSetting" WHERE "key" = 'whatsappNumber' LIMIT 1`
        );
        if (dbSettings && dbSettings.length > 0 && dbSettings[0].value) {
          memoryWhatsappNumber = dbSettings[0].value;
        }
      } catch (sErr) {
        console.warn("[PostgreSQL] Error consultando PecadoSetting:", sErr);
      }

      // Actualizar memoria de respaldo
      memoryProducts = formattedProducts;
      memorySales = formattedSales;
      memoryResellers = formattedResellers;
      memoryConsignments = formattedConsignments;
      memoryPurchases = formattedPurchases.length > 0 ? formattedPurchases : [...INITIAL_PURCHASES];
      serverUpdatedAt = new Date().toISOString();

      return NextResponse.json(
        {
          products: formattedProducts,
          sales: formattedSales,
          resellers: formattedResellers,
          consignments: formattedConsignments,
          purchases: memoryPurchases,
          whatsappNumber: memoryWhatsappNumber,
          updatedAt: serverUpdatedAt,
          isDefaultSeed: false,
          source: "postgresql_prisma",
          hasCloudStorage: true,
          dbStatus: "connected",
          dbEngine: "PostgreSQL (Prisma ORM)",
          dbDetails: "Conexión activa con PostgreSQL (Prisma). Datos comerciales y stock sincronizados y persistentes en la nube.",
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    } catch (dbError: any) {
      console.error("[Prisma PostgreSQL] Error consultando la base de datos:", dbError);
      return NextResponse.json(
        {
          products: memoryProducts,
          sales: memorySales,
          resellers: memoryResellers,
          consignments: memoryConsignments,
          purchases: memoryPurchases,
          whatsappNumber: memoryWhatsappNumber,
          updatedAt: serverUpdatedAt,
          isDefaultSeed: false,
          source: "fallback_memory",
          hasCloudStorage: true,
          dbStatus: "error_connecting",
          dbEngine: "PostgreSQL (Error conexión)",
          dbDetails: "DATABASE_URL está configurada pero falló la conexión con PostgreSQL. Revisá los logs del servidor.",
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }
  }

  // Fallback: Memoria del servidor o local
  return NextResponse.json(
    {
      products: memoryProducts,
      sales: memorySales,
      resellers: memoryResellers,
      consignments: memoryConsignments,
      purchases: memoryPurchases,
      whatsappNumber: memoryWhatsappNumber,
      updatedAt: serverUpdatedAt,
      isDefaultSeed: serverUpdatedAt === null && !hasPostgres,
      source: hasPostgres ? "fallback_memory" : "server_memory",
      hasCloudStorage: hasPostgres,
      dbStatus: hasPostgres ? "error_connecting" : "pending_database_url",
      dbEngine: hasPostgres ? "PostgreSQL (Error conexión)" : "Memoria / Pendiente DATABASE_URL",
      dbDetails: hasPostgres
        ? "La variable DATABASE_URL existe pero el servidor de base de datos no respondió."
        : "Falta configurar la variable DATABASE_URL en el panel de Vercel (Pestaña 'Storage' -> Create Postgres o en 'Settings' -> 'Environment Variables'). Mientras tanto, la tienda funciona con respaldo en memoria protegida.",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

// POST /api/pecados/productos
// Guarda y sincroniza productos, ventas, revendedores y consignaciones en PostgreSQL
export async function POST(request: Request) {
  try {
    // Validación de seguridad: sólo el administrador con sesión válida puede publicar
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (!isSameOriginJson(request)) {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }

    const body = await request.json();
    const { products, sales, resellers, consignments, purchases, whatsappNumber } = body;

    const hasPostgres = isPostgresConfigured();
    let postgresSaved = false;

    if (hasPostgres) {
      try {
        await ensureTablesExist();
        // 1. Guardar/Actualizar productos en PostgreSQL
        if (products && Array.isArray(products)) {
          for (const p of products) {
            const cleanSku = p.sku ? p.sku.trim().toUpperCase() : `PEC-${Date.now().toString().slice(-4)}`;
            const pricing = normalizePricing(p);
            // Fotos subidas desde el panel (data URI) se guardan en la tabla de imágenes
            let image = typeof p.image === "string" ? p.image : "";
            if (image.startsWith("data:image/") && (await saveDataUriImage(cleanSku, image))) {
              image = productImageUrl(cleanSku);
            }
            // Las fotos se sirven desde la base (tabla de imágenes); las rutas locales viejas o el
            // placeholder no pueden pisarla (p. ej. un panel abierto con datos anteriores)
            if (!image || image.includes("auriculares") || image.startsWith("/pecados/products/")) {
              image = productImageUrl(cleanSku);
            }
            await prisma.pecadoProduct.upsert({
              where: { sku: cleanSku },
              update: {
                tipo: p.tipo || p.category || "Conjunto de lencería",
                category: p.category || p.tipo || "Conjunto de lencería",
                title: p.title,
                description: p.description || "",
                ...pricing,
                precioFinalProveedor: p.precioFinalProveedor || 0,
                stock: p.stock ?? 0,
                minStock: p.minStock ?? 2,
                observaciones: p.observaciones || "",
                image,
                active: true,
              },
              create: {
                sku: cleanSku,
                tipo: p.tipo || p.category || "Conjunto de lencería",
                category: p.category || p.tipo || "Conjunto de lencería",
                title: p.title,
                description: p.description || "",
                ...pricing,
                precioFinalProveedor: p.precioFinalProveedor || 0,
                stock: p.stock ?? 0,
                minStock: p.minStock ?? 2,
                observaciones: p.observaciones || "",
                image,
                active: true,
              },
            });
          }
        }

        // 2. Guardar revendedores
        if (resellers && Array.isArray(resellers)) {
          for (const r of resellers) {
            await prisma.pecadoReseller.upsert({
              where: { id: r.id },
              update: {
                name: r.name,
                phone: r.phone || "",
                zone: r.zone || "",
                commissionPercent: r.commissionPercent || 15,
                notes: r.notes || "",
              },
              create: {
                id: r.id,
                name: r.name,
                phone: r.phone || "",
                zone: r.zone || "",
                commissionPercent: r.commissionPercent || 15,
                notes: r.notes || "",
              },
            });
          }
        }

        // 3. Guardar consignaciones
        if (consignments && Array.isArray(consignments)) {
          for (const c of consignments) {
            await prisma.pecadoConsignment.upsert({
              where: { id: c.id },
              update: {
                quantitySold: c.quantitySold || 0,
                quantityReturned: c.quantityReturned || 0,
                status: c.status || "active",
                notes: c.notes || "",
              },
              create: {
                id: c.id,
                resellerId: c.resellerId,
                resellerName: c.resellerName,
                productId: c.productId,
                productSku: c.productSku || "S/C",
                productTitle: c.productTitle,
                quantityGiven: c.quantityGiven || 0,
                unitAgreedPrice: c.unitAgreedPrice || 0,
                quantitySold: c.quantitySold || 0,
                quantityReturned: c.quantityReturned || 0,
                status: c.status || "active",
                notes: c.notes || "",
              },
            });
          }
        }

        // 4. Guardar ventas e ítems
        if (sales && Array.isArray(sales)) {
          for (const s of sales) {
            const existing = await prisma.pecadoSale.findUnique({ where: { id: s.id } });
            if (!existing) {
              await prisma.pecadoSale.create({
                data: {
                  id: s.id,
                  date: new Date(s.date),
                  buyerName: s.buyerName || "Cliente",
                  buyerPhone: s.buyerPhone || "",
                  channel: s.channel || "direct_sale",
                  resellerId: s.resellerId || null,
                  resellerName: s.resellerName || null,
                  totalAmount: s.totalAmount || 0,
                  paymentMethod: s.paymentMethod || "efectivo",
                  status: s.status || "completed",
                  notes: s.notes || "",
                  items: {
                    create: (s.items || []).map((i: any) => ({
                      productId: i.productId || null,
                      productSku: i.productSku || "S/C",
                      productTitle: i.productTitle,
                      quantity: i.quantity,
                      unitPrice: i.unitPrice,
                      subtotal: i.subtotal,
                    })),
                  },
                },
              });
            }
          }
        }

        // 5. Guardar historial de compras / importaciones en PostgreSQL
        if (purchases && Array.isArray(purchases)) {
          for (const pc of purchases) {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "PecadoPurchase" ("id", "fileName", "date", "source", "notes", "totalItems", "newItems", "restockItems", "totalUnits", "totalCostSinIva", "totalCostConIva", "totalSaleEstimated", "rawItemsJson")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT ("id") DO UPDATE SET
                 "fileName" = EXCLUDED."fileName",
                 "notes" = EXCLUDED."notes",
                 "totalItems" = EXCLUDED."totalItems",
                 "newItems" = EXCLUDED."newItems",
                 "restockItems" = EXCLUDED."restockItems",
                 "totalUnits" = EXCLUDED."totalUnits",
                 "totalCostSinIva" = EXCLUDED."totalCostSinIva",
                 "totalCostConIva" = EXCLUDED."totalCostConIva",
                 "totalSaleEstimated" = EXCLUDED."totalSaleEstimated",
                 "rawItemsJson" = EXCLUDED."rawItemsJson"`,
              pc.id,
              pc.fileName || "Compra Excel",
              new Date(pc.date),
              pc.source || "excel_import",
              pc.notes || "",
              pc.totalItems || 0,
              pc.newItems || 0,
              pc.restockItems || 0,
              pc.totalUnits || 0,
              pc.totalCostSinIva || 0,
              pc.totalCostConIva || 0,
              pc.totalSaleEstimated || 0,
              JSON.stringify(pc.items || [])
            );
          }
        }

        // 6. Guardar WhatsApp en PostgreSQL
        if (whatsappNumber && typeof whatsappNumber === "string" && /^[0-9]{8,15}$/.test(whatsappNumber)) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "PecadoSetting" ("key", "value", "updatedAt")
             VALUES ('whatsappNumber', $1, CURRENT_TIMESTAMP)
             ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
            whatsappNumber
          );
          memoryWhatsappNumber = whatsappNumber;
        }

        postgresSaved = true;
      } catch (err) {
        console.error("[Prisma PostgreSQL] Error guardando en base de datos:", err);
      }
    }

    // Actualizar copia en memoria
    if (products && Array.isArray(products)) memoryProducts = products;
    if (sales && Array.isArray(sales)) memorySales = sales;
    if (resellers && Array.isArray(resellers)) memoryResellers = resellers;
    if (consignments && Array.isArray(consignments)) memoryConsignments = consignments;
    if (purchases && Array.isArray(purchases)) memoryPurchases = purchases;
    if (whatsappNumber && typeof whatsappNumber === "string" && /^[0-9]{8,15}$/.test(whatsappNumber)) memoryWhatsappNumber = whatsappNumber;
    serverUpdatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      productsCount: memoryProducts.length,
      salesCount: memorySales.length,
      resellersCount: memoryResellers.length,
      consignmentsCount: memoryConsignments.length,
      purchasesCount: memoryPurchases.length,
      whatsappNumber: memoryWhatsappNumber,
      updatedAt: serverUpdatedAt,
      postgresSaved,
      cloudSaved: postgresSaved,
      hasPostgres,
      source: postgresSaved ? "postgresql_prisma" : hasPostgres ? "fallback_memory" : "server_memory",
      message: postgresSaved
        ? "Datos sincronizados permanentemente en la base de datos PostgreSQL."
        : hasPostgres
        ? "Base de datos configurada pero hubo un error de conexión; datos guardados en memoria."
        : "Datos guardados en memoria del servidor (Pendiente configurar DATABASE_URL de PostgreSQL).",
    });
  } catch (error) {
    console.error("[API Pecados] Error en POST:", error);
    return NextResponse.json(
      { error: "Error interno procesando los datos comerciales." },
      { status: 500 }
    );
  }
}

// DELETE /api/productos  { id }
// Baja lógica del producto (active=false): desaparece del catálogo y del panel,
// pero se conserva para el historial de ventas. Si se vuelve a cargar el mismo SKU, se reactiva.
export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  let id: unknown;
  try {
    ({ id } = await request.json());
  } catch {}
  if (typeof id !== "string" || !id || id.length > 64) {
    return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
  }

  if (isPostgresConfigured()) {
    try {
      const res = await prisma.pecadoProduct.updateMany({ where: { id, active: true }, data: { active: false } });
      if (res.count === 0) {
        return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
      }
    } catch (err) {
      console.error("[Prisma PostgreSQL] Error eliminando producto:", err);
      return NextResponse.json({ error: "No se pudo eliminar el producto." }, { status: 500 });
    }
  }

  memoryProducts = memoryProducts.filter((p) => p.id !== id);
  return NextResponse.json({ success: true, id });
}
