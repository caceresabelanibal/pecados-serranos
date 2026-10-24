import { NextResponse } from "next/server";
import { isAdminRequest, isSameOriginJson } from "@/lib/auth";
import { TOKEN_PATTERN, fetchMpAccount, getMpStatus, saveMpConfig } from "@/lib/mercadopago";

const NO_STORE = { "Cache-Control": "no-store" };

function deny(request: Request, json = true) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (json && !isSameOriginJson(request)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  return null;
}

// GET /api/admin/mercadopago — estado de la integración (el token se muestra recortado)
export async function GET(request: Request) {
  const denied = deny(request, false);
  if (denied) return denied;
  return NextResponse.json(await getMpStatus(), { headers: NO_STORE });
}

// PUT /api/admin/mercadopago  { accessToken?, enabled? }
// Guarda el Access Token (se valida contra Mercado Pago y se guarda la cuenta a la que cobra)
// y/o activa o pausa el cobro online.
export async function PUT(request: Request) {
  const denied = deny(request);
  if (denied) return denied;
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const token = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  if (token) {
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json({ error: "El Access Token tiene que empezar con APP_USR- (producción) o TEST- (prueba)." }, { status: 400 });
    }
    try {
      const account = await fetchMpAccount(token);
      await saveMpConfig({ token, account, enabled: body?.enabled !== false });
    } catch (err: any) {
      const status = err?.status === 401 || err?.status === 403 ? 400 : 502;
      return NextResponse.json(
        {
          error:
            status === 400
              ? "Mercado Pago rechazó el Access Token. Revisá que esté completo y que sea el de producción."
              : "No se pudo conectar con Mercado Pago. Probá de nuevo en unos minutos.",
        },
        { status }
      );
    }
  } else if (typeof body?.enabled === "boolean") {
    const st = await getMpStatus();
    if (!st.configured) return NextResponse.json({ error: "Primero cargá el Access Token." }, { status: 400 });
    await saveMpConfig({ enabled: body.enabled });
  } else {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  return NextResponse.json(await getMpStatus(), { headers: NO_STORE });
}

// DELETE /api/admin/mercadopago — quita las credenciales (la tienda vuelve a pedidos por WhatsApp)
export async function DELETE(request: Request) {
  const denied = deny(request);
  if (denied) return denied;
  await saveMpConfig({ token: null, account: null, enabled: false });
  return NextResponse.json(await getMpStatus(), { headers: NO_STORE });
}
