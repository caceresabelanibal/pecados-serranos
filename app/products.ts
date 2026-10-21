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

// 1. Costo CON IVA: costoSinIva * 1.21
export function calcularCostoConIva(costoSinIva: number): number {
  if (!costoSinIva || costoSinIva <= 0) return 0;
  return Math.round(costoSinIva * (1 + IVA_RATE));
}

// 2. Ganancia Sugerida: costoConIva * multiplicador (ej: x1.5, x1.7, x2.0)
export function calcularGananciaSugerida(costoConIva: number, multiplicador = DEFAULT_MULTIPLIER): number {
  if (!costoConIva || costoConIva <= 0) return 0;
  return Math.round(costoConIva * (multiplicador || DEFAULT_MULTIPLIER));
}

// 3. Público Tarjeta c/u: precioEfectivo * 1.10
export function calcularPrecioTarjeta(precioEfectivo: number): number {
  if (!precioEfectivo || precioEfectivo <= 0) return 0;
  return Math.round(precioEfectivo * (1 + TARJETA_MARKUP));
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

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "pecado-1",
    sku: "B073N",
    tipo: "Less",
    category: "Less",
    title: "Colaless Tapless Negra con Puntilla",
    description: "TAPLESS - Colaless negra de tiras con puntilla elastizada",
    costoSinIva: 4040.0,
    costoConIva: 4888,
    costPrice: 4888,
    multiplicadorGanancia: 3.62,
    gananciaSugerida: 17695,
    precioFinalProveedor: 4040.0,
    stock: 1,
    minStock: 1,
    price: 17700.0,
    precioEfectivo: 17700.0,
    precioTarjeta: 19470.0,
    observaciones: "",
    image: "/pecados/products/B073N.jpg",
  },
  {
    id: "pecado-2",
    sku: "B073R",
    tipo: "Less",
    category: "Less",
    title: "Colaless Tapless Roja con Puntilla",
    description: "TAPLESS - Colaless roja Puntilla elastizada con tiras",
    costoSinIva: 4040.0,
    costoConIva: 4888,
    costPrice: 4888,
    multiplicadorGanancia: 3.62,
    gananciaSugerida: 17695,
    precioFinalProveedor: 4040.0,
    stock: 2,
    minStock: 1,
    price: 17700.0,
    precioEfectivo: 17700.0,
    precioTarjeta: 19470.0,
    observaciones: "",
    image: "/pecados/products/B073R.jpg",
  },
  {
    id: "pecado-3",
    sku: "B080R",
    tipo: "Less",
    category: "Less",
    title: "Tanga Roja con Tirantes Regulables",
    description: "Tanga roja con tirantes que abrochan en la cintura",
    costoSinIva: 4090.0,
    costoConIva: 4949,
    costPrice: 4949,
    multiplicadorGanancia: 3.54,
    gananciaSugerida: 17519,
    precioFinalProveedor: 4090.0,
    stock: 1,
    minStock: 1,
    price: 17500.0,
    precioEfectivo: 17500.0,
    precioTarjeta: 19250.0,
    observaciones: "",
    image: "/pecados/products/B080R.jpg",
  },
  {
    id: "pecado-4",
    sku: "B1002B",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Blanco de Puntilla Elegance",
    description: "Conjunto blanco de puntilla",
    costoSinIva: 13210.0,
    costoConIva: 15984,
    costPrice: 15984,
    multiplicadorGanancia: 2.39,
    gananciaSugerida: 38202,
    precioFinalProveedor: 13210.0,
    stock: 1,
    minStock: 1,
    price: 38200.0,
    precioEfectivo: 38200.0,
    precioTarjeta: 42020.0,
    observaciones: "",
    image: "/pecados/products/B1002B.jpg",
  },
  {
    id: "pecado-5",
    sku: "B1009N",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Triangulito Tul Plumet Negro",
    description: "Conjunto triangulito en negro confeccionado en tul de plumeti de estética refinada, líneas suaves que brindan equilibrio y distinción, materiales livianos que priorizan confort y adaptabilidad, diseño delicado que realza la feminidad con sutileza, pieza versátil ideal para un look sofisticado y moderno",
    costoSinIva: 15610.0,
    costoConIva: 18888,
    costPrice: 18888,
    multiplicadorGanancia: 2.41,
    gananciaSugerida: 45520,
    precioFinalProveedor: 15610.0,
    stock: 1,
    minStock: 1,
    price: 45500.0,
    precioEfectivo: 45500.0,
    precioTarjeta: 50050.0,
    observaciones: "",
    image: "/pecados/products/B1009N.jpg",
  },
  {
    id: "pecado-6",
    sku: "B1030R",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Rojo Erótico con Corpiño Semitransparente",
    description: "Conjunto rojo de corpiño semitransparente y tanga con triángulo tu elección perfecta para una noche erótica y sensual. Con su diseño único y su talle único, te sentirás poderosa y sexy. Además, el material suave y cómodo garantiza que te sientas bien durante toda la noche.",
    costoSinIva: 13680.0,
    costoConIva: 16553,
    costPrice: 16553,
    multiplicadorGanancia: 2.75,
    gananciaSugerida: 45521,
    precioFinalProveedor: 13680.0,
    stock: 1,
    minStock: 1,
    price: 45500.0,
    precioEfectivo: 45500.0,
    precioTarjeta: 50050.0,
    observaciones: "",
    image: "/pecados/products/B1030R.jpg",
  },
  {
    id: "pecado-7",
    sku: "B2900B",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Blanco con Portaligas Integrado",
    description: "Conjunto en blanco de líneas modernas con portaligas integrado, brasier y tanga confeccionados en elástico que brindan ajuste armonioso y confortable, diseño equilibrado que combina presencia y sutileza, terminaciones cuidadas que aportan distinción, pieza versátil ideal para realzar la figura con elegancia.",
    costoSinIva: 8860.0,
    costoConIva: 10721,
    costPrice: 10721,
    multiplicadorGanancia: 2.97,
    gananciaSugerida: 31841,
    precioFinalProveedor: 8860.0,
    stock: 2,
    minStock: 1,
    price: 31800.0,
    precioEfectivo: 31800.0,
    precioTarjeta: 34980.0,
    observaciones: "",
    image: "/pecados/products/B2900B.jpg",
  },
  {
    id: "pecado-8",
    sku: "B2900R",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Rojo Intenso con Portaligas",
    description: "Conjunto en rojo intenso que despierta miradas y eleva el juego, brasier y tanga en elástico que abrazan cada curva con sutileza, portaligas que añade un detalle sugerente y atractivo, ajuste flexible que acompaña cada movimiento con suavidad, pensado para insinuar con estilo y seguridad.",
    costoSinIva: 8860.0,
    costoConIva: 10721,
    costPrice: 10721,
    multiplicadorGanancia: 2.97,
    gananciaSugerida: 31841,
    precioFinalProveedor: 8860.0,
    stock: 2,
    minStock: 1,
    price: 31800.0,
    precioEfectivo: 31800.0,
    precioTarjeta: 34980.0,
    observaciones: "",
    image: "/pecados/products/B2900R.jpg",
  },
  {
    id: "pecado-9",
    sku: "B4010R",
    tipo: "Body",
    category: "Body",
    title: "Body Rojo Estructurado con Aro",
    description: "Body rojo de diseño estructurado con aro que aporta soporte y definición, líneas refinadas que equilibran sensualidad y sofisticación, confección cómoda que se adapta armoniosamente al cuerpo, terminaciones cuidadas que realzan la figura con sutileza, pieza versátil ideal para un look distinguido y moderno.",
    costoSinIva: 15770.0,
    costoConIva: 19082,
    costPrice: 19082,
    multiplicadorGanancia: 2.46,
    gananciaSugerida: 46942,
    precioFinalProveedor: 15770.0,
    stock: 1,
    minStock: 1,
    price: 47000.0,
    precioEfectivo: 47000.0,
    precioTarjeta: 51700.0,
    observaciones: "",
    image: "/pecados/products/B4010R.jpg",
  },
  {
    id: "pecado-10",
    sku: "B4065N",
    tipo: "Body",
    category: "Body",
    title: "Body Ceñido Negro Semitransparente",
    description: "Sensual y ceñido body en color negro, semitransparentes con decoraciones centales, de excelente calidad, talle unico. Un complemento ideal en tu lenceria de amor. Disponible en todos nuestros locales o puedes pedirla en nuestro sitio web.",
    costoSinIva: 16660.0,
    costoConIva: 20159,
    costPrice: 20159,
    multiplicadorGanancia: 2.43,
    gananciaSugerida: 48986,
    precioFinalProveedor: 16660.0,
    stock: 1,
    minStock: 1,
    price: 49000.0,
    precioEfectivo: 49000.0,
    precioTarjeta: 53900.0,
    observaciones: "",
    image: "/pecados/products/B4065N.jpg",
  },
  {
    id: "pecado-11",
    sku: "C002P",
    tipo: "Disfraz",
    category: "Disfraz",
    title: "Disfraz de Enfermera Hot",
    description: "Disfruta de este disfraz de enfermera, ceñido al cuerpo en talle único, despierta la pasión con su audacia.",
    costoSinIva: 16270.0,
    costoConIva: 19687,
    costPrice: 19687,
    multiplicadorGanancia: 2.36,
    gananciaSugerida: 46461,
    precioFinalProveedor: 16270.0,
    stock: 1,
    minStock: 1,
    price: 46400.0,
    precioEfectivo: 46400.0,
    precioTarjeta: 51040.0,
    observaciones: "",
    image: "/pecados/products/C002P.jpg",
  },
  {
    id: "pecado-12",
    sku: "C003P",
    tipo: "Disfraz",
    category: "Disfraz",
    title: "Disfraz de Colegiala Sensual",
    description: "Disfruta de este disfraz de colegiala, ceñido al cuerpo en talle único, despierta la pasión con su audacia. Viene con tiradores, su característico corbatín y en conjunto la pollera con body todo en una sola pieza.",
    costoSinIva: 16270.0,
    costoConIva: 19687,
    costPrice: 19687,
    multiplicadorGanancia: 2.36,
    gananciaSugerida: 46461,
    precioFinalProveedor: 16270.0,
    stock: 1,
    minStock: 1,
    price: 46400.0,
    precioEfectivo: 46400.0,
    precioTarjeta: 51040.0,
    observaciones: "",
    image: "/pecados/products/C003P.jpg",
  },
  {
    id: "pecado-13",
    sku: "C12TFRO",
    tipo: "Disfraz",
    category: "Disfraz",
    title: "Disfraz de Conejita Rosa 4 Piezas",
    description: "Sube la pasión de tus fantasías con tu disfraz de conejita color rosa que contiene 4 piezas: Vincha con orejas de peluche, body armado con moños y colita y mitones de microfibra. Hecho de telas suaves y ajustables.",
    costoSinIva: 11450.0,
    costoConIva: 13854,
    costPrice: 13854,
    multiplicadorGanancia: 2.41,
    gananciaSugerida: 33388,
    precioFinalProveedor: 11450.0,
    stock: 1,
    minStock: 1,
    price: 33400.0,
    precioEfectivo: 33400.0,
    precioTarjeta: 36740.0,
    observaciones: "",
    image: "/pecados/products/C12TFRO.jpg",
  },
  {
    id: "pecado-14",
    sku: "D1179NXL",
    tipo: "Less XL",
    category: "Less XL",
    title: "Colaless Abierta Puntilla Elastizada Talle XL",
    description: "Less negra Abierta de Puntilla Elastizada en Talla XL",
    costoSinIva: 5230.0,
    costoConIva: 6328,
    costPrice: 6328,
    multiplicadorGanancia: 2.09,
    gananciaSugerida: 13226,
    precioFinalProveedor: 5230.0,
    stock: 2,
    minStock: 1,
    price: 13200.0,
    precioEfectivo: 13200.0,
    precioTarjeta: 14520.0,
    observaciones: "",
    image: "/pecados/products/D1179NXL.jpg",
  },
  {
    id: "pecado-15",
    sku: "D2405L",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Triángulo Tul Leopardo",
    description: "Conjunto de Triángulo Tul con Diseño de Leopardo",
    costoSinIva: 10620.0,
    costoConIva: 12850,
    costPrice: 12850,
    multiplicadorGanancia: 2.41,
    gananciaSugerida: 30969,
    precioFinalProveedor: 10620.0,
    stock: 1,
    minStock: 1,
    price: 31000.0,
    precioEfectivo: 31000.0,
    precioTarjeta: 34100.0,
    observaciones: "",
    image: "/pecados/products/D2405L.jpg",
  },
  {
    id: "pecado-16",
    sku: "D4132B",
    tipo: "Body",
    category: "Body",
    title: "Body de Encaje Blanco Delicado",
    description: "Body confeccionado totalmente en un delicado encaje blanco, cubre toda tu parte delantera y deja a la vista tu parte posterior, muy sensual, este Body de encajes",
    costoSinIva: 6640.0,
    costoConIva: 8034,
    costPrice: 8034,
    multiplicadorGanancia: 3.4,
    gananciaSugerida: 27316,
    precioFinalProveedor: 6640.0,
    stock: 1,
    minStock: 1,
    price: 27300.0,
    precioEfectivo: 27300.0,
    precioTarjeta: 30030.0,
    observaciones: "",
    image: "/pecados/products/D4132B.jpg",
  },
  {
    id: "pecado-17",
    sku: "D6105BXL",
    tipo: "Babydolls XL",
    category: "Babydolls XL",
    title: "Baby Doll Blanco Gasa Busto Abierto Talle XL",
    description: "Baby Doll blanco en Gasa con Busto Abierto y Colales, su original diseño con abertura en el busto sólo sujeto con un lazo lo hacen sensual y divertido. Baby doll hecho en gasa color negro con detalles que incluye colaless. Ideal para combinar con medias y portaligas",
    costoSinIva: 10130.0,
    costoConIva: 12257,
    costPrice: 12257,
    multiplicadorGanancia: 2.68,
    gananciaSugerida: 32849,
    precioFinalProveedor: 10130.0,
    stock: 1,
    minStock: 1,
    price: 32800.0,
    precioEfectivo: 32800.0,
    precioTarjeta: 36080.0,
    observaciones: "",
    image: "/pecados/products/D6105BXL.jpg",
  },
  {
    id: "pecado-18",
    sku: "F155N",
    tipo: "Less con Ligero",
    category: "Less con Ligero",
    title: "Colaless con Liguero Regulable Negro",
    description: "Sensualidad en negro ajustada a tu medida. Su diseño en puntilla aporta delicadeza, mientras el arnés regulable añade un toque provocador. Ideal para encuentros íntimos inolvidables.",
    costoSinIva: 6280.0,
    costoConIva: 7599,
    costPrice: 7599,
    multiplicadorGanancia: 3.0,
    gananciaSugerida: 22797,
    precioFinalProveedor: 6280.0,
    stock: 2,
    minStock: 1,
    price: 22800.0,
    precioEfectivo: 22800.0,
    precioTarjeta: 25080.0,
    observaciones: "",
    image: "/pecados/products/F155N.jpg",
  },
  {
    id: "pecado-19",
    sku: "F305N",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Puntilla con Tiras Anchas Negro",
    description: "Conjunto de puntilla con tiras anchas negro",
    costoSinIva: 8890.0,
    costoConIva: 10757,
    costPrice: 10757,
    multiplicadorGanancia: 2.97,
    gananciaSugerida: 31948,
    precioFinalProveedor: 8890.0,
    stock: 1,
    minStock: 1,
    price: 32000.0,
    precioEfectivo: 32000.0,
    precioTarjeta: 35200.0,
    observaciones: "",
    image: "/pecados/products/F305N.jpg",
  },
  {
    id: "pecado-20",
    sku: "F325N",
    tipo: "Conjunto de lenceria",
    category: "Conjunto de lenceria",
    title: "Conjunto Puntilla con Doble Tira Negro",
    description: "Conjunto de puntilla con doble tira, sexy prenda confeccionada en puntilla negra y doble tira a los lados que ajustan y resaltan la figura.",
    costoSinIva: 10400.0,
    costoConIva: 12584,
    costPrice: 12584,
    multiplicadorGanancia: 2.99,
    gananciaSugerida: 37626,
    precioFinalProveedor: 10400.0,
    stock: 1,
    minStock: 1,
    price: 37600.0,
    precioEfectivo: 37600.0,
    precioTarjeta: 41360.0,
    observaciones: "",
    image: "/pecados/products/F325N.jpg",
  },
  {
    id: "pecado-21",
    sku: "FR202N",
    tipo: "Medias Vinilo",
    category: "Medias Vinilo",
    title: "Medias Bucaneras Vinilo Elastizado Negro",
    description: "Medias bucaneras de vinilo negro elastizadas.",
    costoSinIva: 8610.0,
    costoConIva: 10418,
    costPrice: 10418,
    multiplicadorGanancia: 2.36,
    gananciaSugerida: 24586,
    precioFinalProveedor: 8610.0,
    stock: 1,
    minStock: 1,
    price: 24600.0,
    precioEfectivo: 24600.0,
    precioTarjeta: 27060.0,
    observaciones: "",
    image: "/pecados/products/FR202N.jpg",
  },
  {
    id: "pecado-22",
    sku: "MB200N",
    tipo: "Body Arnes",
    category: "Body Arnes",
    title: "Body Arnés Bicolor con Liga Doble",
    description: "Para un look osado y muy hot te presento este body blanco y negro, con liga doble. Diseño confeccionado en elástico de raso de 10 mm con reguladores en todas sus tiras, adaptable a todos los talles y cuerpos. Simulando un escote V va desde el cuello y entre busto marcando la cintura y terminando en unas dobles ligas en las piernas, todo con reguladores.",
    costoSinIva: 6940.0,
    costoConIva: 8397,
    costPrice: 8397,
    multiplicadorGanancia: 2.2,
    gananciaSugerida: 18473,
    precioFinalProveedor: 6940.0,
    stock: 2,
    minStock: 1,
    price: 18500.0,
    precioEfectivo: 18500.0,
    precioTarjeta: 20350.0,
    observaciones: "",
    image: "/pecados/products/MB200N.png",
  },
  {
    id: "pecado-23",
    sku: "R646R",
    tipo: "Less",
    category: "Less",
    title: "Tanga Roja con Pompón Provocador",
    description: "Tanga roja con pompón",
    costoSinIva: 3210.0,
    costoConIva: 3884,
    costPrice: 3884,
    multiplicadorGanancia: 3.35,
    gananciaSugerida: 13011,
    precioFinalProveedor: 3210.0,
    stock: 2,
    minStock: 1,
    price: 13000.0,
    precioEfectivo: 13000.0,
    precioTarjeta: 14300.0,
    observaciones: "",
    image: "/pecados/products/R646R.jpg",
  },
  {
    id: "pecado-24",
    sku: "SS-AD-10761",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Masajeador Doble Estimulación Butch Cassidy",
    description: "Masajeador femenino de doble estimulación Butch Cassidy. Este vibrador tiene dos motores potentes y silenciosos para estimular tanto clítoris como punto G al mismo tiempo. ¡Elije entre 10 funciones de vibración y 10 intensidades de vibración, ningún otro estimulador te ofrece tantas excitantes opciones de placer! Confeccionado en silicona aterciopelada. Incluye 3 capuchones intercambiables para una estimulación clitoriana acorde a tus deseos.",
    costoSinIva: 25210.0,
    costoConIva: 27857,
    costPrice: 27857,
    multiplicadorGanancia: 2.12,
    gananciaSugerida: 59057,
    precioFinalProveedor: 25210.0,
    stock: 1,
    minStock: 1,
    price: 59000.0,
    precioEfectivo: 59000.0,
    precioTarjeta: 64900.0,
    observaciones: "",
    image: "/pecados/products/SS-AD-10761.jpg",
  },
  {
    id: "pecado-25",
    sku: "SS-CA-0019-04-2",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Vibrador Rígido Sumergible Multivelocidad",
    description: "Potente vibrador rigido resistente al agua y de gran potencia, multi velocidad ideal para usar con quien quieras cuando quieras, de suave superficie y puedes usarlo en cualquier parte de tu cuerpo sin ningun tipo de problema.",
    costoSinIva: 12470.0,
    costoConIva: 13779,
    costPrice: 13779,
    multiplicadorGanancia: 2.1,
    gananciaSugerida: 28936,
    precioFinalProveedor: 12470.0,
    stock: 1,
    minStock: 1,
    price: 29000.0,
    precioEfectivo: 29000.0,
    precioTarjeta: 31900.0,
    observaciones: "",
    image: "/pecados/products/SS-CA-0019-04-2.jpg",
  },
  {
    id: "pecado-26",
    sku: "SS-SA-1135",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Satisfyer Sweet Treat Estimulador Clitorial",
    description: "El Satisfyer Sweet Treat es probablemente el más dulce de todos los vibradores de clítoris, porque la bola de helado en el cono discreto lo tiene todo: con crestas giratorias, lleva tu clítoris a clímax. Fácilmente con los 10 emocionantes niveles de vibración, que constan de 4 ritmos de rotación y 3 velocidades derecha e izquierda cada uno, a través de los botones +/-.Gracias a su reducido tamaño cabe perfectamente en tu mochila o bolso de mano y te acompaña sin esfuerzo en cualquier tipo de viaje. Esta joya está equipada con una batería de iones de litio, que se puede cargar fácilmente y de forma ecológica con el cable magnético USB. Además, gracias a su superficie de silicona higiénica, puedes limpiar fácilmente el Sweet Treat con un poco de agua tibia y jabón y un Toycleaner desinfectante.",
    costoSinIva: 44580.0,
    costoConIva: 49261,
    costPrice: 49261,
    multiplicadorGanancia: 2.3,
    gananciaSugerida: 113300,
    precioFinalProveedor: 44580.0,
    stock: 1,
    minStock: 1,
    price: 113500.0,
    precioEfectivo: 113500.0,
    precioTarjeta: 124850.0,
    observaciones: "",
    image: "/pecados/products/SS-SA-1135.jpg",
  },
  {
    id: "pecado-27",
    sku: "SS-SA-5885",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Estimulador Divino G for Goddess 1",
    description: "Empodérate y descubre tu divinidad sexual con G for Goddess 1, el estimulador que te lleva al Olimpo del placer. Con un diseño ergonómico y doble estimulación del punto G y clítoris, este juguete te ofrece una experiencia celestial en cada uso. Fabricado con silicona suave para una sensación lujosa y con carga USB para una comodidad absoluta.",
    costoSinIva: 50370.0,
    costoConIva: 55659,
    costPrice: 55659,
    multiplicadorGanancia: 2.43,
    gananciaSugerida: 135251,
    precioFinalProveedor: 50370.0,
    stock: 1,
    minStock: 1,
    price: 135000.0,
    precioEfectivo: 135000.0,
    precioTarjeta: 148500.0,
    observaciones: "",
    image: "/pecados/products/SS-SA-5885.jpg",
  },
  {
    id: "pecado-28",
    sku: "SS-SF-70676",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Estimulador Lipstick Dorado Tucana",
    description: "Estimulador femenino Tucana con forma de lápiz labial dorado, es el complemento ideal para toda mujer que quiera disfrutar de su sexualidad de forma discreta y en cualquier lugar. Este lápiz labial dorado es un vibrador y estimulador de clítoris con un diseño perfectamente cuidado y tomando todos los detalles de un lápiz labial verdadero, pasa totalmente desapercibido en la cartera o bolso.",
    costoSinIva: 5920.0,
    costoConIva: 6542,
    costPrice: 6542,
    multiplicadorGanancia: 5.73,
    gananciaSugerida: 37486,
    precioFinalProveedor: 5920.0,
    stock: 1,
    minStock: 1,
    price: 37500.0,
    precioEfectivo: 37500.0,
    precioTarjeta: 41250.0,
    observaciones: "VER porque al publico puede llegar a ser mas barato",
    image: "/pecados/products/SS-SF-70676.jpg",
  },
  {
    id: "pecado-29",
    sku: "SS-SF-70682",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Estimulador Punto G y Clítoris Norma",
    description: "Norma Estimulador de punto G y estimulación clitorial, hecho en silicona suave y flexible. Tiene doble estimulación, tanto de punto G como de clítoris. Su punta más ancha tomará contacto de forma anatómica con el punto G, mientras las antenas de la mariposa acariciarán clítoris y sus alas los labios vaginales. Con intensidades de vibración para que elijas la que te sea más placentera y estimulante. Medidas: 18,5 cm de largo por 2,5 cm de ancho en la punta, 7 cm de penetración.",
    costoSinIva: 20720.0,
    costoConIva: 22896,
    costPrice: 22896,
    multiplicadorGanancia: 2.14,
    gananciaSugerida: 48997,
    precioFinalProveedor: 20720.0,
    stock: 1,
    minStock: 1,
    price: 49000,
    precioEfectivo: 49000,
    precioTarjeta: 53900,
    observaciones: "",
    image: "/pecados/products/SS-SF-70682.jpg",
  },
  {
    id: "pecado-30",
    sku: "SS-SF-90074",
    tipo: "Vibradores",
    category: "Vibradores",
    title: "Brocha Vibradora Eléctrica de Belleza y Placer",
    description: "Brocha eléctrica vibradora con diseño elegante y discreto, perfecta para quienes buscan combinar belleza y placer en un solo accesorio. Ofrece 10 modos de vibración que estimulan con suavidad y potencia según tu preferencia. Fabricada en silicona de alta calidad, es segura y fácil de limpiar. Su tamaño portátil permite llevarla a cualquier lugar sin levantar sospechas",
    costoSinIva: 17070.0,
    costoConIva: 18862,
    costPrice: 18862,
    multiplicadorGanancia: 2.56,
    gananciaSugerida: 48287,
    precioFinalProveedor: 17070.0,
    stock: 1,
    minStock: 1,
    price: 48200.0,
    precioEfectivo: 48200.0,
    precioTarjeta: 53020.0,
    observaciones: "",
    image: "/pecados/products/SS-SF-90074.jpg",
  },
];

export const INITIAL_RESELLERS: Reseller[] = [
  {
    id: "res-1",
    name: "Revendedor Ejemplo - Valle de Punilla",
    phone: "5493548552786",
    zone: "La Falda / Valle de Punilla",
    commissionPercent: 15,
    notes: "Revendedor oficial en ferias y comercios de la zona",
    createdAt: new Date().toISOString(),
  },
];

export const PRESET_IMAGES = [
  { label: "Auriculares (Ejemplo)", url: "/pecados/auriculares.jpg" },
  { label: "Logo Pecados Serranos", url: "/pecados/logo.jpg" },
];

export { INITIAL_PURCHASES } from "@/lib/initial-purchases";