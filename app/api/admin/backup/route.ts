import { NextResponse } from "next/server";
import { isAdminRequest, rateLimit } from "@/lib/auth";
import { MAX_BACKUP_BYTES, backupFileName, createBackup, restoreBackup, verifyBackup } from "@/lib/db-backup";

export const runtime = "nodejs";

let restoring = false;

// GET /api/admin/backup — descarga un backup completo y comprimido de la base
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!rateLimit("backup:download", 20, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Demasiados backups seguidos. Probá en un rato." }, { status: 429 });
  }
  try {
    const file = await createBackup();
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${backupFileName()}"`,
        "Content-Length": String(file.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[Backup] Error generando backup:", err?.message, err?.stderr);
    return NextResponse.json({ error: "No se pudo generar el backup." }, { status: 500 });
  }
}

// POST /api/admin/backup — restaura un backup (.psbak generado por esta tienda).
// Reemplaza TODOS los datos. Pide la confirmación escrita en el encabezado x-ps-confirm.
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  // Mismo origen obligatorio (el archivo viaja como binario, no como JSON)
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin) && new URL(origin as string).host === host;
  } catch {}
  if (!sameOrigin || request.headers.get("x-ps-confirm") !== "RESTAURAR") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "El archivo es demasiado grande." }, { status: 413 });
  }
  if (!rateLimit("backup:restore", 5, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Demasiadas restauraciones seguidas. Probá en un rato." }, { status: 429 });
  }
  if (restoring) return NextResponse.json({ error: "Ya hay una restauración en curso." }, { status: 409 });

  restoring = true;
  try {
    const file = Buffer.from(await request.arrayBuffer());
    if (file.length > MAX_BACKUP_BYTES) return NextResponse.json({ error: "El archivo es demasiado grande." }, { status: 413 });
    const checked = await verifyBackup(file);
    if (typeof checked === "string") return NextResponse.json({ error: checked }, { status: 400 });
    await restoreBackup(checked.dump);
    console.log(`[Backup] Base restaurada desde un backup (${file.length} bytes, ${checked.tables} tablas)`);
    return NextResponse.json({ success: true, tables: checked.tables });
  } catch (err: any) {
    console.error("[Backup] Error restaurando:", err?.message, err?.stderr);
    return NextResponse.json(
      { error: "No se pudo restaurar el backup. La base quedó como estaba (no se cambió nada)." },
      { status: 500 }
    );
  } finally {
    restoring = false;
  }
}
