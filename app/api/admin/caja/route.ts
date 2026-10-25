import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";

const NO_STORE = { "Cache-Control": "no-store" };

function deny(request: Request, json = true) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (json && !isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  return null;
}

// GET /api/admin/caja — registros manuales de caja (sólo admin)
export async function GET(request: Request) {
  const denied = deny(request, false);
  if (denied) return denied;
  const entries = await prisma.pecadoCashEntry.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json(
    { entries: entries.map((e) => ({ ...e, date: e.date.toISOString(), createdAt: e.createdAt.toISOString() })) },
    { headers: NO_STORE }
  );
}

// POST /api/admin/caja  { date: "AAAA-MM-DD", side: "debe" | "haber", category, description, amount }
// Alta de un registro manual (ej: compra de perchas o un posnet, aporte de capital)
export async function POST(request: Request) {
  const denied = deny(request);
  if (denied) return denied;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const side = body?.side === "debe" || body?.side === "haber" ? body.side : "";
  const category = typeof body?.category === "string" ? body.category.trim().slice(0, 60) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 300) : "";
  const amount = Math.round(Number(body?.amount) * 100) / 100;
  const m = typeof body?.date === "string" ? body.date.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  // Mediodía local: la fecha no cambia de día por la zona horaria
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;

  if (!side) return NextResponse.json({ error: "Elegí si es Debe (entra) o Haber (sale)." }, { status: 400 });
  if (!category) return NextResponse.json({ error: "Elegí o escribí una categoría." }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Escribí una descripción." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10) {
    return NextResponse.json({ error: "Ingresá un monto mayor a 0." }, { status: 400 });
  }
  if (!date || Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86400000) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }
  const entry = await prisma.pecadoCashEntry.create({ data: { side, category, description, amount, date } });
  return NextResponse.json({ success: true, id: entry.id });
}

// DELETE /api/admin/caja  { id } — borra un registro manual
export async function DELETE(request: Request) {
  const denied = deny(request);
  if (denied) return denied;
  let id = "";
  try {
    id = (await request.json())?.id || "";
  } catch {}
  if (typeof id !== "string" || !id || id.length > 64) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const res = await prisma.pecadoCashEntry.deleteMany({ where: { id } });
  if (res.count === 0) return NextResponse.json({ error: "El registro ya no existe." }, { status: 404 });
  return NextResponse.json({ success: true });
}
