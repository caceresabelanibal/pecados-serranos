"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  Lock,
  Phone,
  ArrowLeft,
  Search,
  AlertCircle,
  Package,
  RotateCcw,
  Flame,
  Edit3,
  ShieldCheck,
  Upload,
  RefreshCw,
  Loader2,
  Sparkles,
  BarChart3,
  Boxes,
  Users,
  Download,
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  Layers,
  ChevronRight,
  ArrowUpRight,
  Send,
  Eye,
  Database,
  Info,
  FileUp,
  CheckCheck,
  Filter,
  Printer,
  FileText,
  HandHeart,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import InterestsTab from "@/app/components/InterestsTab";
import CashFlowTab, { type PricingPatch } from "@/app/components/CashFlowTab";
import {
  MULTIPLIER_OPTIONS,
  flujoDeCaja,
  formatMoney,
  isValidMultiplier,
  missingFields,
  precioPublicoTC,
  proveedorConIva,
} from "@/lib/pricing";
import { buildSearchText, matchesSearch as matchesAnyValue } from "@/lib/search";
import * as XLSX from "xlsx";
import { VSHOP_CATALOG_DICT } from "@/lib/vshop-catalog-dict";
import {
  Product,
  CartItem,
  Sale,
  SaleItem,
  Reseller,
  Consignment,
  PurchaseRecord,
  PurchaseItemDetail,
  PRESET_IMAGES,
  IVA_RATE,
  TARJETA_MARKUP,
  DEFAULT_MULTIPLIER,
  calcularCostoConIva,
  calcularGananciaSugerida,
  calcularPrecioTarjeta,
  calcularSubtotalSinIva,
  calcularSubtotalConIva,
  calcularSubtotalGanancia,
  calcularTotalVentaEfectivo,
  calcularTotalVentaTarjeta,
  calcularTotalProveedor,
  calcularMargenReal,
  calcularPorcentajeMargen,
  PRODUCT_TYPES_PRESETS,
} from "./products";

