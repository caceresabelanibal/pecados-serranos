import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { SKU_PATTERN } from "@/lib/pricing";

// -------------------------------------------------------------
// Fotos de productos guardadas en PostgreSQL (tabla PecadoProductImage).
// Se guarda la original y una versión optimizada (WEBP, máx. 800px) para la tienda.
// Si un producto no tiene foto en la base, se descarga del proveedor
// (o se toma el archivo local de respaldo) y queda guardada para reutilizarla.
// -------------------------------------------------------------

const SUPPLIER_BASE = "https://resources.sexshopargentino.com.ar/images/products";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;
const missCache = new Map<string, number>();
const inflight = new Map<string, Promise<StoredImage | null>>();

export interface StoredImage {
  mime: string;
  data: Buffer;
  sourceUrl: string;
}

export function productImageUrl(sku: string): string {
  return `/api/pecados/imagen/${encodeURIComponent(sku)}`;
}

// Nombres que usa el proveedor, en orden de preferencia (09_ es la foto principal)
function supplierCandidates(sku: string): string[] {
  const e = encodeURIComponent(sku);
  const urls = [`${SUPPLIER_BASE}/${e}/09_${e}.jpg`, `${SUPPLIER_BASE}/${e}/09_${e}.png`];
  for (let i = 0; i <= 20; i++) {
    if (i === 9) continue;
    const n = String(i).padStart(2, "0");
    urls.push(`${SUPPLIER_BASE}/${e}/${n}_${e}.jpg`, `${SUPPLIER_BASE}/${e}/${n}_${e}.png`);
  }
  urls.push(`${SUPPLIER_BASE}/${e}/${e}.jpg`, `${SUPPLIER_BASE}/${e}/${e}.png`, `${SUPPLIER_BASE}/${e}/1.jpg`);
  return urls;
}

async function fetchImage(url: string): Promise<{ mime: string; data: Buffer } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
    const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(mime)) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length === 0 || data.length > MAX_IMAGE_BYTES) return null;
    return { mime, data };
  } catch {
    return null;
  }
}

async function downloadFromSupplier(sku: string) {
  for (const url of supplierCandidates(sku)) {
    const img = await fetchImage(url);
    if (img) return { ...img, sourceUrl: url };
  }
  return null;
}

function readLocalFile(sku: string) {
  const exts: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  for (const [ext, mime] of Object.entries(exts)) {
    const file = path.join(process.cwd(), "public", "pecados", "products", `${sku}${ext}`);
    if (fs.existsSync(file)) return { mime, data: fs.readFileSync(file), sourceUrl: `local:/pecados/products/${sku}${ext}` };
  }
  return null;
}

// Versión optimizada para la web; si sharp no está disponible se usa la original
async function optimize(data: Buffer, mime: string): Promise<{ mime: string; data: Buffer }> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(data).rotate().resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return out.length < data.length ? { mime: "image/webp", data: out } : { mime, data };
  } catch (err) {
    console.warn("[Imágenes] No se pudo optimizar la imagen:", (err as Error)?.message);
    return { mime, data };
  }
}

export async function saveProductImage(sku: string, original: Buffer, mime: string, sourceUrl: string): Promise<StoredImage> {
  const web = await optimize(original, mime);
  const data = new Uint8Array(web.data);
  const orig = new Uint8Array(original);
  await prisma.pecadoProductImage.upsert({
    where: { sku },
    update: { mime: web.mime, data, original: orig, sourceUrl },
    create: { sku, mime: web.mime, data, original: orig, sourceUrl },
  });
  missCache.delete(sku);
  return { mime: web.mime, data: web.data, sourceUrl };
}

export async function getStoredImage(sku: string): Promise<StoredImage | null> {
  const row = await prisma.pecadoProductImage.findUnique({ where: { sku }, select: { mime: true, data: true, sourceUrl: true } });
  return row ? { mime: row.mime, data: Buffer.from(row.data), sourceUrl: row.sourceUrl } : null;
}

// Busca la foto de un producto existente: base -> proveedor -> archivo local. Lo encontrado queda guardado.
export async function resolveProductImage(sku: string, opts: { force?: boolean } = {}): Promise<StoredImage | null> {
  if (!SKU_PATTERN.test(sku)) return null;
  if (!opts.force) {
    const stored = await getStoredImage(sku);
    if (stored) return stored;
    const missAt = missCache.get(sku);
    if (missAt && Date.now() - missAt < MISS_TTL_MS) return null;
  }
  // Sólo se descargan fotos de productos que existen (evita usar el servidor como proxy)
  const exists = await prisma.pecadoProduct.findUnique({ where: { sku }, select: { id: true } });
  if (!exists) return null;

  const pending = inflight.get(sku);
  if (pending) return pending;
  const job = (async () => {
    const found = (await downloadFromSupplier(sku)) || readLocalFile(sku);
    if (!found) {
      missCache.set(sku, Date.now());
      return null;
    }
    return saveProductImage(sku, found.data, found.mime, found.sourceUrl);
  })().finally(() => inflight.delete(sku));
  inflight.set(sku, job);
  return job;
}

// Imagen subida desde el panel como data URI -> se guarda en la base
export async function saveDataUriImage(sku: string, dataUri: string): Promise<boolean> {
  const m = dataUri.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return false;
  const data = Buffer.from(m[2], "base64");
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) return false;
  await saveProductImage(sku, data, m[1] === "image/jpg" ? "image/jpeg" : m[1], "upload");
  return true;
}
