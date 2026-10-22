import { isValidMultiplier, precioPublicoTC, proveedorConIva } from "@/lib/pricing";

export interface Product {
  id: string;
  sku: string; // Col 3: Código de producto (ej: B2900B, PEC-001)
  title: string;
  tipo?: string; // Col 2: Tipo de artículo (ej: Conjunto de lencería, Body, Disfraz, etc.)
  category: string; // Categoría comercial / tipo para filtros
  description: string; // Col 4: Descripción detallada del artículo
  
  // Costos & Proveedor (Hoja1 VShop.xlsb)
  costoSinIva?: number; // Col 5: Costo Unitario SIN IVA
  costoConIva?: number; // Col 6: Costo Unitario CON IVA (= costoSinIva * 1.21)
  costPrice?: number; // Compatibilidad hacia atrás (= costoConIva || costoSinIva)
  precioFinalProveedor?: number; // Col 15: Precio final de compra / costo de reposición con descuento
  
  // Ganancia & Margen Sugerido (Hoja1 VShop.xlsb)
  multiplicadorGanancia?: number; // Multiplicador de ganancia (ej: 1.5, 1.7, 2.0)
  gananciaSugerida?: number; // Col 7: Valor sugerido (= costoConIva * multiplicador)
  
  // Stock y Control de Inventario
  stock: number; // Col 8: Cantidad en stock disponible
  minStock?: number; // Alerta de stock mínimo
  
  // Precios de Venta al Público (Hoja1 VShop.xlsb)
  price: number; // Col 12: Público Efectivo c/u (Efectivo / Transferencia)
  precioEfectivo?: number; // Alias explícito de Col 12
  precioTarjeta?: number; // Col 13: Público Tarjeta c/u (= precioEfectivo * 1.10)
  
  // Notas & Multimedia
  observaciones?: string; // Col 14: Observaciones particulares del producto
  image: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  paymentMethod?: "efectivo" | "tarjeta"; // Si se calcula a precio efectivo o tarjeta
  interest?: boolean; // Producto sin stock: "Me interesa" (no es compra ni descuenta stock)
}

export interface SaleItem {
  productId: string;
  productSku: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unitCost?: number;
  paymentMethodUsed?: "efectivo" | "tarjeta";
}

export interface Sale {
  id: string;
  date: string; // ISO string
  buyerName?: string;
  buyerPhone?: string;
  channel: "web_whatsapp" | "direct_sale" | "reseller";
  resellerId?: string;
  resellerName?: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: "efectivo" | "transferencia" | "mercadopago" | "otro";
  status: "completed" | "pending" | "cancelled";
  notes?: string;
}

export interface Reseller {
  id: string;
  name: string;
  phone: string;
  zone: string; // Zona / Localidad (ej: Punilla, Carlos Paz, Córdoba Capital)
  commissionPercent: number; // Porcentaje de comisión (%)
  notes?: string;
  createdAt: string;
}

export interface Consignment {
  id: string;
  resellerId: string;
  resellerName: string;
  date: string; // ISO string
  productId: string;
  productSku: string;
  productTitle: string;
  quantityGiven: number; // Cantidad entregada para revender
  unitAgreedPrice: number; // Precio acordado por unidad
  quantitySold: number; // Cantidad vendida
  quantityReturned: number; // Cantidad devuelta
  status: "active" | "settled"; // En consignación / Liquidada
  notes?: string;
}

export interface PurchaseItemDetail {
  sku: string;
  title: string;
  tipo?: string;
  category?: string;
  cantidadComprada: number;
  costoSinIva: number;
  costoConIva: number;
  subtotalCostoSinIva: number;
  subtotalCostoConIva: number;
  precioEfectivo: number;
  precioTarjeta: number;
  subtotalVentaEstimada: number;
  stockAnterior: number;
  stockFinal: number;
  action: "new" | "restock";
}

export interface PurchaseRecord {
  id: string;
  fileName: string; // ej: "ExportdelPedido.xlsx" o "Carga Inicial VShop"
  date: string;     // ISO string
  source: "excel_import" | "initial_seed" | "manual";
  notes?: string;
  totalItems: number; // cantidad de SKUs distintos
  newItems: number;   // cantidad de productos creados nuevos
  restockItems: number; // cantidad de productos con stock sumado
  totalUnits: number; // suma total de unidades físicas
  totalCostSinIva: number;
  totalCostConIva: number;
  totalSaleEstimated: number;
  items: PurchaseItemDetail[];
}

// =========================================================================
// FÓRMULAS EMPRESARIALES DE VSHOP.XLSB
// =========================================================================

export const IVA_RATE = 0.21; // 21% de IVA (Col 6: =E2*21/100+E2)
export const TARJETA_MARKUP = 0.10; // 10% recargo tarjeta (Col 13: =L2*10/100+L2)
export const DEFAULT_MULTIPLIER = 2.0; // Multiplicador estándar x2.0

// 1. Proveedor con IVA: =SIN_IVA*21/100+SIN_IVA (sin redondeo, igual que la planilla)
export function calcularCostoConIva(costoSinIva: number): number {
  return proveedorConIva(costoSinIva);
}

