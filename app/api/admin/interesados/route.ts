import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";

const NO_STORE = { "Cache-Control": "no-store" };
const STATUSES = ["pending", "ordered", "closed"];

// GET /api/admin/interesados
// Interesados abiertos (pendientes y en pedido) + los últimos 100 cerrados.
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const [open, closed] = await Promise.all([
    prisma.pecadoInterest.findMany({
      where: { status: { in: ["pending", "ordered"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pecadoInterest.findMany({
      where: { status: "closed" },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const interests = [...open, ...closed].map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }));
  return NextResponse.json({ interests }, { headers: NO_STORE });
}

// PATCH /api/admin/interesados  { skus?: string[], ids?: string[], status }
// Cambia el estado de los interesados (todos los abiertos de un producto, o individuales).
export async function PATCH(request: Request) {
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

  const status = body?.status;
  const isStrList = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length > 0 && v.length <= 500 && v.every((x) => typeof x === "string" && x.length <= 64);
  if (!STATUSES.includes(status) || (!isStrList(body?.skus) && !isStrList(body?.ids))) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const where = isStrList(body.ids)
    ? { id: { in: body.ids as string[] } }
    : { productSku: { in: (body.skus as string[]).map((s) => s.toUpperCase()) }, status: { not: "closed" } };

  const res = await prisma.pecadoInterest.updateMany({ where, data: { status } });
  return NextResponse.json({ success: true, updated: res.count });
}
