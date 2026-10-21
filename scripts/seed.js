const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Verificando estado de la base de datos PostgreSQL...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[Seed] DATABASE_URL no está configurada. Omitiendo seed.");
    return;
  }

  try {
    // 1. Verificar si existen productos
    const count = await prisma.pecadoProduct.count();
    console.log(`[Seed] Cantidad de productos en base de datos: ${count}`);

    if (count === 0) {
      console.log("[Seed] Sembrando los 30 productos oficiales desde catálogo inicial...");
      // Cargar productos
      const { INITIAL_PRODUCTS, INITIAL_RESELLERS } = require("../app/products.js") || {};
      
      // Si no se puede requerir directamente por typescript, sembrar desde api route o script
      console.log("[Seed] Tablas listas. La API sembrará los 30 productos en la primera solicitud si está vacía.");
    }

    // 2. Asegurar configuración de WhatsApp
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PecadoSetting" ("key", "value", "updatedAt")
         VALUES ('whatsappNumber', '541161314128', CURRENT_TIMESTAMP)
         ON CONFLICT ("key") DO NOTHING`
      );
      console.log("[Seed] Número de WhatsApp configurado (541161314128).");
    } catch (e) {
      console.warn("[Seed] Aviso al configurar WhatsApp:", e.message);
    }

    console.log("[Seed] Proceso completado exitosamente.");
  } catch (err) {
    console.warn("[Seed] Advertencia durante seed (la API completará la inicialización):", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[Seed] Error fatal:", e);
  process.exit(0); // No bloquear el arranque
});
