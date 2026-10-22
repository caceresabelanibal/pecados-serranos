import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionReseller } from "@/lib/reseller-auth";
import { isProductComplete, precioPublicoTC } from "@/lib/pricing";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/asociado
// Datos del perfil Asociado: sus datos, SUS ventas y los productos disponibles para vender.
// Sin sesión de asociado: { reseller: null }.
export async function GET(request: Request) {
  const reseller = await getSessionReseller(request);
  if (!reseller) return NextResponse.json({ reseller: null }, { headers: NO_STORE });

  const [sales, products, consignments] = await Promise.all([
    prisma.pecadoSale.findMany({
      where: { resellerId: reseller.id },
      include: { items: true },
      orderBy: { date: "desc" },
    }),
    prisma.pecadoProduct.findMany({ where: { active: true }, orderBy: { title: "asc" } }),
    // Mercadería entregada a ESTA asociada
    prisma.pecadoConsignment.findMany({ where: { resellerId: reseller.id }, orderBy: { date: "desc" } }),
  ]);
  const imageById = new Map(products.map((p) => [p.id, p.image]));

  return NextResponse.json(
    {
      reseller: { id: reseller.id, name: reseller.name, zone: reseller.zone, code: reseller.code },
      sales: sales.map((s) => ({
        id: s.id,
        date: s.date.toISOString(),
        buyerName: s.buyerName,
        buyerPhone: s.buyerPhone,
        channel: s.channel,
        totalAmount: s.totalAmount,
        paymentMethod: s.paymentMethod,
        resellerCode: s.resellerCode,
        notes: s.notes,
        commissionTotal: s.commissionTotal,
        commissionPending: s.commissionPending,
        items: s.items.map((i) => ({
          productTitle: i.productTitle,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
          commissionUnit: i.commissionUnit,
          commission: i.commission,
        })),
      })),
      consignments: consignments.map((c) => ({
        id: c.id,
        date: c.date.toISOString(),
        productId: c.productId,
        productTitle: c.productTitle,
        image: imageById.get(c.productId) || "",
        quantityGiven: c.quantityGiven,
        quantitySold: c.quantitySold,
        quantityReturned: c.quantityReturned,
        pending: Math.max(0, c.quantityGiven - c.quantitySold - c.quantityReturned),
        unitAgreedPrice: c.unitAgreedPrice,
        commissionPerUnit: c.commissionPerUnit,
        status: c.status,
        notes: c.notes,
      })),
      // Sólo lo necesario para vender (sin costos ni márgenes)
      products: products
        .filter((p) => isProductComplete(p))
        .map((p) => ({
          id: p.id,
          title: p.title,
          stock: p.stock,
          image: p.image,
          precioFT: p.precioEfectivo,
          precioTC: precioPublicoTC(p.precioEfectivo),
        })),
    },
    { headers: NO_STORE }
  );
}