// 2. Ganancia: Proveedor con IVA * multiplicador (sin multiplicador elegido = 0)
export function calcularGananciaSugerida(costoConIva: number, multiplicador = 0): number {
  if (!costoConIva || costoConIva <= 0 || !isValidMultiplier(multiplicador)) return 0;
  return costoConIva * multiplicador;
}

// 3. Precio Público TC: =FT*10/100+FT
export function calcularPrecioTarjeta(precioEfectivo: number): number {
  return precioPublicoTC(precioEfectivo);
}

// 4. Subtotal Costo SIN IVA: costoSinIva * cantidad (Col 9)
export function calcularSubtotalSinIva(arg1: Product | number, stock?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const cSin = arg1.costoSinIva || (arg1.costPrice ? Math.round(arg1.costPrice / (1 + IVA_RATE)) : 0);
    return Math.round(cSin * (arg1.stock || 0));
  }
  return Math.round((arg1 || 0) * (stock || 0));
}

// 5. Subtotal Costo CON IVA: costoConIva * cantidad (Col 10)
export function calcularSubtotalConIva(arg1: Product | number, stock?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const cCon = arg1.costoConIva || arg1.costPrice || (arg1.costoSinIva ? calcularCostoConIva(arg1.costoSinIva) : 0);
    return Math.round(cCon * (arg1.stock || 0));
  }
  return Math.round((arg1 || 0) * (stock || 0));
}

// 6. Subtotal Ganancia Sugerida: gananciaSugerida * cantidad (Col 11)
export function calcularSubtotalGanancia(arg1: Product | number, stock?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const cCon = arg1.costoConIva || arg1.costPrice || (arg1.costoSinIva ? calcularCostoConIva(arg1.costoSinIva) : 0);
    const mult = arg1.multiplicadorGanancia || DEFAULT_MULTIPLIER;
    const sug = arg1.gananciaSugerida || calcularGananciaSugerida(cCon, mult);
    return Math.round(sug * (arg1.stock || 0));
  }
  return Math.round((arg1 || 0) * (stock || 0));
}

// 7. Subtotal Venta Efectivo: precioEfectivo * cantidad
export function calcularTotalVentaEfectivo(arg1: Product | number, stock?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const pEfec = arg1.precioEfectivo || arg1.price || 0;
    return Math.round(pEfec * (arg1.stock || 0));
  }
  return Math.round((arg1 || 0) * (stock || 0));
}

// 8. Subtotal Venta Tarjeta: precioTarjeta * cantidad
export function calcularTotalVentaTarjeta(arg1: Product | number, stock?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const pEfec = arg1.precioEfectivo || arg1.price || 0;
    const pTarj = arg1.precioTarjeta || calcularPrecioTarjeta(pEfec);
    return Math.round(pTarj * (arg1.stock || 0));
  }
  return Math.round((arg1 || 0) * (stock || 0));
}

// 9. Total Inversión Proveedor / Costo Final: precioFinalProveedor * cantidad (Col 16)
export function calcularTotalProveedor(arg1: Product | number, stock?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const pProv = arg1.precioFinalProveedor || 0;
    return Math.round(pProv * (arg1.stock || 0));
  }
  return Math.round((arg1 || 0) * (stock || 0));
}

// 10. Margen de Ganancia Real por unidad (Efectivo - Costo con IVA)
export function calcularMargenReal(arg1: Product | number, costoConIva?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const cCon = arg1.costoConIva || arg1.costPrice || (arg1.costoSinIva ? calcularCostoConIva(arg1.costoSinIva) : 0);
    const pEfec = arg1.precioEfectivo || arg1.price || 0;
    return pEfec - cCon;
  }
  return (arg1 || 0) - (costoConIva || 0);
}

// 11. % de Margen Real sobre costo con IVA
export function calcularPorcentajeMargen(arg1: Product | number, costoConIva?: number): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    const cCon = arg1.costoConIva || arg1.costPrice || (arg1.costoSinIva ? calcularCostoConIva(arg1.costoSinIva) : 0);
    const pEfec = arg1.precioEfectivo || arg1.price || 0;
    if (!cCon || cCon <= 0) return 0;
    return Math.round(((pEfec - cCon) / cCon) * 100);
  }
  if (!costoConIva || costoConIva <= 0) return 0;
  return Math.round((((arg1 || 0) - costoConIva) / costoConIva) * 100);
}

// Tipos detectados en la planilla VShop.xlsb para sugerencias rápidas
export const PRODUCT_TYPES_PRESETS = [
  "Conjunto de lencería",
  "Body",
  "Body Arnés",
  "Less con Liguero",
  "Babydolls",
  "Babydolls XL",
  "Disfraz",
  "Lubricante",
  "Lencería Hot",
  "Accesorios",
  "General",
];

export const PRESET_IMAGES = [
  { label: "Auriculares (Ejemplo)", url: "/pecados/auriculares.jpg" },
  { label: "Logo Pecados Serranos", url: "/pecados/logo.jpg" },
];


export interface ProductInterest {
  id: string;
  productId?: string | null;
  productSku: string;
  productTitle: string;
  quantity: number;
  buyerName: string;
  notes: string;
  status: "pending" | "ordered" | "closed";
  createdAt: string;
}

export interface PurchasePlanItem {
  productSku: string;
  productTitle: string;
  tipo: string;
  quantity: number;
  costoSinIva: number;
  image: string;
  fromInterest: boolean;
}
