import { spawn } from "node:child_process";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// -------------------------------------------------------------
// Backup completo de la base (pg_dump, formato comprimido de PostgreSQL)
// El archivo lleva una firma (HMAC con SESSION_SECRET): sólo se pueden restaurar
// backups generados por esta misma tienda, nunca un archivo armado por otro.
//   Archivo: "PSBAK1\n" + firma hex (64) + "\n" + volcado pg_dump -Fc
// -------------------------------------------------------------

const MAGIC = "PSBAK1\n";
const HEADER_LEN = MAGIC.length + 64 + 1;
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

// Tipos de objetos que puede traer un backup de la tienda (cualquier otra cosa se rechaza)
const ALLOWED_TOC = new Set([
  "TABLE",
  "TABLE DATA",
  "INDEX",
  "CONSTRAINT",
  "FK CONSTRAINT",
  "SEQUENCE",
  "SEQUENCE SET",
  "SEQUENCE OWNED BY",
  "DEFAULT",
]);

// libpq no acepta el parámetro ?schema= que usa Prisma
function dbUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("NO_DATABASE");
  const u = new URL(raw);
  u.search = "";
  return u.toString();
}

function sign(data: Buffer): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("NO_SECRET");
  return createHmac("sha256", secret).update("pecados-backup").update(data).digest("hex");
}

function run(cmd: string, args: string[], opts: { input?: Buffer; maxBytes?: number } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let size = 0;
    let err = "";
    child.stdout.on("data", (d: Buffer) => {
      size += d.length;
      if (opts.maxBytes && size > opts.maxBytes) child.kill("SIGKILL");
      else out.push(d);
    });
    child.stderr.on("data", (d: Buffer) => {
      err = (err + d.toString()).slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(Object.assign(new Error(`${cmd} terminó con código ${code}`), { stderr: err.slice(-2000) }));
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

export async function createBackup(): Promise<Buffer> {
  const dump = await run("pg_dump", ["-Fc", "-Z6", "--no-owner", "--no-privileges", "-d", dbUrl()], { maxBytes: MAX_BACKUP_BYTES });
  return Buffer.concat([Buffer.from(MAGIC), Buffer.from(sign(dump)), Buffer.from("\n"), dump]);
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `pecados_backup_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.psbak`;
}

// Verifica la firma y el contenido; devuelve el volcado listo para pg_restore o un mensaje de error
export async function verifyBackup(file: Buffer): Promise<{ dump: Buffer; tables: number } | string> {
  if (file.length < HEADER_LEN + 5 || file.subarray(0, MAGIC.length).toString() !== MAGIC) {
    return "El archivo no es un backup de la tienda (.psbak).";
  }
  const sig = file.subarray(MAGIC.length, MAGIC.length + 64).toString();
  const dump = file.subarray(HEADER_LEN);
  const expected = sign(dump);
  if (sig.length !== 64 || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return "El backup está dañado o no fue generado por esta tienda: no se puede restaurar.";
  }
  if (dump.subarray(0, 5).toString() !== "PGDMP") return "El backup está dañado.";

  // Lista de objetos del backup: sólo tablas de la tienda, datos e índices
  const list = (await run("pg_restore", ["--list"], { input: dump })).toString();
  let tables = 0;
  let hasProducts = false;
  for (const line of list.split("\n")) {
    if (!line.trim() || line.startsWith(";")) continue;
    // Formato: "<id>; <oid> <oid> <TIPO> <schema> <nombre> <owner>"
    const m = line.match(/^\d+;\s+\d+\s+\d+\s+(.+?)\s+(public|-)\s+(\S+)/);
    const type = m?.[1];
    if (!type || !ALLOWED_TOC.has(type)) return `El backup trae objetos no permitidos (${type || "desconocido"}).`;
    if (type === "TABLE") tables++;
    if (type === "TABLE" && m?.[3].replace(/"/g, "") === "PecadoProduct") hasProducts = true;
  }
  if (!hasProducts) return "El backup no tiene los datos de la tienda.";
  return { dump, tables };
}

// Reemplaza TODA la base por el backup, en una sola transacción: si algo falla, no cambia nada.
export async function restoreBackup(dump: Buffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ps-restore-"));
  const file = path.join(dir, `${randomBytes(8).toString("hex")}.dump`);
  try {
    await fs.writeFile(file, dump, { mode: 0o600 });
    await run("pg_restore", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--single-transaction",
      "--exit-on-error",
      "-d",
      dbUrl(),
      file,
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
  // Un backup viejo puede no tener columnas nuevas: se completa el esquema actual
  await run("npx", ["prisma", "db", "push", "--skip-generate"]).catch((err) =>
    console.error("[Backup] Aviso: no se pudo actualizar el esquema después de restaurar:", err?.stderr || err)
  );
}
