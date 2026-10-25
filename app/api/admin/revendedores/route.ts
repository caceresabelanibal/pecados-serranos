import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { RESELLER_CODE_PATTERN, RESELLER_USERNAME_PATTERN, normalizeResellerCode } from "@/lib/reseller-auth";

async function guard(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  return null;
}

interface AccessInput {
  code: string;
  username: string;
  password: string;
}

// Valida código, usuario y contraseña (alta o edición). Devuelve el error o null si está todo bien.
async function checkAccess(input: AccessInput, opts: { id?: string; hasPassword: boolean }): Promise<NextResponse | null> {
  const { code, username, password } = input;
  if (code && !RESELLER_CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "El código debe tener entre 2 y 20 letras, números, guion o guion bajo (ej: MARU10)." }, { status: 400 });
  }
  if (username && !RESELLER_USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo." }, { status: 400 });
  }
  if (password && (password.length < 8 || password.length > 128)) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (username && !password && !opts.hasPassword) {
    return NextResponse.json({ error: "Asigná una contraseña para habilitar el acceso." }, { status: 400 });
  }
  const notSelf = opts.id ? { NOT: { id: opts.id } } : {};
  if (code) {
    const other = await prisma.pecadoReseller.findFirst({ where: { code, ...notSelf }, select: { name: true, active: true } });
    if (other) {
      return NextResponse.json({ error: `El código ${code} ya lo usa ${other.active ? other.name : "un revendedor dado de baja"}.` }, { status: 409 });
    }
  }
  if (username) {
    const other = await prisma.pecadoReseller.findFirst({ where: { username, ...notSelf }, select: { id: true } });
    if (other) return NextResponse.json({ error: `El usuario "${username}" ya está en uso.` }, { status: 409 });
  }
  return null;
}

function readAccess(body: any): AccessInput {
  return {
    code: normalizeResellerCode(body?.code),
    username: typeof body?.username === "string" ? body.username.trim().toLowerCase() : "",
    password: typeof body?.password === "string" ? body.password : "",
  };
}

// Choque con un alta simultánea (código o usuario son únicos en la base)
function isUniqueError(err: any) {
  return err?.code === "P2002";
}

// POST /api/admin/revendedores  { name, phone, zone, notes, code, username, password }
// Sólo admin: alta de revendedora en un solo paso. Si algún dato no es válido no se crea nada
// (así un reintento no genera revendedoras duplicadas).
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Ingresá el nombre del revendedor." }, { status: 400 });
  const access = readAccess(body);
  const invalid = await checkAccess(access, { hasPassword: false });
  if (invalid) return invalid;
  const sameName = await prisma.pecadoReseller.findFirst({
    where: { active: true, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (sameName) return NextResponse.json({ error: `Ya existe un revendedor activo llamado "${name}".` }, { status: 409 });

  try {
    const r = await prisma.pecadoReseller.create({
      data: {
        name,
        phone: typeof body?.phone === "string" ? body.phone.replace(/[^0-9]/g, "").slice(0, 20) : "",
        zone: (typeof body?.zone === "string" ? body.zone.trim().slice(0, 80) : "") || "Local",
        notes: typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) : "",
        commissionPercent: 0,
        code: access.code || null,
        username: access.username || null,
        passwordHash: access.username && access.password ? hashPassword(access.password) : null,
      },
    });
    return NextResponse.json({ success: true, id: r.id });
  } catch (err: any) {
    if (isUniqueError(err)) return NextResponse.json({ error: "El código o el usuario ya están en uso." }, { status: 409 });
    console.error("[Revendedores] Error en el alta:", err);
    return NextResponse.json({ error: "No se pudo dar de alta al revendedor." }, { status: 500 });
  }
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
  const access = readAccess(body);

  const reseller = id ? await prisma.pecadoReseller.findUnique({ where: { id } }) : null;
  if (!reseller || !reseller.active) {
    return NextResponse.json({ error: "Revendedor no encontrado." }, { status: 404 });
  }
  const invalid = await checkAccess(access, { id, hasPassword: Boolean(reseller.passwordHash) });
  if (invalid) return invalid;

  try {
    await prisma.pecadoReseller.update({
      where: { id },
      data: {
        code: access.code || null,
        username: access.username || null,
        // Sin usuario no hay acceso: se borra también la contraseña
        passwordHash: !access.username ? null : access.password ? hashPassword(access.password) : reseller.passwordHash,
      },
    });
  } catch (err: any) {
    if (isUniqueError(err)) return NextResponse.json({ error: "El código o el usuario ya están en uso." }, { status: 409 });
    throw err;
  }
  return NextResponse.json({ success: true, code: access.code || null, username: access.username || null, hasPassword: Boolean(access.username) });
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
