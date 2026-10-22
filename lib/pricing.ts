// -------------------------------------------------------------
// Fórmulas del flujo de caja (idénticas a la planilla VShop.xlsb)
//   Proveedor con IVA   = SIN IVA * 21/100 + SIN IVA        (F = E*21/100+E)
//   Ganancia            = Proveedor con IVA * multiplicador  (G = F*mult)
//   S/IVA * C           = SIN IVA * Cantidad                 (I = E*H)
//   C/IVA * C           = Proveedor con IVA * Cantidad       (J = F*H)
//   Ganancia total Maru = Ganancia * Cantidad                (K = G*H)
//   Precio Público FT   = valor cargado a mano               (L)
//   Precio Público TC   = FT * 10/100 + FT                   (M = L*10/100+L)
// Sin redondeos: los valores coinciden con los del Excel.
// Este módulo lo usan tanto el navegador como el servidor.
// -------------------------------------------------------------

export const MULTIPLIER_OPTIONS = [1.5, 1.6, 1.7, 1.8, 2.0, 4.0];

export function isValidMultiplier(m: unknown): m is number {
  return typeof m === "number" && MULTIPLIER_OPTIONS.some((o) => Math.abs(o - m) < 1e-9);
}

export function proveedorConIva(sinIva: number): number {
  const v = Number(sinIva) || 0;
  return v > 0 ? (v * 21) / 100 + v : 0;
}

export function precioPublicoTC(ft: number): number {
  const v = Number(ft) || 0;
  return v > 0 ? (v * 10) / 100 + v : 0;
}

interface PricedProduct {
  sku?: string;
  title?: string;
  costoSinIva?: number;
  multiplicadorGanancia?: number;
  precioEfectivo?: number;
  stock?: number;
}

export function flujoDeCaja(p: PricedProduct) {
  const sinIva = Number(p.costoSinIva) || 0;
  const conIva = proveedorConIva(sinIva);
  const mult = isValidMultiplier(p.multiplicadorGanancia) ? p.multiplicadorGanancia : 0;
  const ganancia = conIva * mult;
  const cantidad = Number(p.stock) || 0;
  const ft = Number(p.precioEfectivo) || 0;
  return {
    proveedorSinIva: sinIva,
    proveedorConIva: conIva,
    multiplicador: mult,
    ganancia,
    cantidad,
    sinIvaPorCantidad: sinIva * cantidad,
    conIvaPorCantidad: conIva * cantidad,
    gananciaTotal: ganancia * cantidad,
    precioPublicoFT: ft,
    precioPublicoTC: precioPublicoTC(ft),
  };
}

// Datos que faltan para que el producto pueda mostrarse en la tienda
export function missingFields(p: PricedProduct): string[] {
  const missing: string[] = [];
  if (!p.sku || !String(p.sku).trim()) missing.push("Código");
  if (!p.title || !String(p.title).trim()) missing.push("Descripción");
  if (!(Number(p.costoSinIva) > 0)) missing.push("Proveedor SIN IVA");
  if (!isValidMultiplier(p.multiplicadorGanancia)) missing.push("Multiplicador de ganancia");
  if (!(Number(p.precioEfectivo) > 0)) missing.push("Precio Público FT");
  return missing;
}

export function isProductComplete(p: PricedProduct): boolean {
  return missingFields(p).length === 0;
}

// Formato de moneda con hasta 2 decimales (como en la planilla)
export function formatMoney(n: number): string {
  return `$${(Number(n) || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

// Código de producto: letras, números, espacio, punto y guion (ej: "CR T OILUVA", "SS-SF-90074")
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9 ._-]{0,39}$/;