export default function PecadosPage() {
  // Store products & cart
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  // Commercial state (Sales, Resellers, Consignments)
  const [sales, setSales] = useState<Sale[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);

  // Admin state & navigation
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<"catalog" | "cashflow" | "stock" | "interests" | "purchases" | "sales" | "resellers" | "settings">("catalog");
  const [pendingInterestCount, setPendingInterestCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  // Purchase History & Supplier Purchases state
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [selectedPurchaseForDetail, setSelectedPurchaseForDetail] = useState<PurchaseRecord | null>(null);
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState("");
  const [purchaseSourceFilter, setPurchaseSourceFilter] = useState<"all" | "excel_import" | "initial_seed">("all");
  const [purchaseDetailSearchQuery, setPurchaseDetailSearchQuery] = useState("");

  // Admin WhatsApp settings (Default: 541161314128 as configured by user)
  const [whatsappNumber, setWhatsappNumber] = useState("541161314128");
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [tempWhatsapp, setTempWhatsapp] = useState("");

  // Cart payment method selection (Efectivo vs Tarjeta +10%)
  const [cartPaymentMethod, setCartPaymentMethod] = useState<"efectivo" | "tarjeta">("efectivo");

  // Stock table search and filter
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockTypeFilter, setStockTypeFilter] = useState("Todos");

  // Product modal (Add or Edit) with full VShop.xlsb business fields
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    sku: "",
    tipo: "Conjunto de lencería",
    category: "Conjunto de lencería",
    title: "",
    description: "",
    costoSinIva: 0,
    costoConIva: 0,
    multiplicadorGanancia: 2.0,
    gananciaSugerida: 0,
    precioFinalProveedor: 0,
    stock: 1,
    minStock: 2,
    price: 0, // precio efectivo
    precioEfectivo: 0,
    precioTarjeta: 0,
    observaciones: "",
    image: "/pecados/auriculares.jpg",
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Sale Modal
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState<{
    buyerName: string;
    buyerPhone: string;
    channel: "web_whatsapp" | "direct_sale" | "reseller";
    resellerId: string;
    items: { productId: string; quantity: number }[];
    paymentMethod: "efectivo" | "transferencia" | "mercadopago" | "otro";
    notes: string;
  }>({
    buyerName: "",
    buyerPhone: "",
    channel: "direct_sale",
    resellerId: "",
    items: [],
    paymentMethod: "efectivo",
    notes: "",
  });

  // Reseller Modal
  const [showResellerModal, setShowResellerModal] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [resellerForm, setResellerForm] = useState({
    name: "",
    phone: "",
    zone: "",
    commissionPercent: 15,
    notes: "",
  });

  // Consignment Modal (Entregar mercadería para revender)
  const [showConsignmentModal, setShowConsignmentModal] = useState(false);
  const [consignmentForm, setConsignmentForm] = useState({
    resellerId: "",
    productId: "",
    quantityGiven: 10,
    unitAgreedPrice: 0,
    notes: "",
  });

  // Settle Consignment Modal (Rendir mercadería)
  const [settlingConsignment, setSettlingConsignment] = useState<Consignment | null>(null);
  const [settleForm, setSettleForm] = useState({
    quantitySold: 0,
    quantityReturned: 0,
    paymentMethod: "efectivo" as const,
  });

  // Sales date filter
  const [salesDateFilter, setSalesDateFilter] = useState<"all" | "today" | "week" | "month">("all");

  // Purchase Excel Import state & types
  interface ImportPurchaseItem {
    sku: string;
    title: string;
    tipo: string;
    category: string;
    image: string;
    costoSinIva: number;
    costoConIva: number;
    multiplicador: number;
    precioEfectivo: number;
    precioTarjeta: number;
    cantidadComprada: number;
    stockActual: number;
    stockFinal: number;
    action: "new" | "restock";
    selected: boolean;
  }

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importRows, setImportRows] = useState<ImportPurchaseItem[]>([]);
  const [importStats, setImportStats] = useState<{
    totalRows: number;
    newCount: number;
    restockCount: number;
    totalUnits: number;
    totalCostConIva: number;
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [importSearchQuery, setImportSearchQuery] = useState("");
  const [importFilterTab, setImportFilterTab] = useState<"all" | "new" | "restock">("all");
  const [isImportingToDb, setIsImportingToDb] = useState(false);

  // Map of recently imported items for visual marking in Stock view
  const [recentlyImportedMap, setRecentlyImportedMap] = useState<
    Record<string, { type: "new" | "restock"; addedQty: number; previousStock: number; finalStock: number }>
  >({});
  const [onlyShowImported, setOnlyShowImported] = useState(false);
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Helper para procesar datos de planilla Excel de compra
  const processImportData = (rows: any[]) => {
    const items: ImportPurchaseItem[] = [];
    let totalUnits = 0;
    let totalCostConIva = 0;
    let newCount = 0;
    let restockCount = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const findVal = (keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
            return row[k];
          }
        }
        return "";
      };

      const rawSku = findVal(["Cod.", "Codigo", "Código", "SKU", "Cod", "Articulo", "C", "c"]);
      const sku = String(rawSku).trim().toUpperCase();
      if (!sku) continue;

      const rawQty = findVal(["#Pedida", "Cantidad", "Cant", "Cant.", "Pedida", "B", "b", "Stock"]);
      const qty = Math.max(1, parseInt(String(rawQty).replace(/[^0-9]/g, "") || "1", 10));

      const rawPU = findVal(["P.U.", "PU", "Precio Unitario", "Costo", "Costo sin IVA", "D", "d"]);
      const costoSinIva = parseFloat(String(rawPU).replace(/[^0-9.-]/g, "") || "0");

      const rawImp = findVal(["Imp.", "IVA", "Impuesto", "E", "e"]);
      const imp = parseFloat(String(rawImp).replace(/[^0-9.-]/g, "") || "0");

      const rawCostoConIva = imp > 0 ? costoSinIva + imp : (costoSinIva > 0 ? Math.round(costoSinIva * 1.21) : 0);

      const rawDesc = findVal(["Descripcion", "Descripción", "Detalle", "Producto", "Titulo", "Título", "Nombre", "Comentarios", "G", "g"]);
      const rawImage = findVal(["Imagen", "Foto", "Image", "URL", "A", "a"]);
      const rawTipo = findVal(["Tipo", "Categoria", "Categoría"]);

      // Verificar si ya existe en el catálogo actual
      const existing = products.find((p) => (p.sku || "").toUpperCase() === sku);

      if (existing) {
        restockCount++;
        const currentStock = existing.stock;
        const finalStock = currentStock + qty;
        // El costo cargado en Flujo de caja manda; sólo se toma el del Excel si no había uno
        const cSin = (existing.costoSinIva && existing.costoSinIva > 0 ? existing.costoSinIva : costoSinIva) || 0;
        const cCon = proveedorConIva(cSin);

        totalUnits += qty;
        totalCostConIva += cCon * qty;

        items.push({
          sku,
          title: existing.title,
          tipo: existing.tipo || existing.category || "General",
          category: existing.category || existing.tipo || "General",
          image: existing.image || rawImage || "/pecados/auriculares.jpg",
          costoSinIva: cSin,
          costoConIva: cCon,
          multiplicador: isValidMultiplier(existing.multiplicadorGanancia) ? existing.multiplicadorGanancia : 0,
          precioEfectivo: existing.precioEfectivo ?? 0,
          precioTarjeta: precioPublicoTC(existing.precioEfectivo ?? 0),
          cantidadComprada: qty,
          stockActual: currentStock,
          stockFinal: finalStock,
          action: "restock",
          selected: true,
        });
      } else {
        newCount++;
        const vshopMatch = VSHOP_CATALOG_DICT[sku];
        const title = vshopMatch?.title || rawDesc || `Artículo ${sku}`;
        const tipo = vshopMatch?.tipo || rawTipo || "Sex Shop";
        const category = vshopMatch?.category || rawTipo || "Sex Shop";
        const cSin = costoSinIva;
        const cCon = proveedorConIva(cSin);
        // Multiplicador y Precio Público FT los define el administrador en Flujo de caja
        const mult = 0;
        const precioEfectivo = 0;
        const precioTarjeta = 0;

        totalUnits += qty;
        totalCostConIva += cCon * qty;

        items.push({
          sku,
          title,
          tipo,
          category,
          image: rawImage || `/api/pecados/imagen/${encodeURIComponent(sku)}`,
          costoSinIva: cSin,
          costoConIva: cCon,
          multiplicador: mult,
          precioEfectivo,
          precioTarjeta,
          cantidadComprada: qty,
          stockActual: 0,
          stockFinal: qty,
          action: "new",
          selected: true,
        });
      }
    }

    if (items.length === 0) {
      setImportError("No se detectaron artículos válidos en el archivo. Verificá que contenga columnas como 'Cod.', '#Pedida' o 'P.U.'.");
      return;
    }

    setImportRows(items);
    setImportStats({
      totalRows: items.length,
      newCount,
      restockCount,
      totalUnits,
      totalCostConIva,
    });
  };

  const handleImportFileSelected = (file: File) => {
    if (!file) return;
    setImportFile(file);
    setIsParsingFile(true);
    setImportError("");
    setImportRows([]);
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setImportError("El archivo Excel no contiene hojas de datos.");
          setIsParsingFile(false);
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

        if (!data || data.length === 0) {
          setImportError("La planilla Excel está vacía.");
          setIsParsingFile(false);
          return;
        }

        processImportData(data);
      } catch (err: any) {
        console.error("Error al procesar Excel:", err);
        setImportError("Error al interpretar el archivo Excel: " + (err?.message || err));
      } finally {
        setIsParsingFile(false);
      }
    };
    reader.onerror = () => {
      setImportError("No se pudo leer el archivo seleccionado.");
      setIsParsingFile(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    const selectedItems = importRows.filter((r) => r.selected);
    if (selectedItems.length === 0) {
      alert("Por favor seleccioná al menos un artículo para importar.");
      return;
    }

    setIsImportingToDb(true);

    try {
      const newImportedMap: Record<
        string,
        { type: "new" | "restock"; addedQty: number; previousStock: number; finalStock: number }
      > = {};

      let updatedProducts = [...products];
      let addedCount = 0;
      let restockedCount = 0;
      let totalUnits = 0;
      let totalCostSinIvaSum = 0;
      let totalCostConIvaSum = 0;
      let totalSaleSum = 0;
      const purchaseItems: PurchaseItemDetail[] = [];

      for (const item of selectedItems) {
        const existingIndex = updatedProducts.findIndex(
          (p) => (p.sku || "").toUpperCase() === item.sku.toUpperCase()
        );

        const subtotalSin = Math.round(item.costoSinIva * item.cantidadComprada * 100) / 100;
        const subtotalCon = Math.round(item.costoConIva * item.cantidadComprada * 100) / 100;
        const subtotalVenta = Math.round(item.precioEfectivo * item.cantidadComprada * 100) / 100;
        totalCostSinIvaSum += subtotalSin;
        totalCostConIvaSum += subtotalCon;
        totalSaleSum += subtotalVenta;

        if (existingIndex >= 0) {
          // Sumar al stock existente
          restockedCount++;
          totalUnits += item.cantidadComprada;
          const existing = updatedProducts[existingIndex];
          const prevStock = existing.stock;
          const finalStock = existing.stock + item.cantidadComprada;

          updatedProducts[existingIndex] = {
            ...existing,
            stock: finalStock,
            costoSinIva: item.costoSinIva,
            costoConIva: item.costoConIva,
            costPrice: item.costoConIva,
            image:
              (!existing.image || existing.image.includes("auriculares")) && item.image
                ? item.image
                : existing.image,
          };

          newImportedMap[item.sku.toUpperCase()] = {
            type: "restock",
            addedQty: item.cantidadComprada,
            previousStock: prevStock,
            finalStock,
          };

          purchaseItems.push({
            sku: item.sku,
            title: item.title,
            tipo: item.tipo,
            category: item.category,
            cantidadComprada: item.cantidadComprada,
            costoSinIva: item.costoSinIva,
            costoConIva: item.costoConIva,
            subtotalCostoSinIva: subtotalSin,
            subtotalCostoConIva: subtotalCon,
            precioEfectivo: item.precioEfectivo,
            precioTarjeta: item.precioTarjeta,
            subtotalVentaEstimada: subtotalVenta,
            stockAnterior: prevStock,
            stockFinal: finalStock,
            action: "restock",
          });
        } else {
          // Crear nuevo producto en el catálogo
          addedCount++;
          totalUnits += item.cantidadComprada;
          const newProduct: Product = {
            id: "prod-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
            sku: item.sku,
            title: item.title,
            tipo: item.tipo,
            category: item.category,
            costoSinIva: item.costoSinIva,
            costoConIva: item.costoConIva,
            costPrice: item.costoConIva,
            multiplicadorGanancia: item.multiplicador,
            gananciaSugerida: item.costoConIva * item.multiplicador,
            precioEfectivo: item.precioEfectivo,
            price: item.precioEfectivo,
            precioTarjeta: item.precioTarjeta,
            precioFinalProveedor: 0,
            stock: item.cantidadComprada,
            minStock: 2,
            observaciones: "Ingresado por importación de compra Excel",
            image: item.image || "/pecados/auriculares.jpg",
            description: item.title,
          };

          updatedProducts = [newProduct, ...updatedProducts];

          newImportedMap[item.sku.toUpperCase()] = {
            type: "new",
            addedQty: item.cantidadComprada,
            previousStock: 0,
            finalStock: item.cantidadComprada,
          };

          purchaseItems.push({
            sku: item.sku,
            title: item.title,
            tipo: item.tipo,
            category: item.category,
            cantidadComprada: item.cantidadComprada,
            costoSinIva: item.costoSinIva,
            costoConIva: item.costoConIva,
            subtotalCostoSinIva: subtotalSin,
            subtotalCostoConIva: subtotalCon,
            precioEfectivo: item.precioEfectivo,
            precioTarjeta: item.precioTarjeta,
            subtotalVentaEstimada: subtotalVenta,
            stockAnterior: 0,
            stockFinal: item.cantidadComprada,
            action: "new",
          });
        }
      }

      // Crear registro de compra histórica
      const newPurchaseRecord: PurchaseRecord = {
        id: "compra-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        fileName: importFile?.name || "Compra_Importada.xlsx",
        date: new Date().toISOString(),
        source: "excel_import",
        notes: `Importación de compra (${importFile?.name || "Excel"}). ${totalUnits} unidades en ${selectedItems.length} artículos.`,
        totalItems: selectedItems.length,
        newItems: addedCount,
        restockItems: restockedCount,
        totalUnits,
        totalCostSinIva: totalCostSinIvaSum,
        totalCostConIva: totalCostConIvaSum,
        totalSaleEstimated: totalSaleSum,
        items: purchaseItems,
      };

      const updatedPurchases = [newPurchaseRecord, ...purchases];
      setPurchases(updatedPurchases);

      // Guardar en almacenamiento local y en base de datos PostgreSQL (Neon)
      await persistAllData(updatedProducts, sales, resellers, consignments, updatedPurchases);

      setRecentlyImportedMap(newImportedMap);
      setShowImportModal(false);
      setAdminTab("cashflow");
      setImportSuccessBanner(
        `Se importaron con éxito ${totalUnits} unidades en ${selectedItems.length} artículos (${addedCount} nuevos y ${restockedCount} con stock sumado). Registrado en Historial de Compras ("${newPurchaseRecord.fileName}").` +
          (addedCount > 0
            ? ` Los ${addedCount} artículos nuevos quedan INCOMPLETOS hasta que elijas el multiplicador y cargues el Precio Público FT: no se muestran en la tienda.`
            : "")
      );
    } catch (err: any) {
      alert("Error al importar la compra: " + (err?.message || err));
    } finally {
      setIsImportingToDb(false);
    }
  };

  // Exportar reporte de compra individual a CSV
  const exportSinglePurchaseCSV = (p: PurchaseRecord) => {
    const headers = [
      "SKU",
      "Titulo",
      "Tipo",
      "Categoria",
      "Cantidad Comprada",
      "Costo Unitario Sin IVA",
      "Costo Unitario Con IVA",
      "Subtotal Costo Sin IVA",
      "Subtotal Costo Con IVA",
      "Precio Venta Efectivo",
      "Precio Venta Tarjeta",
      "Subtotal Venta Estimada",
      "Stock Anterior",
      "Stock Resultante",
      "Tipo Accion",
    ];

    const rows = p.items.map((i) => [
      `"${i.sku}"`,
      `"${(i.title || "").replace(/"/g, '""')}"`,
      `"${(i.tipo || "").replace(/"/g, '""')}"`,
      `"${(i.category || "").replace(/"/g, '""')}"`,
      i.cantidadComprada,
      i.costoSinIva.toFixed(2),
      i.costoConIva.toFixed(2),
      i.subtotalCostoSinIva.toFixed(2),
      i.subtotalCostoConIva.toFixed(2),
      i.precioEfectivo.toFixed(2),
      i.precioTarjeta.toFixed(2),
      i.subtotalVentaEstimada.toFixed(2),
      i.stockAnterior,
      i.stockFinal,
      i.action === "new" ? "Nuevo Producto" : "Reingreso Stock",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = p.fileName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = p.date.slice(0, 10);
    link.href = url;
    link.setAttribute("download", `Reporte_Compra_${safeName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar resumen consolidado de todas las compras a CSV
  const exportAllPurchasesSummaryCSV = () => {
    const headers = [
      "ID Compra",
      "Fecha y Hora",
      "Nombre de Archivo",
      "Origen",
      "Total Articulos (SKUs)",
      "Nuevos Articulos",
      "Reingresos Stock",
      "Unidades Totales",
      "Inversion Total Sin IVA",
      "Inversion Total Con IVA",
      "Venta Estimada Efectivo",
      "Margen Estimado ($)",
      "Margen Estimado (%)",
      "Notas",
    ];

    const rows = purchases.map((p) => {
      const margenMonto = p.totalSaleEstimated - p.totalCostConIva;
      const margenPorc = p.totalCostConIva > 0 ? ((margenMonto / p.totalCostConIva) * 100).toFixed(1) : "0";
      return [
        `"${p.id}"`,
        `"${new Date(p.date).toLocaleString("es-AR")}"`,
        `"${p.fileName.replace(/"/g, '""')}"`,
        `"${p.source === "initial_seed" ? "Carga Inicial" : "Importacion Excel"}"`,
        p.totalItems,
        p.newItems,
        p.restockItems,
        p.totalUnits,
        p.totalCostSinIva.toFixed(2),
        p.totalCostConIva.toFixed(2),
        p.totalSaleEstimated.toFixed(2),
        margenMonto.toFixed(2),
        `${margenPorc}%`,
        `"${(p.notes || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Historial_Consolidado_Compras_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir reporte de compra
  const printPurchaseReport = () => {
    window.print();
  };

  // Resize and optimize image for seamless performance and persistence
  const compressAndSetImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor seleccioná un archivo de imagen válido (PNG, JPG, WebP, etc.).");
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        setIsUploadingImage(false);
        return;
      }

      const img = document.createElement("img");
      img.onload = () => {
        try {
          const MAX_DIM = 1000;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            setProdForm((prev) => ({ ...prev, image: dataUrl }));
          } else {
            setProdForm((prev) => ({ ...prev, image: result }));
          }
        } catch {
          setProdForm((prev) => ({ ...prev, image: result }));
        } finally {
          setIsUploadingImage(false);
        }
      };

      img.onerror = () => {
        setIsUploadingImage(false);
        alert("No se pudo procesar la imagen seleccionada.");
      };

      img.src = result;
    };

    reader.onerror = () => {
      setIsUploadingImage(false);
      alert("Error al leer el archivo.");
    };

    reader.readAsDataURL(file);
  };

  // Sync states
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  const [isSavingServer, setIsSavingServer] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [dbDetails, setDbDetails] = useState<string | null>(null);
  const [dbEngine, setDbEngine] = useState<string | null>(null);
  const [showDbModal, setShowDbModal] = useState<boolean>(false);

  // Fetch full commercial state directly from PostgreSQL database API
  const fetchServerData = async () => {
    try {
      setIsLoadingServer(true);
      const res = await fetch("/api/pecados/productos", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();

        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        if (data.sales && Array.isArray(data.sales)) {
          setSales(data.sales);
        }
        if (data.resellers && Array.isArray(data.resellers)) {
          setResellers(data.resellers);
        }
        if (data.consignments && Array.isArray(data.consignments)) {
          setConsignments(data.consignments);
        }
        if (data.purchases && Array.isArray(data.purchases)) {
          setPurchases(data.purchases);
        }
        if (data.whatsappNumber) {
          setWhatsappNumber(data.whatsappNumber);
        }
        if (data.dbDetails) setDbDetails(data.dbDetails);
        if (data.dbEngine) setDbEngine(data.dbEngine);
        setCloudStatus(data.source || (data.hasCloudStorage ? "postgresql_prisma" : "server_memory"));
      }
    } catch (err) {
      console.error("Error al sincronizar con la base de datos:", err);
    } finally {
      setIsLoadingServer(false);
    }
  };

  // Save all commercial data directly to PostgreSQL database
  const persistAllData = async (
    newProds = products,
    newSales = sales,
    newResellers = resellers,
    newConsignments = consignments,
    newPurchases = purchases,
    newWhatsapp?: string
  ) => {
    // 1. Optimistic state update in memory
    setProducts(newProds);
    setSales(newSales);
    setResellers(newResellers);
    setConsignments(newConsignments);
    setPurchases(newPurchases);
    if (newWhatsapp) setWhatsappNumber(newWhatsapp);

    // 2. Centralized server persist to PostgreSQL
    setIsSavingServer(true);
    try {
      const res = await fetch("/api/pecados/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: newProds,
          sales: newSales,
          resellers: newResellers,
          consignments: newConsignments,
          purchases: newPurchases,
          whatsappNumber: newWhatsapp ?? whatsappNumber,
        }),
      });

      if (res.status === 401) {
        setIsAdmin(false);
        alert("Tu sesión de administrador expiró. Ingresá de nuevo; los últimos cambios no se guardaron.");
        fetchServerData();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.postgresSaved || data.cloudSaved || data.source === "postgresql_prisma") {
          setCloudStatus("postgresql_prisma");
        } else if (data.hasPostgres) {
          setCloudStatus("fallback_memory");
        } else {
          setCloudStatus("server_memory");
        }
      }
    } catch (err) {
      console.error("Error al publicar datos en el servidor:", err);
    } finally {
      setIsSavingServer(false);
    }
  };

  // Client buyer info
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  // Producto sin stock pendiente de confirmar "Me interesa" (modal de aviso)
  const [interestConfirmProduct, setInterestConfirmProduct] = useState<Product | null>(null);
  // Aviso temporal al agregar un producto con stock (el carrito no se abre)
  const [cartToast, setCartToast] = useState<{ title: string; qty: number } | null>(null);
  const cartToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from PostgreSQL database on mount & purge any legacy localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Purgar claves residuales de localStorage
        const legacyKeys = [
          "multipaginas_pecados_products",
          "multipaginas_pecados_sales",
          "multipaginas_pecados_resellers",
          "multipaginas_pecados_consignments",
          "multipaginas_pecados_purchases",
          "multipaginas_pecados_safety_products",
          "multipaginas_pecados_safety_sales",
          "multipaginas_pecados_safety_resellers",
          "multipaginas_pecados_safety_consignments",
          "multipaginas_pecados_safety_purchases",
          "multipaginas_pecados_safety_timestamp",
          "multipaginas_pecados_customized",
          "multipaginas_pecados_updated_at",
          "multipaginas_pecados_whatsapp",
          "multipaginas_pecados_admin",
        ];
        legacyKeys.forEach((key) => localStorage.removeItem(key));
        sessionStorage.removeItem("multipaginas_pecados_admin");
      }
    } catch (e) {
      console.warn("Aviso al purgar localStorage:", e);
    }

    // La sesión de administrador la valida el servidor (cookie HttpOnly)
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.isAdmin) {
          setIsAdmin(true);
          setIsCartOpen(false);
          setCart([]);
        }
      })
      .catch(() => {});

    fetchServerData();
  }, []);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: loginUser.trim(), password: loginPass }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setLoginError(data?.error || "Usuario o contraseña incorrectos.");
        return;
      }
      setIsAdmin(true);
      setIsCartOpen(false);
      setCart([]);
      setShowLoginModal(false);
      setLoginUser("");
      setLoginPass("");
      // Cargar el estado comercial completo (costos, ventas, revendedores) ya autenticado
      await fetchServerData();
    } catch {
      setLoginError("No se pudo conectar con el servidor.");
    }
  };

  // Logout handler
  const handleLogout = () => {
    setIsAdmin(false);
    fetch("/api/auth/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        // Descartar de memoria los datos internos y recargar sólo el catálogo público
        setSales([]);
        setResellers([]);
        setConsignments([]);
        setPurchases([]);
        fetchServerData();
      });
  };

  // Cantidad de productos con interesados pendientes (badge de la pestaña)
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/interesados", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.interests) return;
        const skus = new Set<string>(
          d.interests
            .filter((i: { status: string }) => i.status === "pending")
            .map((i: { productSku: string }) => i.productSku)
        );
        setPendingInterestCount(skus.size);
      })
      .catch(() => {});
  }, [isAdmin]);

  // Save WhatsApp number directly to PostgreSQL
  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tempWhatsapp.replace(/[^0-9]/g, "");
    if (clean.length < 8) {
      alert("Por favor ingresá un número de teléfono válido con código de país (ej: 541161314128).");
      return;
    }
    setWhatsappNumber(clean);
    setShowWhatsappModal(false);

    try {
      await fetch("/api/pecados/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: clean,
        }),
      });
    } catch (err) {
      console.error("Error guardando WhatsApp en base de datos:", err);
    }
  };

  // Cart operations (deshabilitadas en Modo Administrador)
  // Máximo de unidades para "Me interesa" (productos sin stock)
  const MAX_INTEREST_QTY = 10;
  const cartItemMax = (product: Product, interest?: boolean) =>
    interest ? MAX_INTEREST_QTY : product.stock;

  const addToCart = (product: Product, quantity = 1) => {
    if (isAdmin) return;
    // Sin stock: se agrega como "Me interesa" (no es una compra ni descuenta stock)
    const interest = product.stock <= 0;
    const max = cartItemMax(product, interest);

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, cartItemMax(product, existing.interest));
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, max), interest }];
    });

    if (interest) {
      // "Me interesa" ya pasó por el aviso de confirmación: se continúa al carrito
      setIsCartOpen(true);
    } else {
      // Compra normal: no abrir el carrito, sólo avisar que se agregó
      const current = cart.find((item) => item.product.id === product.id)?.quantity || 0;
      showCartToast(product.title, Math.min(current + quantity, max));
    }
  };

  // Aviso temporal "Agregado al carrito"
  const showCartToast = (title: string, qty: number) => {
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    setCartToast({ title, qty });
    cartToastTimer.current = setTimeout(() => setCartToast(null), 2500);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    if (isAdmin) return;
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const currentStock = products.find((p) => p.id === productId)?.stock || item.product.stock;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: Math.min(newQty, item.interest ? MAX_INTEREST_QTY : currentStock) };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Price resolver based on payment method (Efectivo vs Tarjeta +10% formula)
  // Precio único de la tienda: Precio Público TC (=FT*10/100+FT).
  // El catálogo público ya llega con el TC calculado por el servidor (sin FT).
  const getItemUnitPrice = (product: Product, _method?: "efectivo" | "tarjeta"): number => {
    if (product.precioEfectivo) return precioPublicoTC(product.precioEfectivo);
    return product.precioTarjeta || product.price || 0;
  };

  const purchaseCartItems = cart.filter((item) => !item.interest);
  const interestCartItems = cart.filter((item) => item.interest);
  const cartTotal = purchaseCartItems.reduce((sum, item) => sum + getItemUnitPrice(item.product, cartPaymentMethod) * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Checkout WhatsApp generator + Automatic Sale Record
  const handleCheckoutWhatsApp = () => {
    if (cart.length === 0) return;
    const hasPurchase = purchaseCartItems.length > 0;
    const hasInterest = interestCartItems.length > 0;

    let message = hasPurchase
      ? "🔥 *¡Hola Pecados Serranos!* Quiero realizar el siguiente pedido:\n\n"
      : "🔥 *¡Hola Pecados Serranos!* Me interesan estos productos que hoy están sin stock:\n\n";
    if (hasPurchase) {
      message += "📦 *Detalle del Pedido:*\n";
    }

    const saleItems: SaleItem[] = [];

    purchaseCartItems.forEach((item) => {
      const unitP = getItemUnitPrice(item.product, cartPaymentMethod);
      const itemSubtotal = unitP * item.quantity;
      const skuText = item.product.sku ? ` [Cod: ${item.product.sku}]` : "";
      const tipoText = item.product.tipo ? ` (${item.product.tipo})` : "";
      message += `• ${item.quantity}x ${item.product.title}${skuText}${tipoText} — ${formatMoney(itemSubtotal)} (${formatMoney(unitP)} c/u)\n`;

      saleItems.push({
        productId: item.product.id,
        productSku: item.product.sku || "S/C",
        productTitle: item.product.title,
        quantity: item.quantity,
        unitPrice: unitP,
        subtotal: itemSubtotal,
      });
    });

    if (hasPurchase) {
      message += `\n💰 *Total a Pagar:* ${formatMoney(cartTotal)}\n`;
    }

    if (hasInterest) {
      message += hasPurchase ? "\n🙋 *Además me interesan (sin stock):*\n" : "🙋 *Me interesan:*\n";
      interestCartItems.forEach((item) => {
        const skuText = item.product.sku ? ` [Cod: ${item.product.sku}]` : "";
        message += `• ${item.quantity}x ${item.product.title}${skuText}\n`;
      });
      message += "Avisame cuando vuelvan a entrar, por favor.\n";
    }

    if (buyerName.trim()) {
      message += `👤 *Cliente:* ${buyerName.trim()}\n`;
    }
    if (buyerAddress.trim()) {
      message += `📍 *Dirección/Entrega:* ${buyerAddress.trim()}\n`;
    }

    message += hasPurchase
      ? "\n¿Me confirman disponibilidad y coordinamos la entrega? ¡Muchas gracias!"
      : "\n¡Muchas gracias!";

    // Deduct stock locally (sólo productos comprados, no los de interés)
    const updatedProducts = products.map((p) => {
      const inCart = purchaseCartItems.find((c) => c.product.id === p.id);
      if (inCart) {
        return { ...p, stock: Math.max(0, p.stock - inCart.quantity) };
      }
      return p;
    });

    // Registrar el pedido en el servidor (precios y stock se validan del lado del servidor)
    setProducts(updatedProducts);
    const requests: Promise<unknown>[] = [];
    if (hasPurchase) {
      requests.push(
        fetch("/api/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: saleItems.map((i) => ({ sku: i.productSku, quantity: i.quantity })),
            buyerName: buyerName.trim(),
            buyerAddress: buyerAddress.trim(),
          }),
        }).catch((err) => console.error("Error registrando el pedido:", err))
      );
    }
    if (hasInterest) {
      // Registro de interés: no es una venta ni descuenta stock
      requests.push(
        fetch("/api/interes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: interestCartItems.map((i) => ({ sku: i.product.sku, quantity: i.quantity })),
            buyerName: buyerName.trim(),
            buyerAddress: buyerAddress.trim(),
          }),
        }).catch((err) => console.error("Error registrando el interés:", err))
      );
    }
    Promise.all(requests).finally(() => fetchServerData());

    // Clear cart & notify
    setCart([]);
    setOrderSuccess(true);

    const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");

    setTimeout(() => {
      setOrderSuccess(false);
      setIsCartOpen(false);
    }, 3000);
  };

  // Product CRUD (Admin) with full VShop.xlsb business fields & formulas
  const openAddProductModal = () => {
    // Generate automatic next SKU
    const count = products.length + 1;
    const nextSku = `PEC-${String(count).padStart(3, "0")}`;
    // Artículo nuevo: los valores del flujo de caja se cargan a mano (sin valores inventados)
    const initialCostSinIva = 0;
    const initialCostConIva = 0;
    const initialMultiplier = 0;
    const initialSuggested = 0;
    const initialPriceEfectivo = 0;
    const initialPriceTarjeta = 0;

    setEditingProduct(null);
    setProdForm({
      sku: nextSku,
      tipo: "Conjunto de lencería",
      category: "Conjunto de lencería",
      title: "",
      description: "",
      costoSinIva: initialCostSinIva,
      costoConIva: initialCostConIva,
      multiplicadorGanancia: initialMultiplier,
      gananciaSugerida: initialSuggested,
      precioFinalProveedor: 0,
      stock: 1,
      minStock: 2,
      price: initialPriceEfectivo,
      precioEfectivo: initialPriceEfectivo,
      precioTarjeta: initialPriceTarjeta,
      observaciones: "",
      image: PRESET_IMAGES[0].url,
    });
    setShowUrlInput(false);
    setShowProductModal(true);
  };

  const openEditProductModal = (p: Product) => {
    const c = flujoDeCaja(p);
    const cSinIva = c.proveedorSinIva;
    const cConIva = c.proveedorConIva;
    const mult = c.multiplicador;
    const sug = c.ganancia;
    const pEfec = c.precioPublicoFT;
    const pTarj = c.precioPublicoTC;

    setEditingProduct(p);
    setProdForm({
      sku: p.sku || `PEC-${p.id.slice(-3)}`,
      tipo: p.tipo || p.category || "Conjunto de lencería",
      category: p.category || p.tipo || "Conjunto de lencería",
      title: p.title,
      description: p.description,
      costoSinIva: cSinIva,
      costoConIva: cConIva,
      multiplicadorGanancia: mult,
      gananciaSugerida: sug,
      precioFinalProveedor: p.precioFinalProveedor || 0,
      stock: p.stock,
      minStock: p.minStock ?? 2,
      price: pEfec,
      precioEfectivo: pEfec,
      precioTarjeta: pTarj,
      observaciones: p.observaciones || "",
      image: p.image,
    });
    setShowUrlInput(false);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("¿Seguro que deseás eliminar este producto del catálogo?")) return;
    try {
      const res = await fetch("/api/pecados/productos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 401) {
        setIsAdmin(false);
        alert("Tu sesión de administrador expiró. Ingresá de nuevo para eliminar el producto.");
        return;
      }
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "No se pudo eliminar el producto.");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      removeFromCart(id);
    } catch {
      alert("No se pudo conectar con el servidor para eliminar el producto.");
    }
  };

  const handleResetCatalog = () => {
    if (window.confirm("¿Seguro que querés restablecer el producto de prueba inicial?")) {
      fetch("/api/pecados/productos?initial=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => persistAllData(d.products, sales, resellers, consignments))
        .catch(() => alert("No se pudo obtener el catálogo inicial. Volvé a ingresar como administrador."));
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.title.trim()) {
      alert("Ingresá un título o descripción para el producto.");
      return;
    }

    const cleanSku = prodForm.sku.trim().toUpperCase() || `PEC-${Date.now().toString().slice(-4)}`;
    // Fórmulas del flujo de caja (mismas que la planilla y que el servidor)
    const costSinIva = Math.max(0, Number(prodForm.costoSinIva) || 0);
    const costConIva = proveedorConIva(costSinIva);
    const multVal = Number(prodForm.multiplicadorGanancia);
    const mult = isValidMultiplier(multVal) ? multVal : 0;
    const sug = costConIva * mult;
    const pEfec = Math.max(0, Number(prodForm.precioEfectivo) || 0);
    const pTarj = precioPublicoTC(pEfec);
    const pProv = Math.max(0, Number(prodForm.precioFinalProveedor) || 0);
    const stockQty = Math.max(0, Number(prodForm.stock) || 0);
    const minStockQty = Math.max(0, Number(prodForm.minStock) || 0);
    const tipoVal = prodForm.tipo.trim() || "Conjunto de lencería";

    if (editingProduct) {
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              sku: cleanSku,
              tipo: tipoVal,
              category: tipoVal,
              title: prodForm.title.trim(),
              description: prodForm.description.trim(),
              costoSinIva: costSinIva,
              costoConIva: costConIva,
              costPrice: costConIva,
              multiplicadorGanancia: mult,
              gananciaSugerida: sug,
              price: pEfec,
              precioEfectivo: pEfec,
              precioTarjeta: pTarj,
              precioFinalProveedor: pProv,
              stock: stockQty,
              minStock: minStockQty,
              observaciones: prodForm.observaciones.trim(),
              image: prodForm.image || "/pecados/auriculares.jpg",
            }
          : p
      );
      persistAllData(updated, sales, resellers, consignments);
    } else {
      const newProd: Product = {
        id: "pecado-" + Date.now(),
        sku: cleanSku,
        tipo: tipoVal,
        category: tipoVal,
        title: prodForm.title.trim(),
        description: prodForm.description.trim(),
        costoSinIva: costSinIva,
        costoConIva: costConIva,
        costPrice: costConIva,
        multiplicadorGanancia: mult,
        gananciaSugerida: sug,
        price: pEfec,
        precioEfectivo: pEfec,
        precioTarjeta: pTarj,
        precioFinalProveedor: pProv,
        stock: stockQty,
        minStock: minStockQty,
        observaciones: prodForm.observaciones.trim(),
        image: prodForm.image || "/pecados/auriculares.jpg",
      };
      persistAllData([newProd, ...products], sales, resellers, consignments);
    }
    setShowProductModal(false);

    const missing = missingFields({
      sku: cleanSku,
      title: prodForm.title,
      costoSinIva: costSinIva,
      multiplicadorGanancia: mult,
      precioEfectivo: pEfec,
    });
    if (missing.length > 0) {
      alert(
        `El artículo se guardó, pero está INCOMPLETO y no se mostrará en la tienda.\n\nFalta: ${missing.join(", ")}.\n\nPodés completarlo en la pestaña "Flujo de caja".`
      );
    }
  };

  // Edición en línea desde Flujo de caja (el servidor recalcula los valores derivados)
  const handleUpdateProductPricing = (id: string, patch: PricingPatch) => {
    const updated = products.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      const conIva = proveedorConIva(next.costoSinIva || 0);
      const mult = isValidMultiplier(next.multiplicadorGanancia) ? next.multiplicadorGanancia : 0;
      const ft = next.precioEfectivo || 0;
      return {
        ...next,
        costoConIva: conIva,
        costPrice: conIva,
        multiplicadorGanancia: mult,
        gananciaSugerida: conIva * mult,
        precioEfectivo: ft,
        price: ft,
        precioTarjeta: precioPublicoTC(ft),
      };
    });
    persistAllData(updated, sales, resellers, consignments);
  };

  // Descargar del proveedor las fotos faltantes y guardarlas en la base
  const [isSyncingImages, setIsSyncingImages] = useState(false);
  const handleSyncProductImages = async () => {
    setIsSyncingImages(true);
    try {
      const res = await fetch("/api/admin/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || "No se pudieron descargar las fotos.");
        return;
      }
      await fetchServerData();
      alert(
        `Fotos guardadas en la base: ${data.saved.length} de ${data.total}.` +
          (data.missing.length ? `\n\nSin foto en el proveedor: ${data.missing.join(", ")}` : "")
      );
    } finally {
      setIsSyncingImages(false);
    }
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportRows([]);
    setImportStats(null);
    setImportError("");
    setShowImportModal(true);
  };

  // Quick adjust stock from stock table
  const handleQuickAdjustStock = (productId: string, delta: number) => {
    const updated = products.map((p) =>
      p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p
    );
    persistAllData(updated, sales, resellers, consignments);
  };

  // Reseller CRUD
  const openAddResellerModal = () => {
    setEditingReseller(null);
    setResellerForm({
      name: "",
      phone: "",
      zone: "",
      commissionPercent: 15,
      notes: "",
    });
    setShowResellerModal(true);
  };

  const handleSaveReseller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellerForm.name.trim()) {
      alert("Ingresá el nombre del revendedor.");
      return;
    }

    if (editingReseller) {
      const updated = resellers.map((r) =>
        r.id === editingReseller.id
          ? {
              ...r,
              name: resellerForm.name.trim(),
              phone: resellerForm.phone.replace(/[^0-9]/g, ""),
              zone: resellerForm.zone.trim(),
              commissionPercent: Number(resellerForm.commissionPercent) || 0,
              notes: resellerForm.notes.trim(),
            }
          : r
      );
      persistAllData(products, sales, updated, consignments);
    } else {
      const newRes: Reseller = {
        id: "res-" + Date.now(),
        name: resellerForm.name.trim(),
        phone: resellerForm.phone.replace(/[^0-9]/g, ""),
        zone: resellerForm.zone.trim() || "Local",
        commissionPercent: Number(resellerForm.commissionPercent) || 0,
        notes: resellerForm.notes.trim(),
        createdAt: new Date().toISOString(),
      };
      persistAllData(products, sales, [newRes, ...resellers], consignments);
    }
    setShowResellerModal(false);
  };

  const handleDeleteReseller = (id: string) => {
    if (window.confirm("¿Seguro que deseás dar de baja este revendedor?")) {
      const updated = resellers.filter((r) => r.id !== id);
      persistAllData(products, sales, updated, consignments);
    }
  };

  // Consignment delivery handler (Entregar mercadería para revender)
  const handleSaveConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    const reseller = resellers.find((r) => r.id === consignmentForm.resellerId);
    const product = products.find((p) => p.id === consignmentForm.productId);

    if (!reseller || !product) {
      alert("Seleccioná un revendedor y un producto.");
      return;
    }

    const qty = Number(consignmentForm.quantityGiven) || 0;
    if (qty <= 0) {
      alert("La cantidad entregada debe ser mayor a 0.");
      return;
    }

    if (qty > product.stock) {
      alert(`No hay stock suficiente en depósito. Stock disponible: ${product.stock} un.`);
      return;
    }

    // Deduct from warehouse stock
    const updatedProducts = products.map((p) =>
      p.id === product.id ? { ...p, stock: p.stock - qty } : p
    );

    const newConsignment: Consignment = {
      id: "cons-" + Date.now(),
      resellerId: reseller.id,
      resellerName: reseller.name,
      date: new Date().toISOString(),
      productId: product.id,
      productSku: product.sku || "S/C",
      productTitle: product.title,
      quantityGiven: qty,
      unitAgreedPrice: Number(consignmentForm.unitAgreedPrice) || product.price,
      quantitySold: 0,
      quantityReturned: 0,
      status: "active",
      notes: consignmentForm.notes.trim(),
    };

    const updatedConsignments = [newConsignment, ...consignments];
    persistAllData(updatedProducts, sales, resellers, updatedConsignments);
    setShowConsignmentModal(false);
  };

  // Settle consignment (Rendir cuentas con revendedor)
  const handleSettleConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingConsignment) return;

    const sold = Number(settleForm.quantitySold) || 0;
    const returned = Number(settleForm.quantityReturned) || 0;

    if (sold + returned > settlingConsignment.quantityGiven) {
      alert(`La suma de vendidos (${sold}) y devueltos (${returned}) supera lo entregado (${settlingConsignment.quantityGiven}).`);
      return;
    }

    // 1. Reingresar las unidades devueltas al stock del depósito
    const updatedProducts = products.map((p) =>
      p.id === settlingConsignment.productId ? { ...p, stock: p.stock + returned } : p
    );

    // 2. Si vendió unidades, registrar venta comercial
    let updatedSales = sales;
    if (sold > 0) {
      const reseller = resellers.find((r) => r.id === settlingConsignment.resellerId);
      const subtotal = sold * settlingConsignment.unitAgreedPrice;
      const commissionRate = reseller ? reseller.commissionPercent / 100 : 0;
      const commissionAmount = subtotal * commissionRate;
      const netToCollect = subtotal - commissionAmount;

      const newSale: Sale = {
        id: "sale-res-" + Date.now(),
        date: new Date().toISOString(),
        buyerName: `Venta Revendedor: ${settlingConsignment.resellerName}`,
        channel: "reseller",
        resellerId: settlingConsignment.resellerId,
        resellerName: settlingConsignment.resellerName,
        items: [
          {
            productId: settlingConsignment.productId,
            productSku: settlingConsignment.productSku,
            productTitle: settlingConsignment.productTitle,
            quantity: sold,
            unitPrice: settlingConsignment.unitAgreedPrice,
            subtotal,
          },
        ],
        totalAmount: subtotal,
        paymentMethod: settleForm.paymentMethod,
        status: "completed",
        notes: `Rendición de lote. Comisión revendedor: $${commissionAmount.toLocaleString("es-AR")} (${reseller?.commissionPercent}%). Neto cobrado: $${netToCollect.toLocaleString("es-AR")}.`,
      };
      updatedSales = [newSale, ...sales];
    }

    // 3. Actualizar estado de la consignación
    const updatedConsignments = consignments.map((c) =>
      c.id === settlingConsignment.id
        ? {
            ...c,
            quantitySold: c.quantitySold + sold,
            quantityReturned: c.quantityReturned + returned,
            status: (sold + returned >= c.quantityGiven ? "settled" : "active") as "active" | "settled",
          }
        : c
    );

    persistAllData(updatedProducts, updatedSales, resellers, updatedConsignments);
    setSettlingConsignment(null);
  };

  // Manual Sale Handler
  const handleCreateManualSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (saleForm.items.length === 0) {
      alert("Agregá al menos un producto a la venta.");
      return;
    }

    const saleItems: SaleItem[] = [];
    let total = 0;
    let updatedProducts = [...products];

    for (const item of saleForm.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;
      if (item.quantity > prod.stock) {
        alert(`No hay suficiente stock para "${prod.title}". Stock disponible: ${prod.stock}`);
        return;
      }
      const subtotal = prod.price * item.quantity;
      total += subtotal;
      saleItems.push({
        productId: prod.id,
        productSku: prod.sku || "S/C",
        productTitle: prod.title,
        quantity: item.quantity,
        unitPrice: prod.price,
        subtotal,
      });

      // Deduct stock
      updatedProducts = updatedProducts.map((p) =>
        p.id === prod.id ? { ...p, stock: p.stock - item.quantity } : p
      );
    }

    const resellerObj = resellers.find((r) => r.id === saleForm.resellerId);

    const newSale: Sale = {
      id: "sale-" + Date.now(),
      date: new Date().toISOString(),
      buyerName: saleForm.buyerName.trim() || "Cliente Mostrador / Venta Directa",
      buyerPhone: saleForm.buyerPhone.trim(),
      channel: saleForm.channel,
      resellerId: resellerObj?.id,
      resellerName: resellerObj?.name,
      items: saleItems,
      totalAmount: total,
      paymentMethod: saleForm.paymentMethod,
      status: "completed",
      notes: saleForm.notes.trim(),
    };

    persistAllData(updatedProducts, [newSale, ...sales], resellers, consignments);
    setShowSaleModal(false);
    setSaleForm({
      buyerName: "",
      buyerPhone: "",
      channel: "direct_sale",
      resellerId: "",
      items: [],
      paymentMethod: "efectivo",
      notes: "",
    });
  };

  // Delete sale record
  const handleDeleteSale = (saleId: string) => {
    if (window.confirm("¿Seguro que deseás anular/eliminar este registro de venta?")) {
      const updated = sales.filter((s) => s.id !== saleId);
      persistAllData(products, updated, resellers, consignments);
    }
  };

  // Export Stock CSV matching VShop.xlsb structure and formulas
  const exportStockCSV = () => {
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    const headers = ["CODIGO", "DESCRIPCION", "TIPO", "CANTIDAD", "PRECIO PUBLICO FT", "PRECIO PUBLICO TC"];
    const rows = products.map((p) => {
      const c = flujoDeCaja(p);
      return [esc(p.sku || ""), esc(p.title), esc(p.tipo || p.category || ""), p.stock, c.precioPublicoFT, c.precioPublicoTC];
    });
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Stock_Pecados_Serranos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Sales CSV
  const exportSalesCSV = () => {
    const headers = ["FECHA", "ID_VENTA", "CLIENTE", "CANAL", "REVENDEDOR", "PRODUCTOS", "CANT_ITEMS", "TOTAL_ARS", "MEDIO_PAGO", "NOTAS"];
    const rows = sales.map((s) => {
      const itemsSummary = s.items.map((i) => `${i.quantity}x ${i.productTitle} (${i.productSku})`).join(" + ");
      return [
        new Date(s.date).toLocaleString("es-AR"),
        s.id,
        `"${(s.buyerName || "Cliente").replace(/"/g, '""')}"`,
        s.channel === "web_whatsapp" ? "Web WhatsApp" : s.channel === "reseller" ? "Revendedor" : "Venta Directa",
        `"${(s.resellerName || "-").replace(/"/g, '""')}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        s.items.reduce((sum, i) => sum + i.quantity, 0),
        s.totalAmount,
        s.paymentMethod.toUpperCase(),
        `"${(s.notes || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ventas_Pecados_Serranos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Full JSON Backup
  const exportBackupJSON = () => {
    const backup = {
      store: "Pecados Serranos",
      exportedAt: new Date().toISOString(),
      whatsappNumber,
      products,
      sales,
      resellers,
      consignments,
      purchases,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Backup_Pecados_Serranos_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restore JSON Backup directly to PostgreSQL
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.products && Array.isArray(json.products)) {
          if (window.confirm("¿Restaurar esta copia de seguridad? Se sincronizará directamente en la base de datos PostgreSQL.")) {
            persistAllData(
              json.products,
              json.sales || [],
              json.resellers || resellers,
              json.consignments || [],
              json.purchases || [],
              json.whatsappNumber || undefined
            );
            alert("¡Copia de seguridad restaurada con éxito en la base de datos PostgreSQL!");
          }
        } else {
          alert("El archivo no tiene el formato válido de respaldo de Pecados Serranos.");
        }
      } catch {
        alert("Error al leer el archivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  // Stock KPI Computations matching VShop.xlsb exact formulas
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalCostSinIva = products.reduce((sum, p) => sum + calcularSubtotalSinIva(p), 0);
  const totalCostConIva = products.reduce((sum, p) => sum + calcularSubtotalConIva(p), 0);
  const totalSugerido = products.reduce((sum, p) => sum + calcularSubtotalGanancia(p), 0);
  const totalVentaEfectivo = products.reduce((sum, p) => sum + calcularTotalVentaEfectivo(p), 0);
  const totalVentaTarjeta = products.reduce((sum, p) => sum + calcularTotalVentaTarjeta(p), 0);
  const totalInversionProveedor = products.reduce((sum, p) => sum + calcularTotalProveedor(p), 0);
  const totalMargenRealEfectivo = totalVentaEfectivo - totalCostConIva;
  const porcentajeMargenRealGlobal = totalCostConIva > 0 ? (totalMargenRealEfectivo / totalCostConIva) * 100 : 0;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= (p.minStock ?? 2)).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const incompleteProductsCount = products.filter((p) => missingFields(p).length > 0).length;

  // Filtered products for stock tab
  const filteredStockProducts = products.filter((p) => {
    if (onlyShowImported && !recentlyImportedMap[(p.sku || "").toUpperCase()]) {
      return false;
    }
    const c = flujoDeCaja(p);
    const missing = missingFields(p);
    const matchesSearch = matchesAnyValue(
      buildSearchText([
        p.sku,
        p.title,
        p.tipo,
        p.category,
        p.stock <= 0 ? "sin stock" : "",
        missing.length ? `incompleto ${missing.join(" ")}` : "completo",
        p.stock,
        c.precioPublicoFT,
        c.precioPublicoTC,
      ]),
      stockSearchQuery
    );

    const matchesType =
      stockTypeFilter === "Todos" ||
      p.tipo === stockTypeFilter ||
      p.category === stockTypeFilter;

    return matchesSearch && matchesType;
  });

  // Sales KPI Computations with Date Filtering
  const filteredSales = sales.filter((s) => {
    if (salesDateFilter === "all") return true;
    const saleDate = new Date(s.date);
    const now = new Date();
    if (salesDateFilter === "today") {
      return saleDate.toDateString() === now.toDateString();
    }
    if (salesDateFilter === "week") {
      const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    }
    if (salesDateFilter === "month") {
      return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalItemsSold = filteredSales.reduce(
    (sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.quantity, 0),
    0
  );
  const averageTicket = filteredSales.length > 0 ? totalSalesRevenue / filteredSales.length : 0;

  // Filter categories
  const categories = ["Todos", ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "Todos" || p.category === selectedCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0506] text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Background ambient fiery glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-red-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-rose-700/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-10 -left-40 w-[600px] h-[500px] bg-red-900/15 rounded-full blur-[150px]" />
      </div>

      {/* Admin Top Sticky Bar & Navigation */}
      {isAdmin && (
        <div className="bg-red-950/95 border-b border-red-800/60 sticky top-0 z-50 backdrop-blur-md text-xs shadow-xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Brand & KV status */}
              <div className="flex items-center justify-between sm:justify-start gap-2 text-red-200">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-bold text-white text-xs sm:text-sm">Panel Admin</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDbModal(true)}
                  title="Hacé clic para ver el diagnóstico detallado de conexión a la base de datos"
                  className="cursor-pointer transition-transform hover:scale-105 active:scale-95 text-left"
                >
                  {cloudStatus === "postgresql_prisma" || cloudStatus === "cloud_kv" || cloudStatus === "cloud_kv_full" ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700 text-[10px] font-bold flex items-center gap-1 shadow-xs hover:border-emerald-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      PostgreSQL Conectada
                    </span>
                  ) : cloudStatus === "fallback_memory" ? (
                    <span className="px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-700 text-[10px] font-bold flex items-center gap-1 hover:border-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                      Error Conexión DB (Ver info)
                    </span>
                  ) : cloudStatus === "local_protected" ? (
                    <span className="px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700 text-[10px] font-medium flex items-center gap-1 hover:border-blue-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Local Protegido (Ver DB)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/80 text-[10px] font-medium flex items-center gap-1 hover:border-amber-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Memoria / Pendiente DB (Clic aquí)
                    </span>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                <button
                  onClick={openAddProductModal}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1 shadow-md shadow-red-950 transition-all cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Agregar</span> Producto
                </button>
                <button
                  onClick={() => fetchServerData()}
                  disabled={isLoadingServer}
                  title="Sincronizar con la base de datos"
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServer ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => {
                    setTempWhatsapp(whatsappNumber);
                    setShowWhatsappModal(true);
                  }}
                  className="px-2 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center gap-1 transition-colors cursor-pointer text-[11px] sm:text-xs"
                >
                  <Phone className="w-3 h-3 text-green-400" /> WhatsApp
                </button>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-red-300 border border-red-900/60 font-medium transition-colors cursor-pointer text-xs"
                >
                  Salir
                </button>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="mt-2 pt-1.5 border-t border-red-900/40 flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              <button
                onClick={() => setAdminTab("catalog")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "catalog"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Catálogo ({products.length})
              </button>
              <button
                onClick={() => setAdminTab("cashflow")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "cashflow"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" /> Flujo de caja
                {incompleteProductsCount > 0 && (
                  <span
                    className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center"
                    title="Productos incompletos (no se muestran en la tienda)"
                  >
                    {incompleteProductsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAdminTab("stock")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "stock"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <Boxes className="w-3.5 h-3.5" /> Stock ({totalStockUnits} un.)
                {lowStockCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
              <button
                onClick={() => setAdminTab("interests")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "interests"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <HandHeart className="w-3.5 h-3.5" /> Interesados / Pedido
                {pendingInterestCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                    {pendingInterestCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAdminTab("purchases")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "purchases"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Compras / Proveedores ({purchases.length})
              </button>
              <button
                onClick={() => setAdminTab("sales")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "sales"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Ventas ({sales.length})
              </button>
              <button
                onClick={() => setAdminTab("resellers")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "resellers"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Revendedores ({resellers.length})
              </button>
              <button
                onClick={() => setAdminTab("settings")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "settings"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <Download className="w-3.5 h-3.5" /> Respaldos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Store Header (en modo admin no se muestra: la barra del panel ya tiene "Salir") */}
      {!isAdmin && (
      <header className="relative z-40 w-full border-b border-red-950/40 bg-black/75 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-end gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Admin toggle button & Cart Trigger */}
            {!isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Modo</span> Admin
                </button>

                {/* Cart Trigger (solo clientes públicos) */}
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="relative p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold flex items-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-red-950/60 cursor-pointer"
                  aria-label="Ver carrito de compras"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Carrito</span>
                  {cartItemsCount > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-black bg-white text-red-700 rounded-full shadow">
                      {cartItemsCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-800/60 text-xs text-red-300 font-semibold shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-red-400" />
                  <span className="hidden sm:inline">Modo</span> Administrador
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
                  title="Cerrar sesión de administrador"
                >
                  Salir
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* ============================================================== */}
        {/* ADMIN TAB: STOCK CONTROL (Inventario Completo)                   */}
        {/* ============================================================== */}
        {isAdmin && adminTab === "cashflow" && (
          <CashFlowTab
            products={products}
            onUpdateProduct={handleUpdateProductPricing}
            onEditProduct={openEditProductModal}
            onOpenImport={openImportModal}
            importSuccessBanner={importSuccessBanner}
            onCloseImportBanner={() => setImportSuccessBanner(null)}
            recentlyImported={recentlyImportedMap}
          />
        )}

        {isAdmin && adminTab === "interests" && (
          <InterestsTab
            products={products}
            onPendingCountChange={setPendingInterestCount}
            onOpenImport={openImportModal}
          />
        )}

        {isAdmin && adminTab === "stock" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Boxes className="w-6 h-6 text-red-500" /> Stock
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Cantidad y precios públicos de cada artículo (mismos valores que <strong>Flujo de caja</strong>).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleSyncProductImages}
                  disabled={isSyncingImages}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                  title="Descarga del proveedor las fotos que falten y las guarda en la base"
                >
                  {isSyncingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar fotos faltantes
                </button>
                <button
                  onClick={exportStockCSV}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Exportar Stock (CSV)
                </button>
                <button
                  onClick={openAddProductModal}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nuevo Artículo
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar por cualquier valor: código, descripción, tipo, cantidad, precio FT o TC, sin stock, incompleto…"
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                />
                {stockSearchQuery && (
                  <button
                    onClick={() => setStockSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Tipo:</span>
                <select
                  value={stockTypeFilter}
                  onChange={(e) => setStockTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="Todos">Todos los tipos ({products.length})</option>
                  {PRODUCT_TYPES_PRESETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase sm:tracking-wider block leading-tight">Unidades totales</span>
                <span className="text-2xl sm:text-3xl font-black text-white mt-1 block font-mono">{totalStockUnits}</span>
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase sm:tracking-wider block leading-tight">Sin stock</span>
                <span className="text-2xl sm:text-3xl font-black text-red-400 mt-1 block font-mono">{outOfStockCount}</span>
              </div>
              <button
                type="button"
                onClick={() => setAdminTab("cashflow")}
                className="p-3 sm:p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left hover:border-amber-700 transition-colors cursor-pointer"
                title="Completar en Flujo de caja"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase sm:tracking-wider block leading-tight">Incompletos</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 block font-mono">{incompleteProductsCount}</span>
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto max-h-[75vh]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/95 sticky top-0 z-20 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="p-3 text-center">Código</th>
                      <th className="p-3 text-left">Artículo</th>
                      <th className="p-3 text-center">Cantidad</th>
                      <th className="p-3 text-center text-emerald-400 whitespace-nowrap">Precio Publico FT</th>
                      <th className="p-3 text-center text-blue-400 whitespace-nowrap">Precio Publico TC</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredStockProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                          No se encontraron artículos que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredStockProducts.map((p) => {
                        const c = flujoDeCaja(p);
                        const missing = missingFields(p);
                        const isOutOfStock = p.stock <= 0;
                        const isLow = p.stock > 0 && p.stock <= (p.minStock ?? 2);
                        return (
                          <tr key={p.id} className={missing.length > 0 ? "bg-amber-950/15" : "hover:bg-zinc-800/40"}>
                            <td className="p-3 text-center font-mono font-bold text-red-400 whitespace-nowrap">{p.sku || "S/C"}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 min-w-[200px]">
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0 border border-zinc-700">
                                  <Image src={p.image || "/pecados/auriculares.jpg"} alt={p.title} fill unoptimized={true} className="object-cover" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-white line-clamp-1" title={p.title}>
                                    {p.title}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">{p.tipo || p.category}</span>
                                  {missing.length > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300">
                                      <AlertTriangle className="w-3 h-3 shrink-0" /> Incompleto: falta {missing.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleQuickAdjustStock(p.id, -1)}
                                  title="Restar 1"
                                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono min-w-[44px] text-center ${
                                    isOutOfStock
                                      ? "bg-red-950 text-red-400 border border-red-800"
                                      : isLow
                                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                                      : "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                  }`}
                                >
                                  {p.stock}
                                </span>
                                <button
                                  onClick={() => handleQuickAdjustStock(p.id, 1)}
                                  title="Sumar 1"
                                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono text-emerald-300 whitespace-nowrap">
                              {c.precioPublicoFT > 0 ? formatMoney(c.precioPublicoFT) : "—"}
                            </td>
                            <td className="p-3 text-center font-mono text-blue-300 font-bold whitespace-nowrap">
                              {c.precioPublicoTC > 0 ? formatMoney(c.precioPublicoTC) : "—"}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEditProductModal(p)}
                                  className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                                  title="Editar artículo"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-950 text-zinc-500 hover:text-red-400 cursor-pointer"
                                  title="Eliminar artículo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-zinc-950 text-white font-black border-t-2 border-red-700 sticky bottom-0 z-20 text-xs">
                    <tr>
                      <td colSpan={2} className="p-3 uppercase tracking-wider text-red-400">
                        Totales ({filteredStockProducts.length} artículos)
                      </td>
                      <td className="p-3 text-center font-mono">{filteredStockProducts.reduce((t, p) => t + p.stock, 0)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ADMIN TAB: PURCHASES / COMPRAS HISTÓRICAS                      */}
        {/* ============================================================== */}
        {isAdmin && adminTab === "purchases" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400" /> Historial de Compras a Proveedores
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Registro cronológico de lotes ingresados, archivos de compra subidos, costos de adquisición y análisis de rentabilidad.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setImportRows([]);
                    setImportStats(null);
                    setImportError("");
                    setShowImportModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  <FileUp className="w-4 h-4" /> Importar Nueva Compra (Excel)
                </button>
                <button
                  type="button"
                  onClick={exportAllPurchasesSummaryCSV}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                  title="Descargar resumen consolidado de todas las compras"
                >
                  <Download className="w-4 h-4" /> Exportar Historial (CSV)
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-zinc-400" /> Compras Cargadas
                </div>
                <div className="text-2xl font-black text-white mt-1">{purchases.length}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Lotes registrados</div>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
                <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-blue-400" /> Unidades Compradas
                </div>
                <div className="text-lg sm:text-2xl font-black text-blue-300 mt-1 break-words">
                  {purchases.reduce((acc, p) => acc + (p.totalUnits || 0), 0)} u.
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Ingresadas al stock</div>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Inversión Neta (s/IVA)
                </div>
                <div className="text-lg sm:text-2xl font-black text-amber-300 mt-1 break-words">
                  ${purchases.reduce((acc, p) => acc + (p.totalCostSinIva || 0), 0).toLocaleString("es-AR")}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Costo base mercadería</div>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-red-900/40 bg-gradient-to-br from-zinc-900 to-red-950/20">
                <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-red-400" /> Inversión Total (c/IVA)
                </div>
                <div className="text-lg sm:text-2xl font-black text-red-300 mt-1 break-words">
                  ${purchases.reduce((acc, p) => acc + (p.totalCostConIva || 0), 0).toLocaleString("es-AR")}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Total abonado proveedor</div>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-900/40 bg-gradient-to-br from-zinc-900 to-emerald-950/20 col-span-2 lg:col-span-1">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Venta Proyectada
                </div>
                <div className="text-lg sm:text-2xl font-black text-emerald-300 mt-1 break-words">
                  ${purchases.reduce((acc, p) => acc + (p.totalSaleEstimated || 0), 0).toLocaleString("es-AR")}
                </div>
                <div className="text-[11px] text-emerald-500 mt-0.5">
                  Margen: +${(
                    purchases.reduce((acc, p) => acc + (p.totalSaleEstimated || 0), 0) -
                    purchases.reduce((acc, p) => acc + (p.totalCostConIva || 0), 0)
                  ).toLocaleString("es-AR")}
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={purchaseSearchQuery}
                  onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                  placeholder="Buscar por archivo, SKU o detalle..."
                  className="w-full pl-9 pr-3 py-1.5 bg-black/60 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-600"
                />
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <span className="text-[11px] text-zinc-400 font-bold mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-zinc-500" /> Origen:
                </span>
                <button
                  type="button"
                  onClick={() => setPurchaseSourceFilter("all")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    purchaseSourceFilter === "all"
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  Todas ({purchases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseSourceFilter("excel_import")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    purchaseSourceFilter === "excel_import"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  Excel ({purchases.filter((p) => p.source === "excel_import").length})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseSourceFilter("initial_seed")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    purchaseSourceFilter === "initial_seed"
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  Carga Inicial ({purchases.filter((p) => p.source === "initial_seed").length})
                </button>
              </div>
            </div>

            {/* Purchases List */}
            {purchases.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <FileSpreadsheet className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No hay compras registradas</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Subí tu primera planilla Excel de compra para iniciar el historial y sumar stock automáticamente.
                </p>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileUp className="w-4 h-4" /> Importar Excel Ahora
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {purchases
                  .filter((p) => {
                    const matchesSearch =
                      purchaseSearchQuery === "" ||
                      p.fileName.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
                      (p.notes && p.notes.toLowerCase().includes(purchaseSearchQuery.toLowerCase())) ||
                      p.items.some(
                        (i) =>
                          i.sku.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
                          i.title.toLowerCase().includes(purchaseSearchQuery.toLowerCase())
                      );
                    const matchesSource =
                      purchaseSourceFilter === "all" || p.source === purchaseSourceFilter;
                    return matchesSearch && matchesSource;
                  })
                  .map((p) => {
                    const margin = p.totalSaleEstimated - p.totalCostConIva;
                    const marginPercent =
                      p.totalCostConIva > 0 ? Math.round((margin / p.totalCostConIva) * 100) : 0;

                    return (
                      <div
                        key={p.id}
                        className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-red-900/50 transition-all shadow-lg"
                      >
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
                          <div className="flex items-start gap-3">
                            <div className="p-3 rounded-xl bg-zinc-800 text-emerald-400 border border-zinc-700 shrink-0 mt-0.5">
                              <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-white text-base">{p.fileName}</h3>
                                {p.source === "initial_seed" ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                                    Carga Inicial Oficial
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                    <FileUp className="w-3 h-3" /> Importación Excel
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1 text-zinc-300 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                                  {new Date(p.date).toLocaleString("es-AR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span>•</span>
                                <span>{p.notes || "Sin observaciones adicionales"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPurchaseForDetail(p);
                                setPurchaseDetailSearchQuery("");
                              }}
                              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                            >
                              <Eye className="w-4 h-4" /> Ver Detalle / Reporte
                            </button>
                            <button
                              type="button"
                              onClick={() => exportSinglePurchaseCSV(p)}
                              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                              title="Descargar detalle en formato CSV para Excel"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-400" /> CSV
                            </button>
                          </div>
                        </div>

                        {/* KPI Metrics row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
                          <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                              Artículos / SKUs
                            </span>
                            <span className="text-sm font-black text-white mt-0.5 block">
                              {p.totalItems} SKUs
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {p.newItems} nuevos • {p.restockItems} reingresos
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/80">
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                              Unidades Físicas
                            </span>
                            <span className="text-sm font-black text-blue-300 mt-0.5 block">
                              {p.totalUnits} un.
                            </span>
                            <span className="text-[10px] text-zinc-500">Sumadas al inventario</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/80">
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                              Costo s/ IVA
                            </span>
                            <span className="text-sm font-black text-amber-300 mt-0.5 block">
                              ${p.totalCostSinIva.toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-zinc-500">Neto proveedor</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/40 border border-red-900/30">
                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                              Costo c/ IVA (Total)
                            </span>
                            <span className="text-sm font-black text-red-300 mt-0.5 block">
                              ${p.totalCostConIva.toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-zinc-500">Inversión final</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-900/30 col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                              Venta Estimada
                            </span>
                            <span className="text-sm font-black text-emerald-300 mt-0.5 block">
                              ${p.totalSaleEstimated.toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-emerald-500">
                              Margen: +${margin.toLocaleString("es-AR")} (+{marginPercent}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ADMIN TAB: SALES & COMMERCIAL REPORTS (Ventas y Reportes)       */}
        {/* ============================================================== */}
        {isAdmin && adminTab === "sales" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header & New Sale Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-red-500" /> Registro de Ventas y Facturación
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Historial de ventas web WhatsApp, ventas directas y rendiciones de revendedores con fechas y totales.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportSalesCSV}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Exportar Ventas a Excel (CSV)
                </button>
                <button
                  onClick={() => {
                    setSaleForm({
                      buyerName: "",
                      buyerPhone: "",
                      channel: "direct_sale",
                      resellerId: "",
                      items: products.length > 0 ? [{ productId: products[0].id, quantity: 1 }] : [],
                      paymentMethod: "efectivo",
                      notes: "",
                    });
                    setShowSaleModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Registrar Venta Manual
                </button>
              </div>
            </div>

            {/* Sales KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Ventas Registradas
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
                  {filteredSales.length}
                </span>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  {salesDateFilter === "all" ? "Histórico total" : "En período filtrado"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Facturación Total
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 block">
                  ${totalSalesRevenue.toLocaleString("es-AR")}
                </span>
                <span className="text-[11px] text-zinc-500 mt-1 block">Monto total vendido</span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Unidades Vendidas
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 block">
                  {totalItemsSold} <span className="text-sm font-normal text-zinc-500">un.</span>
                </span>
                <span className="text-[11px] text-zinc-500 mt-1 block">Despachadas</span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Ticket Promedio
                </span>
                <span className="text-2xl sm:text-3xl font-black text-red-400 mt-1 block">
                  ${Math.round(averageTicket).toLocaleString("es-AR")}
                </span>
                <span className="text-[11px] text-zinc-500 mt-1 block">Por operación</span>
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-semibold mr-1">Filtrar período:</span>
              {(["all", "today", "week", "month"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSalesDateFilter(period)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    salesDateFilter === period
                      ? "bg-red-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  {period === "all" ? "Histórico Completo" : period === "today" ? "Hoy" : period === "week" ? "Últimos 7 días" : "Este Mes"}
                </button>
              ))}
            </div>

            {/* Sales Table */}
            {filteredSales.length === 0 ? (
              <div className="py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800">
                <Receipt className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-zinc-300">No hay ventas registradas en este período</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Las compras de los clientes por WhatsApp o tus ventas directas manuales aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3.5">Fecha y Hora</th>
                        <th className="p-3.5">Cliente / Canal</th>
                        <th className="p-3.5">Detalle de Productos</th>
                        <th className="p-3.5">Pago</th>
                        <th className="p-3.5 text-right">Total ($ ARS)</th>
                        <th className="p-3.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filteredSales.map((s) => (
                        <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="p-3.5 text-zinc-300 whitespace-nowrap font-mono text-[11px]">
                            {new Date(s.date).toLocaleString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-white block">
                              {s.buyerName || "Cliente"}
                            </span>
                            <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1 mt-0.5">
                              {s.channel === "web_whatsapp" ? (
                                <span className="text-emerald-400 font-medium">WhatsApp Web</span>
                              ) : s.channel === "reseller" ? (
                                <span className="text-amber-400 font-medium">Revendedor: {s.resellerName}</span>
                              ) : (
                                <span className="text-blue-400 font-medium">Venta Directa</span>
                              )}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="space-y-1">
                              {s.items.map((i, idx) => (
                                <div key={idx} className="text-zinc-300 text-[11px]">
                                  <strong className="text-white">{i.quantity}x</strong> {i.productTitle}{" "}
                                  <span className="text-red-400 font-mono text-[10px]">[{i.productSku}]</span>{" "}
                                  <span className="text-zinc-500">— ${i.subtotal.toLocaleString("es-AR")}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 uppercase text-zinc-400 font-medium text-[10px]">
                            {s.paymentMethod}
                          </td>
                          <td className="p-3.5 text-right font-black text-sm text-emerald-400 font-mono">
                            ${s.totalAmount.toLocaleString("es-AR")}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleDeleteSale(s.id)}
                              className="p-1 rounded text-zinc-500 hover:text-red-400"
                              title="Anular venta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ADMIN TAB: RESELLERS & CONSIGNMENTS (Revendedores)              */}
        {/* ============================================================== */}
        {isAdmin && adminTab === "resellers" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-red-500" /> Gestión de Revendedores y Consignaciones
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Alta de revendedores, control de mercadería entregada para revender, rendiciones y comisiones generadas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setConsignmentForm({
                      resellerId: resellers[0]?.id || "",
                      productId: products[0]?.id || "",
                      quantityGiven: 10,
                      unitAgreedPrice: products[0]?.price || 0,
                      notes: "",
                    });
                    setShowConsignmentModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Package className="w-4 h-4" /> Entregar Mercadería a Revendedor
                </button>
                <button
                  onClick={openAddResellerModal}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Dar de Alta Revendedor
                </button>
              </div>
            </div>

            {/* Resellers Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {resellers.map((r) => {
                // Compute reseller metrics
                const resellerConsignments = consignments.filter((c) => c.resellerId === r.id);
                const activeUnitsInStreet = resellerConsignments
                  .filter((c) => c.status === "active")
                  .reduce((sum, c) => sum + (c.quantityGiven - c.quantitySold - c.quantityReturned), 0);
                const totalUnitsSold = resellerConsignments.reduce((sum, c) => sum + c.quantitySold, 0);
                const totalRevenueSold = resellerConsignments.reduce(
                  (sum, c) => sum + c.quantitySold * c.unitAgreedPrice,
                  0
                );
                const totalCommissionEarned = totalRevenueSold * (r.commissionPercent / 100);

                return (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-red-900/50 flex flex-col justify-between transition-all shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                          Comisión: {r.commissionPercent}%
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingReseller(r);
                              setResellerForm({
                                name: r.name,
                                phone: r.phone,
                                zone: r.zone,
                                commissionPercent: r.commissionPercent,
                                notes: r.notes || "",
                              });
                              setShowResellerModal(true);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteReseller(r.id)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white mt-2">{r.name}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                        📍 {r.zone || "Zona sin especificar"}
                      </p>

                      {r.notes && (
                        <p className="text-[11px] text-zinc-500 mt-2 italic bg-zinc-950/60 p-2 rounded-lg">
                          «{r.notes}»
                        </p>
                      )}

                      {/* Metrics breakdown */}
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/60">
                          <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                            En calle (Pendiente)
                          </span>
                          <span className="text-base font-bold text-amber-400 mt-0.5 block">
                            {activeUnitsInStreet} <span className="text-[10px] font-normal text-zinc-400">un.</span>
                          </span>
                        </div>

                        <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/60">
                          <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                            Vendido Total
                          </span>
                          <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                            ${totalRevenueSold.toLocaleString("es-AR")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      {r.phone ? (
                        <a
                          href={`https://wa.me/${r.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" /> WhatsApp ({r.phone})
                        </a>
                      ) : (
                        <span className="text-[11px] text-zinc-500">Sin teléfono</span>
                      )}

                      <span className="text-[11px] font-medium text-zinc-400">
                        Comisión: <strong className="text-white">${totalCommissionEarned.toLocaleString("es-AR")}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consignments in progress (Mercadería en la calle) */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" /> Lotes de Mercadería en Consignación / Rendiciones
              </h3>

              {consignments.length === 0 ? (
                <div className="py-12 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800">
                  <p className="text-xs text-zinc-500">No hay lotes de mercadería entregados a revendedores todavía.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-3.5">Fecha Entrega</th>
                          <th className="p-3.5">Revendedor</th>
                          <th className="p-3.5">Producto (SKU)</th>
                          <th className="p-3.5 text-center">Entregado</th>
                          <th className="p-3.5 text-center">Vendido</th>
                          <th className="p-3.5 text-center">Pendiente</th>
                          <th className="p-3.5">P. Pactado</th>
                          <th className="p-3.5">Estado</th>
                          <th className="p-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {consignments.map((c) => {
                          const pending = c.quantityGiven - c.quantitySold - c.quantityReturned;
                          return (
                            <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                              <td className="p-3.5 font-mono text-[11px] text-zinc-400">
                                {new Date(c.date).toLocaleDateString("es-AR")}
                              </td>
                              <td className="p-3.5 font-bold text-white">{c.resellerName}</td>
                              <td className="p-3.5">
                                <span className="font-semibold text-zinc-200">{c.productTitle}</span>{" "}
                                <span className="font-mono text-red-400 text-[10px]">[{c.productSku}]</span>
                              </td>
                              <td className="p-3.5 text-center font-bold text-white">{c.quantityGiven} un.</td>
                              <td className="p-3.5 text-center font-bold text-emerald-400">{c.quantitySold} un.</td>
                              <td className="p-3.5 text-center font-bold text-amber-400">{pending} un.</td>
                              <td className="p-3.5 font-mono">${c.unitAgreedPrice.toLocaleString("es-AR")}</td>
                              <td className="p-3.5">
                                {c.status === "settled" || pending <= 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                    Liquidado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                                    En Calle
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                {pending > 0 && (
                                  <button
                                    onClick={() => {
                                      setSettlingConsignment(c);
                                      setSettleForm({
                                        quantitySold: pending,
                                        quantityReturned: 0,
                                        paymentMethod: "efectivo",
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors"
                                  >
                                    Rendir / Cobrar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ADMIN TAB: BACKUP & SETTINGS (Respaldos y Configuración)       */}
        {/* ============================================================== */}
        {isAdmin && adminTab === "settings" && (
          <div className="space-y-8 animate-fadeIn max-w-3xl mx-auto">
            <div className="pb-4 border-b border-zinc-800">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Download className="w-6 h-6 text-red-500" /> Respaldos, Exportación y Ajustes
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Descargá copias de seguridad de todo tu negocio o transferí tus datos con seguridad.
              </p>
            </div>

            <div className="space-y-5">
              {/* WhatsApp Config Card */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" /> Número de WhatsApp de la Tienda
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Los pedidos que armen los clientes en la tienda llegarán directamente a este número con todo el detalle de productos.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-white px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    +{whatsappNumber}
                  </span>
                  <button
                    onClick={() => {
                      setTempWhatsapp(whatsappNumber);
                      setShowWhatsappModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
                  >
                    Cambiar Número
                  </button>
                </div>
              </div>

              {/* Backups & Cloud Sync Cards */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Base de Datos PostgreSQL Neon
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-semibold text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    100% en Base de Datos (Sin localStorage)
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Tus productos, precios, fotos, compras, revendedores y stock se leen y persisten directamente en la base de datos PostgreSQL Neon en la nube. Cero datos en almacenamiento local (localStorage). Podés forzar la recarga desde la base o descargar un respaldo JSON.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      fetchServerData();
                      alert("¡Sincronización con base de datos PostgreSQL completada!");
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" /> Sincronizar con PostgreSQL
                  </button>

                  <button
                    onClick={exportBackupJSON}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-2 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Descargar Copia JSON
                  </button>

                  <label className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-2 border border-zinc-700 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-zinc-400" /> Restaurar archivo JSON a la Base
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Reset Catalog Warning */}
              <div className="p-5 rounded-2xl bg-red-950/30 border border-red-900/40 space-y-3">
                <h3 className="text-base font-bold text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" /> Restablecer Producto Inicial de Prueba
                </h3>
                <p className="text-xs text-zinc-400">
                  Si deseás reiniciar el catálogo y dejar únicamente el producto de prueba inicial, podés hacerlo con este botón.
                </p>
                <button
                  onClick={handleResetCatalog}
                  className="px-3.5 py-2 rounded-xl bg-red-900/50 hover:bg-red-800/80 text-red-200 text-xs font-bold border border-red-800/60 transition-colors cursor-pointer"
                >
                  Restablecer Catálogo Original
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PUBLIC STORE / CATALOG VIEW (Catálogo Público & Modo Admin)    */}
        {/* ============================================================== */}
        {(!isAdmin || adminTab === "catalog") && (
          <div>
            {/* Hero Section */}
            <div className="mb-12 text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/70 border border-red-800/50 text-xs font-semibold text-red-300 mb-4 shadow-sm">
                <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span>Tienda Oficial • Pedidos Directos por WhatsApp</span>
              </div>

              <div className="flex justify-center mb-6">
                <div className="relative w-72 sm:w-96 md:w-[460px] h-48 sm:h-64 md:h-72 drop-shadow-[0_20px_40px_rgba(239,68,68,0.3)] transition-transform hover:scale-[1.02] duration-300">
                  <Image
                    src="/pecados/logo-transparent.png"
                    alt="Pecados Serranos - Pueblo chico, infierno grande"
                    fill
                    sizes="(max-width: 768px) 100vw, 460px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
                Descubrí nuestras tentaciones hechas productos íntimos, la mayor reserva y privacidad al momento de la venta, sentite libre de comprar y disfrutar!
              </p>

              {isAdmin && (
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/90 border border-red-800/50 text-xs text-zinc-300">
                  <Sparkles className="w-4 h-4 text-red-400" />
                  <span>Estás en <strong>Modo Administrador</strong>: Podés usar las pestañas superiores para ver el <strong>Control de Stock</strong>, <strong>Ventas y Reportes</strong>, o <strong>Revendedores</strong>.</span>
                </div>
              )}
            </div>

            {/* Search and Category Filter Bar */}
            <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Categories */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-red-600 text-white shadow-lg shadow-red-950/60"
                        : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar producto o código SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center bg-zinc-950/40 rounded-3xl border border-zinc-900">
                <Package className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-zinc-300">No se encontraron productos</h3>
                <p className="text-sm text-zinc-500 mt-1">Probá con otra búsqueda o categoría.</p>
                {isAdmin && (
                  <button
                    onClick={openAddProductModal}
                    className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Agregar producto
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
                {filteredProducts.map((product) => {
                  const inStock = product.stock > 0;
                  const isLowStock = product.stock > 0 && product.stock <= (product.minStock ?? 3);
                  const cartItem = cart.find((c) => c.product.id === product.id);
                  const qtyInCart = cartItem?.quantity || 0;

                  return (
                    <div
                      key={product.id}
                      className="group relative flex flex-col rounded-xl bg-zinc-900/80 border border-zinc-800/90 hover:border-red-900/60 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-red-950/20 backdrop-blur-sm"
                    >
                      {/* Image container: aspect-square, object-contain para evitar pixelado */}
                      <div className="relative aspect-square w-full bg-gradient-to-b from-zinc-950/70 via-zinc-900/40 to-zinc-950 p-2 sm:p-2.5 overflow-hidden flex items-center justify-center">
                        <div className="relative w-full h-full flex items-center justify-center">
                          <Image
                            src={product.image || "/pecados/auriculares.jpg"}
                            alt={product.title}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
                            unoptimized={true}
                            className="object-contain p-1 group-hover:scale-105 transition-transform duration-300 drop-shadow-md select-none"
                          />
                        </div>

                        {/* SKU Badge & Stock Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                          {product.sku && (
                            <span className="px-1.5 py-0.5 rounded bg-black/85 text-red-400 border border-red-900/70 font-mono text-[9px] font-bold tracking-tight backdrop-blur-xs shadow-xs">
                              #{product.sku}
                            </span>
                          )}

                          {!inStock ? (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-950/90 text-zinc-400 border border-zinc-800 text-[9px] font-semibold tracking-tight shadow-xs">
                              Sin Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-800 text-[9px] font-semibold tracking-tight shadow-xs flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5 shrink-0" /> {product.stock} u.
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-400 border border-emerald-800 text-[9px] font-semibold tracking-tight shadow-xs">
                              {product.stock} u.
                            </span>
                          )}
                        </div>

                        {/* Category tag */}
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-zinc-300 border border-zinc-800 text-[9px] font-medium backdrop-blur-xs shadow-xs max-w-[85px] sm:max-w-[110px] truncate z-10">
                          {product.category}
                        </span>

                        {/* Admin Actions Overlay */}
                        {isAdmin && (
                          <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex items-center justify-between gap-1 z-10">
                            <div className="flex items-center gap-0.5 bg-zinc-900/90 rounded-md p-0.5 border border-zinc-700">
                              <button
                                type="button"
                                onClick={() => handleQuickAdjustStock(product.id, -1)}
                                title="Restar 1 al stock"
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white cursor-pointer"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="px-1 text-[10px] font-bold text-white min-w-[16px] text-center font-mono">
                                {product.stock}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuickAdjustStock(product.id, 1)}
                                title="Sumar 1 al stock"
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white cursor-pointer"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditProductModal(product)}
                                className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
                                title="Editar producto"
                              >
                                <Edit3 className="w-2.5 h-2.5 text-red-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-1 rounded-md bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800/60 transition-colors cursor-pointer"
                                title="Eliminar producto"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Body Content */}
                      <div className="flex-1 p-2.5 sm:p-3 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 transition-colors line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.4rem]">
                            {product.title}
                          </h3>
                          {product.description && (
                            <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1 leading-normal hidden md:block">
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-end justify-between gap-1.5">
                          <div className="min-w-0">
                            <span className="text-sm sm:text-base font-black text-white font-mono block">
                              {formatMoney(getItemUnitPrice(product))}
                            </span>
                            {isAdmin && missingFields(product).length > 0 && (
                              <span
                                className="mt-0.5 flex items-start gap-1 text-[9px] font-bold text-amber-300 leading-tight"
                                title="No se muestra en la tienda hasta completar estos datos (pestaña Flujo de caja)"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-px" />
                                Incompleto: falta {missingFields(product).join(", ")}
                              </span>
                            )}
                          </div>

                          {/* Action Area */}
                          <div className="w-full sm:w-auto flex justify-end">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => openEditProductModal(product)}
                                className="w-full sm:w-auto px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 border border-zinc-700 hover:border-red-600/50 transition-all cursor-pointer shadow-sm"
                                title="Editar este producto en el administrador"
                              >
                                <Edit3 className="w-3 h-3 text-red-400" />
                                <span>Editar</span>
                              </button>
                            ) : (
                              <div className="w-full sm:w-auto">
                                {qtyInCart === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => (inStock ? addToCart(product, 1) : setInterestConfirmProduct(product))}
                                    title={inStock ? "Agregar al carrito" : "Sin stock: avisanos que te interesa y te contactamos cuando vuelva"}
                                    className={`w-full sm:w-auto px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                      inStock
                                        ? "bg-red-600 hover:bg-red-500 text-white shadow-sm shadow-red-950/50"
                                        : "bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-800/60"
                                    }`}
                                  >
                                    {inStock ? <Plus className="w-3 h-3" /> : <HandHeart className="w-3 h-3" />}
                                    <span>{inStock ? "Agregar" : "Me interesa"}</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center justify-between sm:justify-start gap-1 bg-zinc-950 border border-red-900/60 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateCartQuantity(product.id, -1)}
                                      className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                      aria-label="Restar una unidad"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="px-1 text-[11px] font-bold text-white font-mono min-w-[16px] text-center">
                                      {qtyInCart}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateCartQuantity(product.id, 1);
                                        showCartToast(product.title, Math.min(qtyInCart + 1, cartItemMax(product, cartItem?.interest)));
                                      }}
                                      disabled={qtyInCart >= cartItemMax(product, cartItem?.interest)}
                                      className={`p-1 rounded transition-colors cursor-pointer ${
                                        qtyInCart >= cartItemMax(product, cartItem?.interest)
                                          ? "text-zinc-600 cursor-not-allowed"
                                          : "hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                      }`}
                                      aria-label="Sumar una unidad"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cart Drawer / Slide-Over Modal (solo clientes públicos) */}
      <AnimatePresence>
        {isCartOpen && !isAdmin && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <div className="fixed inset-y-0 right-0 flex w-full sm:w-auto sm:max-w-full sm:pl-10">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full sm:w-screen sm:max-w-md h-full bg-[#11090a] sm:border-l border-red-950/60 flex flex-col shadow-2xl text-zinc-100"
              >
                {/* Header */}
                <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/60 text-red-400">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Carrito de Compras</h2>
                      <p className="text-xs text-zinc-400">
                        {cartItemsCount} {cartItemsCount === 1 ? "producto" : "productos"} seleccionados
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body items list */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 text-zinc-600">
                        <ShoppingCart className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-semibold text-zinc-300">Tu carrito está vacío</h3>
                      <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                        Explorá el catálogo de Pecados Serranos y agregá lo que más te tiente.
                      </p>
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="mt-5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                      >
                        Ver Catálogo
                      </button>
                    </div>
                  ) : (
                    [...purchaseCartItems, ...interestCartItems].map((item, idx) => {
                      const unitP = getItemUnitPrice(item.product, cartPaymentMethod);
                      const itemSubtotal = unitP * item.quantity;
                      return (
                        <React.Fragment key={item.product.id}>
                        {item.interest && idx === purchaseCartItems.length && (
                          <div className={purchaseCartItems.length > 0 ? "pt-3 border-t border-zinc-800" : ""}>
                            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <HandHeart className="w-3.5 h-3.5" /> Me interesa (sin stock)
                            </h3>
                            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                              No es una compra ni suma al total: le avisamos a la tienda que te interesan y te contactan cuando vuelvan a entrar.
                            </p>
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-3.5 p-3 rounded-xl border ${
                            item.interest ? "bg-amber-950/10 border-amber-900/50" : "bg-zinc-900/60 border-zinc-800/70"
                          }`}
                        >
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800">
                            <Image
                              src={item.product.image || "/pecados/auriculares.jpg"}
                              alt={item.product.title}
                              fill
                              unoptimized={true}
                              className="object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1">
                              {item.product.sku && (
                                <span className="font-mono text-[9px] text-red-400 bg-red-950/60 px-1 rounded whitespace-nowrap">
                                  #{item.product.sku}
                                </span>
                              )}
                              {item.product.tipo && (
                                <span className="text-[9px] text-zinc-400 bg-zinc-800 px-1 rounded truncate max-w-[120px]">
                                  {item.product.tipo}
                                </span>
                              )}
                            </div>
                            <h4 className="mt-0.5 text-xs font-bold text-white leading-snug line-clamp-2" title={item.product.title}>
                              {item.product.title}
                            </h4>
                            {item.interest ? (
                              <p className="text-[11px] text-amber-300/90 mt-0.5">
                                Sin stock · {item.quantity} {item.quantity === 1 ? "unidad" : "unidades"} de interés
                              </p>
                            ) : (
                              <>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {formatMoney(unitP)} c/u
                                </p>
                                <span className="text-xs font-black text-red-400 mt-1 block font-mono">
                                  {formatMoney(itemSubtotal)}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Controls */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Quitar del carrito"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center gap-1 bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                              <button
                                onClick={() => updateCartQuantity(item.product.id, -1)}
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-1 text-[11px] font-bold text-white min-w-[16px] text-center font-mono">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartQuantity(item.product.id, 1)}
                                disabled={item.quantity >= cartItemMax(item.product, item.interest)}
                                className={`p-1 rounded ${
                                  item.quantity >= cartItemMax(item.product, item.interest)
                                    ? "text-zinc-600"
                                    : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                {/* Footer with Buyer details & Checkout */}
                {cart.length > 0 && (
                  <div className="p-5 border-t border-zinc-800 bg-zinc-950/90 space-y-4">
                    {/* Buyer Info Form */}
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Tus datos para el pedido (opcional)
                      </span>
                      <input
                        type="text"
                        placeholder="Tu Nombre completo"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="Dirección o punto de entrega"
                        value={buyerAddress}
                        onChange={(e) => setBuyerAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                      />
                    </div>

                    {/* Total */}
                    {purchaseCartItems.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-400">Total a Pagar</span>
                        <span className="text-2xl font-black text-white font-mono">
                          {formatMoney(cartTotal)}
                        </span>
                      </div>
                    )}

                    {/* Checkout Button */}
                    <button
                      onClick={handleCheckoutWhatsApp}
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                      <span>
                        {purchaseCartItems.length > 0 ? "Pedir por WhatsApp" : "Avisar que me interesa por WhatsApp"}
                      </span>
                    </button>

                    <p className="text-[10px] text-center text-zinc-500 leading-tight">
                      Al tocar el botón se abrirá WhatsApp con el detalle completo de tus productos y tu mensaje listo para enviar.
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Aviso temporal "Agregado al carrito" (no abre el carrito) */}
      <AnimatePresence>
        {cartToast && !isCartOpen && (
          <motion.div
            key="cart-toast"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            role="status"
            aria-live="polite"
            className="fixed z-50 top-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-zinc-900/95 border border-red-800/70 shadow-2xl shadow-black/60 backdrop-blur-md p-3.5 flex items-center gap-3 text-zinc-100"
          >
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">Agregado al carrito</p>
              <p className="text-[11px] text-zinc-400 line-clamp-1">
                {cartToast.title} · {cartToast.qty} {cartToast.qty === 1 ? "unidad" : "unidades"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCartToast(null);
                setIsCartOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer"
            >
              Ver carrito
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso "Me interesa" (producto sin stock): confirmar antes de agregar al carrito */}
      <AnimatePresence>
        {interestConfirmProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInterestConfirmProduct(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="interest-confirm-title"
              className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-amber-800/60 p-6 shadow-2xl text-zinc-100 z-10"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-amber-950 text-amber-300 border border-amber-800/60">
                  <HandHeart className="w-4 h-4" />
                </div>
                <h3 id="interest-confirm-title" className="text-base font-bold text-amber-300">
                  Me interesa (sin stock)
                </h3>
              </div>

              <p className="text-sm text-zinc-200 leading-relaxed">
                No es una compra ni suma al total: le avisamos a la tienda que te interesan y te contactan cuando vuelvan a entrar.
              </p>

              <div className="mt-4 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2">
                {interestConfirmProduct.sku && (
                  <span className="font-mono text-[10px] text-red-400 bg-red-950/60 px-1 rounded shrink-0">
                    #{interestConfirmProduct.sku}
                  </span>
                )}
                <span className="text-xs font-semibold text-white line-clamp-2">{interestConfirmProduct.title}</span>
              </div>

              <p className="mt-4 text-xs text-zinc-400">¿Querés continuar y agregarlo al carrito?</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInterestConfirmProduct(null)}
                  className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-colors cursor-pointer"
                >
                  No, volver
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    addToCart(interestConfirmProduct, 1);
                    setInterestConfirmProduct(null);
                  }}
                  className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold transition-colors cursor-pointer"
                >
                  Sí, continuar al carrito
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-zinc-100 z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-red-950 text-red-400 border border-red-800/60">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Acceso Administrador</h3>
                </div>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">Usuario</label>
                  <input
                    type="text"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="admin"
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Contraseña de admin"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                  />
                </div>

                {loginError && (
                  <p className="text-xs text-red-400 font-medium">{loginError}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Ingresar al Modo Admin
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Database Diagnostic & Connection Modal */}
      <AnimatePresence>
        {showDbModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDbModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-zinc-100 z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-950 text-red-400 border border-red-800/60">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Estado de Base de Datos</h3>
                    <p className="text-[11px] text-zinc-400">Prisma ORM • PostgreSQL Centralizada</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDbModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Card */}
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    cloudStatus === "postgresql_prisma"
                      ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
                      : cloudStatus === "fallback_memory"
                      ? "bg-red-950/40 border-red-800/80 text-red-200"
                      : "bg-amber-950/40 border-amber-800/80 text-amber-200"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {cloudStatus === "postgresql_prisma" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : cloudStatus === "fallback_memory" ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Info className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-sm text-white block">
                      {cloudStatus === "postgresql_prisma"
                        ? "PostgreSQL Conectada y Sincronizando"
                        : cloudStatus === "fallback_memory"
                        ? "Error de Conexión a PostgreSQL"
                        : "Modo Memoria (Pendiente DATABASE_URL)"}
                    </span>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {dbDetails ||
                        (cloudStatus === "postgresql_prisma"
                          ? "Tu base de datos PostgreSQL está activa. Los productos, ventas, stock y revendedores están sincronizados permanentemente."
                          : "Actualmente la tienda almacena los datos en memoria del servidor y almacenamiento local protegido. Para que queden grabados permanentemente en la nube, es necesario configurar la variable DATABASE_URL.")}
                    </p>
                  </div>
                </div>

                {/* Instructions if not connected */}
                {cloudStatus !== "postgresql_prisma" && (
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      ¿Cómo activar PostgreSQL en 2 pasos?
                    </span>
                    <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside leading-relaxed">
                      <li>
                        <strong className="text-white">Opción Vercel (Recomendado):</strong> Entrá a tu panel de Vercel ➔ Pestaña <span className="text-red-400 font-mono">Storage</span> ➔ Clic en <span className="text-white font-semibold">Create Database</span> ➔ Elegí <span className="text-white font-semibold">Postgres (Neon)</span>. Vercel creará la base y asignará <span className="text-red-400 font-mono">DATABASE_URL</span> automáticamente.
                      </li>
                      <li>
                        <strong className="text-white">Opción Supabase / Neon externo:</strong> Creá una base gratuita en <span className="text-zinc-200">supabase.com</span> o <span className="text-zinc-200">neon.tech</span> y copiá la URL de conexión (<span className="text-red-400 font-mono">postgresql://...</span>). Pegala en Vercel en <span className="text-zinc-200">Settings ➔ Environment Variables</span> con el nombre <span className="text-red-400 font-mono">DATABASE_URL</span>.
                      </li>
                    </ol>
                  </div>
                )}

                {/* Diagnostic Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Motor de Persistencia</span>
                    <span className="font-semibold text-white truncate block">
                      {dbEngine || (cloudStatus === "postgresql_prisma" ? "PostgreSQL (Prisma)" : "Memoria Servidor")}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Catálogo Listo</span>
                    <span className="font-semibold text-white block">{products.length} productos</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      fetchServerData();
                    }}
                    disabled={isLoadingServer}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServer ? "animate-spin" : ""}`} />
                    Probar Conexión Ahora
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      persistAllData();
                    }}
                    disabled={isSavingServer}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-red-950 disabled:opacity-50"
                  >
                    {isSavingServer ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Sincronizar a la Base
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin WhatsApp Modal */}
      <AnimatePresence>
        {showWhatsappModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhatsappModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-zinc-100 z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    <Phone className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Número de WhatsApp</h3>
                </div>
                <button
                  onClick={() => setShowWhatsappModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveWhatsapp} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Teléfono con código de país (sin + ni guiones)
                  </label>
                  <input
                    type="text"
                    value={tempWhatsapp}
                    onChange={(e) => setTempWhatsapp(e.target.value)}
                    placeholder="541161314128"
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    Ejemplo para Argentina: <code>541161314128</code>
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Guardar Número
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Add/Edit Modal (Admin) */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProductModal(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-red-400" />
                  {editingProduct ? "Editar Producto" : "Nuevo Producto en Catálogo"}
                </h3>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* Tipo / Categoría Preset Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-zinc-300 font-semibold block">
                      Tipo de Artículo (Categoría VShop)
                    </label>
                    <span className="text-[10px] text-zinc-500">Tocá un tipo o escribí uno personalizado</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRODUCT_TYPES_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProdForm({ ...prodForm, tipo: t, category: t })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                          prodForm.tipo === t
                            ? "bg-red-600 text-white font-bold shadow-sm"
                            : "bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    value={prodForm.tipo}
                    onChange={(e) => setProdForm({ ...prodForm, tipo: e.target.value, category: e.target.value })}
                    placeholder="Ej: Conjunto de lencería, Body, Babydolls, Disfraz..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Código SKU & Título */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-xs text-zinc-400 font-medium block mb-1">Código / SKU</label>
                    <input
                      type="text"
                      required
                      value={prodForm.sku}
                      onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value.toUpperCase() })}
                      placeholder="B2900B"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-red-400 font-mono font-bold focus:outline-none focus:border-red-500 uppercase"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-zinc-400 font-medium block mb-1">Descripción / Título</label>
                    <input
                      type="text"
                      required
                      value={prodForm.title}
                      onChange={(e) => setProdForm({ ...prodForm, title: e.target.value })}
                      placeholder="Ej: Conjunto puntilla c/less y portaligas"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Descripción Detallada */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Descripción Adicional (opcional)</label>
                  <textarea
                    rows={2}
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    placeholder="Detalles de tela, talles disponibles, presentación..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Flujo de caja: mismas fórmulas que la planilla VShop */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-red-400" /> Flujo de caja
                    </span>
                    <span className="text-[10px] text-zinc-400">IVA 21% • Multiplicador • TC = FT +10%</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-zinc-300 font-bold block mb-1">Proveedor SIN IVA ($)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={prodForm.costoSinIva || ""}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          const cCon = proveedorConIva(val);
                          setProdForm({
                            ...prodForm,
                            costoSinIva: val,
                            costoConIva: cCon,
                            gananciaSugerida: cCon * (prodForm.multiplicadorGanancia || 0),
                          });
                        }}
                        placeholder="Obligatorio"
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-300 font-bold block mb-1">Proveedor con IVA ($)</label>
                      <div className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-amber-300 font-mono font-bold">
                        {formatMoney(proveedorConIva(prodForm.costoSinIva))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-zinc-300 font-bold block mb-1">Multiplicador de ganancia</label>
                      <select
                        value={isValidMultiplier(prodForm.multiplicadorGanancia) ? String(prodForm.multiplicadorGanancia) : ""}
                        onChange={(e) => {
                          const m = Number(e.target.value) || 0;
                          setProdForm({
                            ...prodForm,
                            multiplicadorGanancia: m,
                            gananciaSugerida: proveedorConIva(prodForm.costoSinIva) * m,
                          });
                        }}
                        className={`w-full px-3 py-1.5 rounded-xl bg-zinc-900 border text-xs font-mono focus:outline-none focus:border-red-500 ${
                          isValidMultiplier(prodForm.multiplicadorGanancia) ? "border-zinc-800 text-white" : "border-amber-600 text-amber-200"
                        }`}
                      >
                        <option value="">Elegir…</option>
                        {MULTIPLIER_OPTIONS.map((m) => (
                          <option key={m} value={String(m)}>
                            x{m.toFixed(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-rose-300 font-bold block mb-1">Ganancia ($)</label>
                      <div className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-rose-300 font-mono font-bold">
                        {formatMoney(
                          proveedorConIva(prodForm.costoSinIva) *
                            (isValidMultiplier(prodForm.multiplicadorGanancia) ? prodForm.multiplicadorGanancia : 0)
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
                    <div>
                      <label className="text-[11px] text-emerald-400 font-bold block mb-1">Precio Publico FT ($)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={prodForm.precioEfectivo || ""}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setProdForm({ ...prodForm, precioEfectivo: val, price: val, precioTarjeta: precioPublicoTC(val) });
                        }}
                        placeholder="Obligatorio"
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-emerald-800/80 text-xs text-emerald-300 font-mono font-black focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-blue-400 font-bold block mb-1">Precio Publico TC ($) — precio en la tienda</label>
                      <div className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-blue-900/60 text-xs text-blue-300 font-mono font-bold">
                        {formatMoney(precioPublicoTC(prodForm.precioEfectivo))}
                      </div>
                    </div>
                  </div>

                  {missingFields({
                    sku: prodForm.sku,
                    title: prodForm.title,
                    costoSinIva: prodForm.costoSinIva,
                    multiplicadorGanancia: prodForm.multiplicadorGanancia,
                    precioEfectivo: prodForm.precioEfectivo,
                  }).length > 0 && (
                    <p className="p-2 rounded-lg bg-amber-950/60 border border-amber-800 text-[11px] text-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-amber-400" />
                      <span>
                        Incompleto: falta{" "}
                        {missingFields({
                          sku: prodForm.sku,
                          title: prodForm.title,
                          costoSinIva: prodForm.costoSinIva,
                          multiplicadorGanancia: prodForm.multiplicadorGanancia,
                          precioEfectivo: prodForm.precioEfectivo,
                        }).join(", ")}
                        . No se mostrará en la tienda hasta completarlo.
                      </span>
                    </p>
                  )}
                </div>

                {/* Cantidad y stock mínimo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1">Cantidad</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={prodForm.stock}
                      onChange={(e) => setProdForm({ ...prodForm, stock: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1">Stock Mínimo (Alerta)</label>
                    <input
                      type="number"
                      min={0}
                      value={prodForm.minStock}
                      onChange={(e) => setProdForm({ ...prodForm, minStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Observaciones (Campo Columna 14 en VShop.xlsb) */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">
                    Observaciones (Talle, Colores, Notas especiales de la planilla)
                  </label>
                  <input
                    type="text"
                    value={prodForm.observaciones}
                    onChange={(e) => setProdForm({ ...prodForm, observaciones: e.target.value })}
                    placeholder="Ej: Talle único, varios colores, promo especial..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Image upload / select */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Foto del Producto (Subí desde tu celular/PC con compresión automática)
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        compressAndSetImage(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Drop zone / selector */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        compressAndSetImage(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-red-500 bg-red-950/20"
                        : "border-zinc-800 hover:border-zinc-700 bg-zinc-950"
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-xs text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        <span>Procesando imagen...</span>
                      </div>
                    ) : prodForm.image ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-zinc-700">
                          <Image
                            src={prodForm.image}
                            alt="Vista previa"
                            fill
                            unoptimized={true}
                            className="object-cover"
                          />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white block">Imagen lista</span>
                          <span className="text-[10px] text-zinc-400">Hacé clic para cambiar la foto</span>
                        </div>
                        <Upload className="w-4 h-4 text-red-400 shrink-0" />
                      </div>
                    ) : (
                      <div className="py-2 text-xs text-zinc-400 flex flex-col items-center gap-1.5">
                        <Upload className="w-5 h-5 text-zinc-500" />
                        <span>Hacé clic o arrastrá una imagen aquí</span>
                      </div>
                    )}
                  </div>

                  {/* URL Toggle */}
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="text-red-400 hover:text-red-300 underline"
                    >
                      {showUrlInput ? "Ocultar URL manual" : "O ingresar URL externa"}
                    </button>
                  </div>

                  {showUrlInput && (
                    <input
                      type="text"
                      value={prodForm.image}
                      onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                      placeholder="https://ejemplo.com/foto.jpg"
                      className="mt-2 w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                    />
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950 transition-colors"
                  >
                    {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Sale Modal */}
      <AnimatePresence>
        {showSaleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSaleModal(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-red-400" /> Registrar Venta Directa o Mostrador
                </h3>
                <button onClick={() => setShowSaleModal(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateManualSale} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      placeholder="Cliente Mostrador"
                      value={saleForm.buyerName}
                      onChange={(e) => setSaleForm({ ...saleForm, buyerName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Teléfono (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: 3548..."
                      value={saleForm.buyerPhone}
                      onChange={(e) => setSaleForm({ ...saleForm, buyerPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Canal de Venta</label>
                    <select
                      value={saleForm.channel}
                      onChange={(e) => setSaleForm({ ...saleForm, channel: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    >
                      <option value="direct_sale">Venta Directa / Mostrador</option>
                      <option value="web_whatsapp">Web WhatsApp</option>
                      <option value="reseller">A través de Revendedor</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Medio de Pago</label>
                    <select
                      value={saleForm.paymentMethod}
                      onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="mercadopago">Mercado Pago</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>

                {saleForm.channel === "reseller" && (
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Seleccionar Revendedor</label>
                    <select
                      value={saleForm.resellerId}
                      onChange={(e) => setSaleForm({ ...saleForm, resellerId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    >
                      <option value="">Seleccionar...</option>
                      {resellers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.zone}) - {r.commissionPercent}% com.
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Items in sale */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium">Productos a Vender</label>
                    <button
                      type="button"
                      onClick={() =>
                        setSaleForm({
                          ...saleForm,
                          items: [...saleForm.items, { productId: products[0]?.id || "", quantity: 1 }],
                        })
                      }
                      className="text-red-400 hover:text-red-300 text-[11px] font-bold"
                    >
                      + Agregar ítem
                    </button>
                  </div>

                  <div className="space-y-2">
                    {saleForm.items.map((item, idx) => {
                      const selProd = products.find((p) => p.id === item.productId);
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const newItems = [...saleForm.items];
                              newItems[idx].productId = e.target.value;
                              setSaleForm({ ...saleForm, items: newItems });
                            }}
                            className="flex-1 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg text-white text-xs"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.sku}] {p.title} (${p.price.toLocaleString("es-AR")}) - Stock: {p.stock}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500 text-[10px]">Cant:</span>
                            <input
                              type="number"
                              min={1}
                              max={selProd?.stock || 999}
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...saleForm.items];
                                newItems[idx].quantity = Math.max(1, Number(e.target.value));
                                setSaleForm({ ...saleForm, items: newItems });
                              }}
                              className="w-14 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white font-mono text-center"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const newItems = saleForm.items.filter((_, i) => i !== idx);
                              setSaleForm({ ...saleForm, items: newItems });
                            }}
                            className="p-1 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaleModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                  >
                    Confirmar Venta
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reseller Modal */}
      <AnimatePresence>
        {showResellerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResellerModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-400" />
                  {editingReseller ? "Editar Revendedor" : "Dar de Alta Revendedor"}
                </h3>
                <button onClick={() => setShowResellerModal(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveReseller} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs flex-1">
                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Nombre Completo / Local</label>
                  <input
                    type="text"
                    required
                    value={resellerForm.name}
                    onChange={(e) => setResellerForm({ ...resellerForm, name: e.target.value })}
                    placeholder="Ej: Marcos Pérez / Kiosco El Serrano"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      value={resellerForm.phone}
                      onChange={(e) => setResellerForm({ ...resellerForm, phone: e.target.value })}
                      placeholder="5493548..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Comisión (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={resellerForm.commissionPercent}
                      onChange={(e) => setResellerForm({ ...resellerForm, commissionPercent: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Zona o Localidad</label>
                  <input
                    type="text"
                    value={resellerForm.zone}
                    onChange={(e) => setResellerForm({ ...resellerForm, zone: e.target.value })}
                    placeholder="Ej: La Falda, Villa Giardino, Carlos Paz"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Notas / Observaciones</label>
                  <textarea
                    rows={2}
                    value={resellerForm.notes}
                    onChange={(e) => setResellerForm({ ...resellerForm, notes: e.target.value })}
                    placeholder="Punto de encuentro, días de liquidación..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResellerModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                  >
                    Guardar Revendedor
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Consignment Delivery Modal */}
      <AnimatePresence>
        {showConsignmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConsignmentModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" /> Entregar Lote para Revender
                </h3>
                <button onClick={() => setShowConsignmentModal(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveConsignment} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs flex-1">
                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Revendedor</label>
                  <select
                    required
                    value={consignmentForm.resellerId}
                    onChange={(e) => setConsignmentForm({ ...consignmentForm, resellerId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  >
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.zone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Producto</label>
                  <select
                    required
                    value={consignmentForm.productId}
                    onChange={(e) => {
                      const sel = products.find((p) => p.id === e.target.value);
                      setConsignmentForm({
                        ...consignmentForm,
                        productId: e.target.value,
                        unitAgreedPrice: sel ? sel.price : 0,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.title} (Stock depósito: {p.stock} un.)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Cantidad a Entregar</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={consignmentForm.quantityGiven}
                      onChange={(e) => setConsignmentForm({ ...consignmentForm, quantityGiven: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Precio Pactado ($)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={consignmentForm.unitAgreedPrice}
                      onChange={(e) => setConsignmentForm({ ...consignmentForm, unitAgreedPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Notas / Referencia</label>
                  <input
                    type="text"
                    value={consignmentForm.notes}
                    onChange={(e) => setConsignmentForm({ ...consignmentForm, notes: e.target.value })}
                    placeholder="Lote entregado para fin de semana..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConsignmentModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                  >
                    Registrar Entrega
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settle Consignment Modal (Rendición de cuentas) */}
      <AnimatePresence>
        {settlingConsignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettlingConsignment(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Rendición de Mercadería
                </h3>
                <button onClick={() => setSettlingConsignment(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs flex-1">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs mb-3 space-y-1">
                  <p className="text-white font-bold">{settlingConsignment.resellerName}</p>
                  <p className="text-zinc-400">
                    {settlingConsignment.productTitle} <span className="text-red-400 font-mono">[{settlingConsignment.productSku}]</span>
                  </p>
                  <p className="text-amber-400 font-semibold">
                    Pendiente de rendición: {settlingConsignment.quantityGiven - settlingConsignment.quantitySold - settlingConsignment.quantityReturned} un.
                  </p>
                </div>

                <form onSubmit={handleSettleConsignment} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Cantidad Vendida</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={settlingConsignment.quantityGiven - settlingConsignment.quantitySold - settlingConsignment.quantityReturned}
                      value={settleForm.quantitySold}
                      onChange={(e) => setSettleForm({ ...settleForm, quantitySold: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Cantidad Devuelta</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={settlingConsignment.quantityGiven - settlingConsignment.quantitySold - settlingConsignment.quantityReturned}
                      value={settleForm.quantityReturned}
                      onChange={(e) => setSettleForm({ ...settleForm, quantityReturned: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Medio de Pago Rendido</label>
                  <select
                    value={settleForm.paymentMethod}
                    onChange={(e) => setSettleForm({ ...settleForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="mercadopago">Mercado Pago</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {/* Calculation breakdown */}
                {settleForm.quantitySold > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
                    {(() => {
                      const res = resellers.find((r) => r.id === settlingConsignment.resellerId);
                      const gross = settleForm.quantitySold * settlingConsignment.unitAgreedPrice;
                      const comm = gross * ((res?.commissionPercent || 0) / 100);
                      const net = gross - comm;
                      return (
                        <>
                          <div className="flex justify-between text-zinc-300">
                            <span>Venta Total:</span>
                            <strong className="font-mono">${gross.toLocaleString("es-AR")}</strong>
                          </div>
                          <div className="flex justify-between text-amber-300">
                            <span>Comisión Revendedor ({res?.commissionPercent}%):</span>
                            <strong className="font-mono">-${comm.toLocaleString("es-AR")}</strong>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-emerald-800/40">
                            <span>Monto a Cobrar Neto:</span>
                            <strong className="font-mono text-sm">${net.toLocaleString("es-AR")}</strong>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlingConsignment(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Confirmar Rendición
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Purchase Excel Modal (Importar Compra) */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isImportingToDb) setShowImportModal(false);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0 bg-zinc-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/60 text-red-400">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      Importar Compra desde Excel
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Sube tu planilla de compra para sumar stock automáticamente e incorporar nuevos artículos.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  disabled={isImportingToDb}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
                {/* Input file oculto */}
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.xlsb,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFileSelected(file);
                    e.target.value = "";
                  }}
                />

                {/* Si todavía no hay archivo o se quiere cambiar */}
                {importRows.length === 0 ? (
                  <div className="space-y-4">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleImportFileSelected(file);
                      }}
                      onClick={() => importFileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-700 hover:border-red-500 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-zinc-950/50 hover:bg-zinc-950/80 group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:border-red-600/60 transition-transform">
                        {isParsingFile ? (
                          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-8 h-8 text-red-400" />
                        )}
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white mb-1">
                        {isParsingFile
                          ? "Analizando planilla y comparando catálogo..."
                          : "Hacé clic o arrastrá tu planilla Excel aquí"}
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-md mx-auto mb-4 leading-relaxed">
                        Soporta <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.xlsb</strong> y <strong>.csv</strong> de compras (con columnas como <code>Cod.</code>, <code>#Pedida</code>, <code>P.U.</code>, etc.).
                      </p>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-950/40 inline-flex items-center gap-2 pointer-events-none"
                      >
                        <Upload className="w-3.5 h-3.5" /> Seleccionar Archivo de Compra
                      </button>
                    </div>

                    {importError && (
                      <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800 text-red-200 flex items-center gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{importError}</span>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 space-y-1.5 text-[11px] leading-relaxed">
                      <span className="font-bold text-zinc-200 block uppercase tracking-wider text-[10px]">
                        ℹ️ ¿Cómo funciona la importación automática?
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-zinc-400">
                        <li>
                          <strong>Si el artículo ya existe (por Código/SKU):</strong> se le <strong>suma</strong> la cantidad comprada al stock actual (no se duplica).
                        </li>
                        <li>
                          <strong>Si es un producto nuevo:</strong> se incorpora automáticamente al catálogo con su costo, precio público calculado y stock inicial.
                        </li>
                        <li>
                          Antes de aplicar cambios a la base, podés ver la <strong>vista previa detallada</strong> y seleccionar qué artículos incluir.
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  /* Vista Previa de la Compra Detectada */
                  <div className="space-y-4">
                    {/* Barra de Archivo Cargado */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-white truncate text-xs">{importFile?.name}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0">
                          ({importFile ? Math.round(importFile.size / 1024) : 0} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImportFile(null);
                          setImportRows([]);
                          setImportStats(null);
                          setImportError("");
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer shrink-0 text-left sm:text-right"
                      >
                        Cambiar archivo
                      </button>
                    </div>

                    {/* KPI Stats de la Compra */}
                    {importStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block mb-0.5">Artículos Detectados</span>
                          <span className="text-base sm:text-lg font-black text-white font-mono">
                            {importStats.totalRows}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60">
                          <span className="text-[10px] text-emerald-300 block mb-0.5">Nuevos Productos</span>
                          <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                            +{importStats.newCount}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60">
                          <span className="text-[10px] text-blue-300 block mb-0.5">Con Stock a Sumar</span>
                          <span className="text-base sm:text-lg font-black text-blue-400 font-mono">
                            {importStats.restockCount}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60">
                          <span className="text-[10px] text-amber-300 block mb-0.5">Unidades Totales</span>
                          <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                            +{importStats.totalUnits} un.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Toolbar de Filtro y Búsqueda en Preview */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setImportFilterTab("all")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                            importFilterTab === "all"
                              ? "bg-zinc-700 text-white"
                              : "bg-zinc-950 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Todos ({importRows.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportFilterTab("new")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                            importFilterTab === "new"
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-950 text-emerald-400 hover:bg-emerald-950/60"
                          }`}
                        >
                          ✨ Nuevos ({importStats?.newCount || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportFilterTab("restock")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                            importFilterTab === "restock"
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-950 text-blue-400 hover:bg-blue-950/60"
                          }`}
                        >
                          🔄 Sumar Stock ({importStats?.restockCount || 0})
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Buscar SKU o nombre..."
                          value={importSearchQuery}
                          onChange={(e) => setImportSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>

                    {/* Tabla de Vista Previa */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/70">
                      <div className="max-h-[38vh] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] sticky top-0 z-10">
                            <tr>
                              <th className="p-2.5 w-8 text-center">
                                <input
                                  type="checkbox"
                                  checked={importRows.length > 0 && importRows.every((r) => r.selected)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setImportRows(importRows.map((r) => ({ ...r, selected: checked })));
                                  }}
                                  className="rounded border-zinc-700 cursor-pointer"
                                  title="Seleccionar o deseleccionar todos"
                                />
                              </th>
                              <th className="p-2.5">Artículo / SKU</th>
                              <th className="p-2.5">Acción Detectada</th>
                              <th className="p-2.5 text-center">Cantidad Compra</th>
                              <th className="p-2.5 text-center">Stock Resultante</th>
                              <th className="p-2.5 text-right">Costo c/IVA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                            {(() => {
                              const previewList = importRows.filter((r) => {
                                if (importFilterTab === "new" && r.action !== "new") return false;
                                if (importFilterTab === "restock" && r.action !== "restock") return false;
                                if (importSearchQuery.trim()) {
                                  const q = importSearchQuery.toLowerCase();
                                  return (
                                    r.sku.toLowerCase().includes(q) ||
                                    r.title.toLowerCase().includes(q) ||
                                    r.tipo.toLowerCase().includes(q)
                                  );
                                }
                                return true;
                              });

                              if (previewList.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="py-8 text-center text-zinc-500 font-sans">
                                      No hay filas que coincidan con el filtro actual.
                                    </td>
                                  </tr>
                                );
                              }

                              return previewList.map((item, idx) => (
                                <tr
                                  key={item.sku + idx}
                                  className={`hover:bg-zinc-800/40 transition-colors ${
                                    item.action === "new" ? "bg-emerald-950/15" : "bg-blue-950/15"
                                  }`}
                                >
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={item.selected}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setImportRows(
                                          importRows.map((r) =>
                                            r.sku === item.sku ? { ...r, selected: checked } : r
                                          )
                                        );
                                      }}
                                      className="rounded border-zinc-700 cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-2.5 font-sans">
                                    <div className="flex items-center gap-2 max-w-[280px]">
                                      <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0 border border-zinc-800">
                                        <Image
                                          src={item.image || "/pecados/auriculares.jpg"}
                                          alt={item.title}
                                          fill
                                          unoptimized={true}
                                          className="object-cover"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-mono text-red-400 font-bold block leading-tight text-[10px]">
                                          #{item.sku}
                                        </span>
                                        <span className="font-semibold text-white truncate block text-[11px]" title={item.title}>
                                          {item.title}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2.5 font-sans">
                                    {item.action === "new" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                        <Sparkles className="w-2.5 h-2.5" /> Nuevo Producto
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                                        <Boxes className="w-2.5 h-2.5" /> Sumar al Stock
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-white font-mono">
                                    +{item.cantidadComprada} un.
                                  </td>
                                  <td className="p-2.5 text-center font-mono">
                                    {item.action === "new" ? (
                                      <span className="text-emerald-400 font-bold">0 ➔ {item.stockFinal} un.</span>
                                    ) : (
                                      <span className="text-zinc-300">
                                        {item.stockActual} ➔ <strong className="text-blue-400">+{item.cantidadComprada}</strong> = <strong className="text-white">{item.stockFinal} un.</strong>
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-right text-amber-300 font-mono">
                                    ${item.costoConIva.toLocaleString("es-AR")}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-zinc-800 shrink-0 bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-zinc-400 text-xs">
                  {importRows.length > 0 && (
                    <>
                      Seleccionados: <strong>{importRows.filter((r) => r.selected).length}</strong> de{" "}
                      <strong>{importRows.length}</strong> artículos
                    </>
                  )}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    disabled={isImportingToDb}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  {importRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isImportingToDb || importRows.filter((r) => r.selected).length === 0}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isImportingToDb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Guardando en PostgreSQL...
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-4 h-4" /> Confirmar e Importar al Stock ({importRows.filter((r) => r.selected).length})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Detalle / Reporte de Compra Histórica */}
      {selectedPurchaseForDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-zinc-800 text-emerald-400 border border-zinc-700">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-white">
                      {selectedPurchaseForDetail.fileName}
                    </h3>
                    {selectedPurchaseForDetail.source === "initial_seed" ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                        Carga Inicial Oficial
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                        Importación Excel
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Cargado el {new Date(selectedPurchaseForDetail.date).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })} • {selectedPurchaseForDetail.notes}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchaseForDetail(null)}
                className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-zinc-900/40 border-b border-zinc-800/80 text-xs">
              <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Artículos</span>
                <span className="text-sm font-black text-white block mt-0.5">
                  {selectedPurchaseForDetail.totalItems} SKUs
                </span>
                <span className="text-[10px] text-zinc-500">
                  {selectedPurchaseForDetail.newItems} nuevos • {selectedPurchaseForDetail.restockItems} reingresos
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                <span className="text-[10px] text-blue-400 uppercase font-bold block">Unidades</span>
                <span className="text-sm font-black text-blue-300 block mt-0.5">
                  {selectedPurchaseForDetail.totalUnits} un.
                </span>
                <span className="text-[10px] text-zinc-500">Total compradas</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                <span className="text-[10px] text-amber-400 uppercase font-bold block">Costo s/ IVA</span>
                <span className="text-sm font-black text-amber-300 block mt-0.5">
                  ${selectedPurchaseForDetail.totalCostSinIva.toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-zinc-500">Neto proveedor</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-red-900/40">
                <span className="text-[10px] text-red-400 uppercase font-bold block">Costo c/ IVA (Total)</span>
                <span className="text-sm font-black text-red-300 block mt-0.5">
                  ${selectedPurchaseForDetail.totalCostConIva.toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-zinc-500">Inversión final</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-900/40 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">Venta Estimada</span>
                <span className="text-sm font-black text-emerald-300 block mt-0.5">
                  ${selectedPurchaseForDetail.totalSaleEstimated.toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-emerald-500">
                  Margen: +${(
                    selectedPurchaseForDetail.totalSaleEstimated - selectedPurchaseForDetail.totalCostConIva
                  ).toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            {/* Search bar inside detail */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={purchaseDetailSearchQuery}
                  onChange={(e) => setPurchaseDetailSearchQuery(e.target.value)}
                  placeholder="Filtrar artículos de esta compra por SKU, título o tipo..."
                  className="w-full pl-9 pr-3 py-1.5 bg-black/60 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-600"
                />
              </div>
              <span className="text-xs text-zinc-400 font-medium shrink-0">
                Mostrando {
                  selectedPurchaseForDetail.items.filter(
                    (i) =>
                      purchaseDetailSearchQuery === "" ||
                      i.sku.toLowerCase().includes(purchaseDetailSearchQuery.toLowerCase()) ||
                      i.title.toLowerCase().includes(purchaseDetailSearchQuery.toLowerCase()) ||
                      (i.tipo && i.tipo.toLowerCase().includes(purchaseDetailSearchQuery.toLowerCase()))
                  ).length
                } de {selectedPurchaseForDetail.items.length} artículos
              </span>
            </div>

            {/* Table of items */}
            <div className="flex-1 overflow-auto max-h-[50vh] p-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900/90 sticky top-0 z-10 border-b border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Artículo / Descripción</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3 text-right">Costo s/ IVA</th>
                    <th className="p-3 text-right">Costo c/ IVA</th>
                    <th className="p-3 text-right">Subtotal Compra</th>
                    <th className="p-3 text-right">Público Efectivo</th>
                    <th className="p-3 text-right">Subtotal Venta</th>
                    <th className="p-3 text-center">Impacto Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {selectedPurchaseForDetail.items
                    .filter(
                      (i) =>
                        purchaseDetailSearchQuery === "" ||
                        i.sku.toLowerCase().includes(purchaseDetailSearchQuery.toLowerCase()) ||
                        i.title.toLowerCase().includes(purchaseDetailSearchQuery.toLowerCase()) ||
                        (i.tipo && i.tipo.toLowerCase().includes(purchaseDetailSearchQuery.toLowerCase()))
                    )
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-white text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700">
                            {item.sku}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white line-clamp-1">{item.title}</div>
                          <div className="text-[11px] text-zinc-400">{item.tipo || item.category || "General"}</div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800 font-bold font-mono">
                            +{item.cantidadComprada}
                          </span>
                        </td>
                        <td className="p-3 text-right text-zinc-400 font-mono">
                          ${item.costoSinIva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-amber-300 font-mono font-medium">
                          ${item.costoConIva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-red-300 font-mono font-bold">
                          ${item.subtotalCostoConIva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-zinc-300 font-mono">
                          ${item.precioEfectivo.toLocaleString("es-AR")}
                        </td>
                        <td className="p-3 text-right text-emerald-300 font-mono font-bold">
                          ${item.subtotalVentaEstimada.toLocaleString("es-AR")}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {item.action === "new" ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                              ✨ Nuevo ({item.stockFinal} u.)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                              📦 {item.stockAnterior} ➔ {item.stockFinal} u.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedPurchaseForDetail(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cerrar
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printPurchaseReport()}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-zinc-400" /> Imprimir Remito / Reporte
                </button>
                <button
                  type="button"
                  onClick={() => exportSinglePurchaseCSV(selectedPurchaseForDetail)}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Descargar CSV
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Clean Footer (Without Tienda Demo Original) */}
      <footer className="relative z-10 border-t border-red-950/40 bg-black/80 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">Pecados Serranos</span>
            <span>•</span>
            <span className="italic text-red-400">Pueblo chico, infierno grande</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <Link href="https://www.multipaginas.com.ar/" className="hover:text-white transition-colors">
              Multipáginas | Soluciones web en punilla!
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              WhatsApp (+{whatsappNumber})
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
