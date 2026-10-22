import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { RESELLER_CODE_PATTERN, RESELLER_USERNAME_PATTERN, normalizeResellerCode } from "@/lib/reseller-auth";

async function guard(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  return null;
}

// PUT /api/admin/revendedores  { id, code, username, password? }
// Sólo admin: código de revendedora y acceso al perfil Asociado.
//  - code / username vacíos: se quitan (sin código / sin acceso).
//  - password vacío: se mantiene la actual. Al cambiarla se cierran sus sesiones abiertas.
export async function PUT(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const id = typeof body?.id === "string" ? body.id : "";
  const code = normalizeResellerCode(body?.code);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const reseller = id ? await prisma.pecadoReseller.findUnique({ where: { id } }) : null;
  if (!reseller || !reseller.active) {
    return NextResponse.json({ error: "Revendedor no encontrado." }, { status: 404 });
  }
  if (code && !RESELLER_CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "El código debe tener entre 2 y 20 letras, números, guion o guion bajo (ej: MARU10)." }, { status: 400 });
  }
  if (username && !RESELLER_USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo." }, { status: 400 });
  }
  if (password && (password.length < 8 || password.length > 128)) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (username && !password && !reseller.passwordHash) {
    return NextResponse.json({ error: "Asigná una contraseña para habilitar el acceso." }, { status: 400 });
  }

  if (code) {
    const other = await prisma.pecadoReseller.findFirst({ where: { code, NOT: { id } }, select: { name: true, active: true } });
    if (other) {
      return NextResponse.json({ error: `El código ${code} ya lo usa ${other.active ? other.name : "un revendedor dado de baja"}.` }, { status: 409 });
    }
  }
  if (username) {
    const other = await prisma.pecadoReseller.findFirst({ where: { username, NOT: { id } }, select: { id: true } });
    if (other) return NextResponse.json({ error: `El usuario "${username}" ya está en uso.` }, { status: 409 });
  }

  await prisma.pecadoReseller.update({
    where: { id },
    data: {
      code: code || null,
      username: username || null,
      // Sin usuario no hay acceso: se borra también la contraseña
      passwordHash: !username ? null : password ? hashPassword(password) : reseller.passwordHash,
    },
  });
  return NextResponse.json({ success: true, code: code || null, username: username || null, hasPassword: Boolean(username) });
}

// DELETE /api/admin/revendedores  { id }
// Baja del revendedor: deja de aparecer, pierde el acceso y su código deja de ser válido.
// Sus ventas y consignaciones anteriores se conservan.
export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  let id = "";
  try {
    id = (await request.json())?.id || "";
  } catch {}
  if (typeof id !== "string" || !id || id.length > 64) {
    return NextResponse.json({ error: "Revendedor inválido." }, { status: 400 });
  }
  const res = await prisma.pecadoReseller.updateMany({
    where: { id, active: true },
    data: { active: false, username: null, passwordHash: null, code: null },
  });
  if (res.count === 0) return NextResponse.json({ error: "Revendedor no encontrado." }, { status: 404 });
  return NextResponse.json({ success: true });
}
