"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
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
  PiggyBank,
  AlertTriangle,
  ZoomIn,
  UserCheck,
} from "lucide-react";
import InterestsTab from "@/app/components/InterestsTab";
import CashFlowTab, { type PricingPatch } from "@/app/components/CashFlowTab";
import ImageZoom from "@/app/components/ImageZoom";
import AsociadoPanel from "@/app/components/AsociadoPanel";
import AgeGate from "@/app/components/AgeGate";
import MercadoPagoSettings from "@/app/components/MercadoPagoSettings";
import BackupSettings from "@/app/components/BackupSettings";
import CashSummaryTab from "@/app/components/CashSummaryTab";
import {
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
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_LABELS,
  isCashPriceMethod,
  owedToStore,
  type PaymentMethod,
} from "./products";

export default function PecadosPage() {
  // Accesos privados por URL: /admin (panel de administración) y /asociado (revendedoras)
  const pathname = usePathname();
  const entry = pathname === "/admin" ? "admin" : pathname === "/asociado" ? "asociado" : null;
  // Store products & cart
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  // Commercial state (Sales, Resellers, Consignments)
  const [sales, setSales] = useState<Sale[]>([]);
  // Compras online todavía sin cobrar (no son ventas ni descuentan stock hasta confirmarse)
  const [pendingOrders, setPendingOrders] = useState<Sale[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);

  // Admin state & navigation
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<"catalog" | "cashflow" | "finance" | "stock" | "interests" | "purchases" | "sales" | "resellers" | "settings">("catalog");
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
    paymentMethod: PaymentMethod;
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
    commissionType: "percent" as "percent" | "fixed",
    commissionFixed: 0,
    notes: "",
    code: "",
    username: "",
    password: "",
  });

  // Consignment Modal (Entregar mercadería para revender)
  const [showConsignmentModal, setShowConsignmentModal] = useState(false);
  // Entrega de mercadería: varias filas (artículo, cantidad, precio de venta y comisión por unidad)
  type ConsignmentRow = { productId: string; quantity: number; unitAgreedPrice: number; commissionPerUnit: string };
  const [consignmentForm, setConsignmentForm] = useState<{ resellerId: string; notes: string; items: ConsignmentRow[] }>({
    resellerId: "",
    notes: "",
    items: [],
  });
  const newConsignmentRow = (p?: Product): ConsignmentRow => ({
    productId: p?.id || "",
    quantity: 1,
    unitAgreedPrice: p?.precioEfectivo || p?.price || 0,
    commissionPerUnit: "",
  });

  // Settle Consignment Modal (Rendir mercadería)
  const [settlingConsignment, setSettlingConsignment] = useState<Consignment | null>(null);
  // "rendir": cobrar lo vendido (y opcionalmente devolución) · "devolver": sólo devolución al depósito
  const [settleMode, setSettleMode] = useState<"rendir" | "devolver">("rendir");
  const [settleForm, setSettleForm] = useState({
    quantitySold: 0,
    quantityReturned: 0,
    paymentMethod: "efectivo" as PaymentMethod,
  });

  // Sales date filter
  const [salesDateFilter, setSalesDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  // Búsqueda de ventas por código de pedido, cliente o revendedora
  const [salesQuery, setSalesQuery] = useState("");

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

      // Costo de la factura (lo efectivamente pagado): P.U. + Imp. del Excel
      const rawCostoConIva = imp > 0 ? costoSinIva + imp : proveedorConIva(costoSinIva);

      const rawDesc = findVal(["Descripcion", "Descripción", "Detalle", "Producto", "Titulo", "Título", "Nombre", "Comentarios", "G", "g"]);
      const rawImage = findVal(["Imagen", "Foto", "Image", "URL", "A", "a"]);
      const rawTipo = findVal(["Tipo", "Categoria", "Categoría"]);

      // Verificar si ya existe en el catálogo actual
      const existing = products.find((p) => (p.sku || "").toUpperCase() === sku);

      if (existing) {
        restockCount++;
        const currentStock = existing.stock;
        const finalStock = currentStock + qty;
        // Costo de esta factura (para el registro de la compra). El costo del producto en
        // Flujo de caja no se modifica al confirmar.
        const cSin = costoSinIva > 0 ? costoSinIva : existing.costoSinIva || 0;
        const cCon = costoSinIva > 0 ? rawCostoConIva : proveedorConIva(cSin);

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
        const cCon = rawCostoConIva;
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
            // El costo de Flujo de caja manda; sólo se toma el de la factura si no había uno
            costoSinIva: existing.costoSinIva && existing.costoSinIva > 0 ? existing.costoSinIva : item.costoSinIva,
            costoConIva: proveedorConIva(
              existing.costoSinIva && existing.costoSinIva > 0 ? existing.costoSinIva : item.costoSinIva
            ),
            costPrice: proveedorConIva(
              existing.costoSinIva && existing.costoSinIva > 0 ? existing.costoSinIva : item.costoSinIva
            ),
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
            costoConIva: proveedorConIva(item.costoSinIva),
            costPrice: proveedorConIva(item.costoSinIva),
            multiplicadorGanancia: item.multiplicador,
            gananciaSugerida: proveedorConIva(item.costoSinIva) * item.multiplicador,
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
            ? ` Los ${addedCount} artículos nuevos quedan INCOMPLETOS hasta que cargues el multiplicador y el Precio Público FT: no se muestran en la tienda.`
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
          // stockBase: stock tal como vino del servidor (al guardar se envía sólo la diferencia)
          setProducts(data.products.map((p: Product) => ({ ...p, stockBase: p.stock })));
        }
        if (data.sales && Array.isArray(data.sales)) {
          setSales(data.sales);
        }
        setPendingOrders(Array.isArray(data.pendingOrders) ? data.pendingOrders : []);
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
      const body = JSON.stringify({
        products: newProds,
        sales: newSales,
        resellers: newResellers,
        consignments: newConsignments,
        purchases: newPurchases,
        whatsappNumber: newWhatsapp ?? whatsappNumber,
      });
      // Los próximos cambios de stock se calculan desde lo que se acaba de enviar
      setProducts(newProds.map((p) => ({ ...p, stockBase: p.stock })));
      const res = await fetch("/api/pecados/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
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
        // Resincronizar con el servidor (stock y consignaciones reales, incluidas ventas hechas en el medio)
        fetchServerData();
      }
    } catch (err) {
      console.error("Error al publicar datos en el servidor:", err);
    } finally {
      setIsSavingServer(false);
    }
  };

  // Client buyer info (obligatorios para comprar)
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const buyerDataOk = buyerName.trim().length >= 3 && buyerAddress.trim().length >= 3;
  const [showBuyerErrors, setShowBuyerErrors] = useState(false);

  // Cobro online con Mercado Pago (lo configura el admin; si no, el pedido sigue por WhatsApp)
  const [mpEnabled, setMpEnabled] = useState(false);
  // Método de pago del carrito: Mercado Pago (online) o efectivo en mano (pedido por WhatsApp)
  const [checkoutMethod, setCheckoutMethod] = useState<"mercadopago" | "efectivo">("efectivo");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  // Resultado al volver de Mercado Pago
  const [paymentResult, setPaymentResult] = useState<{
    // "sent": pedido en efectivo enviado por WhatsApp
    status: "completed" | "pending" | "rejected" | "cancelled" | "checking" | "error" | "sent";
    saleId: string;
    orderCode?: string | null;
    totalAmount?: number;
    items?: { title: string; quantity: number; subtotal: number }[];
  } | null>(null);
  // Código de pedido que se muestra antes de ir a pagar a Mercado Pago
  const [mpRedirect, setMpRedirect] = useState<{ orderCode: string; url: string } | null>(null);
  // Carrito guardado antes de ir a pagar (se recupera si el pago no se completa)
  const [cartToRestore, setCartToRestore] = useState<{ id: string; quantity: number; interest?: boolean }[] | null>(null);

  // Código de revendedora en el carrito (opcional; si se ingresa debe ser válido)
  const [cartCode, setCartCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  useEffect(() => {
    const c = cartCode.trim().toUpperCase();
    if (!c) {
      setCodeStatus("idle");
      return;
    }
    setCodeStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/codigo?c=${encodeURIComponent(c)}`, { cache: "no-store" });
        const d = await r.json();
        if (!cancelled) setCodeStatus(d?.valid ? "valid" : "invalid");
      } catch {
        if (!cancelled) setCodeStatus("invalid");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cartCode]);

  // Perfil Asociado (revendedor)
  const [asociadoActive, setAsociadoActive] = useState(false);
  const [showAsociadoLogin, setShowAsociadoLogin] = useState(false);
  const [asociadoUser, setAsociadoUser] = useState("");
  const [asociadoPass, setAsociadoPass] = useState("");
  const [asociadoError, setAsociadoError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  // Producto sin stock pendiente de confirmar "Me interesa" (modal de aviso)
  const [interestConfirmProduct, setInterestConfirmProduct] = useState<Product | null>(null);
  // Foto ampliada con lupa (tienda)
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);
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

    // ¿La tienda cobra online con Mercado Pago?
    fetch("/api/checkout", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setMpEnabled(Boolean(d?.mercadoPago));
        if (d?.mercadoPago) setCheckoutMethod("mercadopago");
      })
      .catch(() => {});

    // Vuelta desde Mercado Pago: ?pago=aprobado|pendiente|error&venta=<id>
    try {
      const params = new URLSearchParams(window.location.search);
      const pago = params.get("pago");
      const venta = params.get("venta");
      if (pago && venta) {
        window.history.replaceState(null, "", window.location.pathname);
        setPaymentResult({ status: "checking", saleId: venta });
        fetch("/api/mercadopago/estado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venta, abandoned: pago === "error" }),
        })
          .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
          .then(({ ok, d }) => {
            if (!ok) {
              setPaymentResult({ status: "error", saleId: venta });
              return;
            }
            setPaymentResult({ status: d.status, saleId: venta, orderCode: d.orderCode, totalAmount: d.totalAmount, items: d.items });
            const saved = sessionStorage.getItem("ps_checkout_cart");
            if (d.status === "completed" || d.status === "pending") {
              sessionStorage.removeItem("ps_checkout_cart");
            } else if (saved) {
              // No se pagó: el carrito vuelve como estaba
              const snap = JSON.parse(saved);
              if (snap?.saleId === venta) {
                setCartToRestore(snap.items || []);
                setBuyerName(snap.buyerName || "");
                setBuyerAddress(snap.buyerAddress || "");
                setCartCode(snap.code || "");
              }
              sessionStorage.removeItem("ps_checkout_cart");
            }
          })
          .catch(() => setPaymentResult({ status: "error", saleId: venta }));
      }
    } catch {}

    // Sesión de Asociado (revendedor)
    fetch("/api/asociado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.reseller) setAsociadoActive(true);
        else if (window.location.pathname === "/asociado") setShowAsociadoLogin(true);
      })
      .catch(() => {});

    // La sesión de administrador la valida el servidor (cookie HttpOnly)
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.isAdmin) {
          setIsAdmin(true);
          setIsCartOpen(false);
          setCart([]);
        } else if (window.location.pathname === "/admin") {
          setShowLoginModal(true);
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

  // Login / logout del perfil Asociado
  const handleAsociadoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAsociadoError("");
    try {
      const res = await fetch("/api/asociado/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: asociadoUser.trim(), password: asociadoPass }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setAsociadoError(d?.error || "Usuario o contraseña incorrectos.");
        return;
      }
      setShowAsociadoLogin(false);
      setAsociadoUser("");
      setAsociadoPass("");
      setIsCartOpen(false);
      setAsociadoActive(true);
    } catch {
      setAsociadoError("No se pudo conectar con el servidor.");
    }
  };

  const handleAsociadoLogout = useCallback(() => {
    setAsociadoActive(false);
    fetch("/api/asociado/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => window.location.assign("/"));
  }, []);

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
        // Vuelve a la tienda pública
        window.location.assign("/");
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

  useEffect(() => {
    if (!cartToRestore || products.length === 0) return;
    const restored: CartItem[] = [];
    for (const it of cartToRestore) {
      const product = products.find((p) => p.id === it.id);
      if (product) restored.push({ product, quantity: it.quantity, interest: it.interest });
    }
    setCart(restored);
    setCartToRestore(null);
  }, [cartToRestore, products]);

  useEffect(() => {
    setCheckoutError("");
    if (cart.length === 0) setShowBuyerErrors(false);
  }, [cart, checkoutMethod]);

  const purchaseCartItems = cart.filter((item) => !item.interest);
  const interestCartItems = cart.filter((item) => item.interest);
  const cartTotal = purchaseCartItems.reduce((sum, item) => sum + getItemUnitPrice(item.product, cartPaymentMethod) * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // "Finalizar compra": con Mercado Pago activo se paga online; si no, el pedido sigue por WhatsApp
  const handleFinalizePurchase = async () => {
    if (cart.length === 0 || checkoutBusy) return;
    if (!buyerDataOk) {
      setShowBuyerErrors(true);
      return;
    }
    const codeToSend = cartCode.trim().toUpperCase();
    if (codeToSend && codeStatus !== "valid") return;
    if (!mpEnabled || checkoutMethod === "efectivo" || purchaseCartItems.length === 0) {
      handleCheckoutWhatsApp();
      return;
    }
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      if (interestCartItems.length > 0) {
        // Los productos sin stock quedan registrados como interés (no se cobran)
        await fetch("/api/interes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: interestCartItems.map((i) => ({ sku: i.product.sku, quantity: i.quantity })),
            buyerName: buyerName.trim(),
            buyerAddress: buyerAddress.trim(),
            resellerCode: codeToSend,
          }),
        }).catch(() => {});
      }
      // Orden que este navegador ya había mandado a pagar (si se cerró Mercado Pago sin pagar, se reemplaza)
      let previousOrder = "";
      try {
        previousOrder = JSON.parse(sessionStorage.getItem("ps_checkout_cart") || "null")?.saleId || "";
      } catch {}
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout: "mercadopago",
          previousOrder,
          items: purchaseCartItems.map((i) => ({ sku: i.product.sku, quantity: i.quantity })),
          buyerName: buyerName.trim(),
          buyerAddress: buyerAddress.trim(),
          resellerCode: codeToSend,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.alreadyPaid) {
        // La compra anterior ya estaba pagada: no se cobra de nuevo
        try {
          sessionStorage.removeItem("ps_checkout_cart");
        } catch {}
        setCart([]);
        setIsCartOpen(false);
        setPaymentResult({ status: "checking", saleId: out.saleId });
        const st = await fetch("/api/mercadopago/estado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venta: out.saleId }),
        })
          .then((r) => r.json())
          .catch(() => null);
        setPaymentResult({ status: "completed", saleId: out.saleId, orderCode: st?.orderCode, totalAmount: st?.totalAmount, items: st?.items });
        return;
      }
      if (!res.ok || !out.paymentUrl) {
        setCheckoutError(out.error || "No se pudo iniciar el pago. Probá de nuevo.");
        fetchServerData();
        return;
      }
      try {
        sessionStorage.setItem(
          "ps_checkout_cart",
          JSON.stringify({
            saleId: out.saleId,
            items: purchaseCartItems.map((i) => ({ id: i.product.id, quantity: i.quantity })),
            buyerName,
            buyerAddress,
            code: cartCode,
          })
        );
      } catch {}
      // Antes de ir a pagar: el código de pedido para que lo anote
      setShowBuyerErrors(false);
      setMpRedirect({ orderCode: out.orderCode, url: out.paymentUrl });
    } catch {
      setCheckoutError("No se pudo conectar. Revisá tu conexión y probá de nuevo.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  // Link de WhatsApp con mensaje. Se usa api.whatsapp.com directo: la redirección de wa.me
  // rompe los emojis del texto (llegan como "�").
  const whatsappLink = (phone: string, text: string) =>
    `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;

  // Mensaje de WhatsApp para coordinar la entrega de una compra ya pagada
  const paidOrderWhatsAppUrl = (r: NonNullable<typeof paymentResult>) => {
    let msg = `🔥 *¡Hola Pecados Serranos!* Ya pagué mi compra con Mercado Pago.\n\n🧾 *Código de pedido:* ${r.orderCode || r.saleId.slice(-8).toUpperCase()}\n`;
    for (const i of r.items || []) msg += `• ${i.quantity}x ${i.title} — ${formatMoney(i.subtotal)}\n`;
    if (r.totalAmount) msg += `\n💰 *Total pagado:* ${formatMoney(r.totalAmount)}\n`;
    msg += "\n¿Coordinamos la entrega? ¡Gracias!";
    return whatsappLink(whatsappNumber, msg);
  };

  // Checkout WhatsApp generator + Automatic Sale Record
  const handleCheckoutWhatsApp = async () => {
    if (cart.length === 0 || checkoutBusy) return;
    if (!buyerDataOk) {
      setShowBuyerErrors(true);
      return;
    }
    // Con código: sólo si es válido (sin código también se puede comprar)
    const codeToSend = cartCode.trim().toUpperCase();
    if (codeToSend && codeStatus !== "valid") return;
    const hasPurchase = purchaseCartItems.length > 0;
    const hasInterest = interestCartItems.length > 0;

    let message = hasPurchase
      ? "🔥 *¡Hola Pecados Serranos!* Quiero realizar el siguiente pedido:\n\n🧾 *Código de pedido:* {{CODIGO}}\n\n"
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
      message += `💵 *Forma de pago:* Efectivo en mano al recibir\n`;
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
    if (codeToSend) {
      message += `🏷️ *Código de revendedora:* ${codeToSend}\n`;
    }

    message += hasPurchase
      ? "\n¿Me confirman disponibilidad y coordinamos la entrega? ¡Muchas gracias!"
      : "\n¡Muchas gracias!";

    // WhatsApp se abre en una pestaña nueva preparada ahora (si se abre después de esperar al
    // servidor, el navegador la bloquea como ventana emergente)
    const waWindow = window.open("about:blank", "_blank");
    setCheckoutBusy(true);
    setCheckoutError("");
    let orderCode = "";
    let saleId = "";
    try {
      // Registrar el pedido (precios y stock los valida el servidor). Queda pendiente:
      // el stock se descuenta cuando el admin confirma que recibió el dinero.
      if (hasPurchase) {
        const res = await fetch("/api/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: saleItems.map((i) => ({ sku: i.productSku, quantity: i.quantity })),
            buyerName: buyerName.trim(),
            buyerAddress: buyerAddress.trim(),
            resellerCode: codeToSend,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          waWindow?.close();
          setCheckoutError(out.error || "No se pudo registrar el pedido. Probá de nuevo.");
          fetchServerData();
          return;
        }
        orderCode = out.orderCode || "";
        saleId = out.saleId || "";
      }
      if (hasInterest) {
        // Registro de interés: no es una venta ni descuenta stock
        await fetch("/api/interes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: interestCartItems.map((i) => ({ sku: i.product.sku, quantity: i.quantity })),
            buyerName: buyerName.trim(),
            buyerAddress: buyerAddress.trim(),
            resellerCode: codeToSend,
          }),
        }).catch((err) => console.error("Error registrando el interés:", err));
      }
    } catch {
      waWindow?.close();
      setCheckoutError("No se pudo conectar. Revisá tu conexión y probá de nuevo.");
      return;
    } finally {
      setCheckoutBusy(false);
    }

    const waUrl = whatsappLink(whatsappNumber, message.replace("{{CODIGO}}", orderCode || "-"));
    if (waWindow) waWindow.location.href = waUrl;
    else window.open(waUrl, "_blank");

    // Carrito vacío y confirmación con el código de pedido
    setCart([]);
    setShowBuyerErrors(false);
    setCheckoutError("");
    setIsCartOpen(false);
    fetchServerData();
    if (hasPurchase) {
      setPaymentResult({
        status: "sent",
        saleId,
        orderCode,
        totalAmount: cartTotal,
        items: purchaseCartItems.map((i) => ({
          title: i.product.title,
          quantity: i.quantity,
          subtotal: getItemUnitPrice(i.product, cartPaymentMethod) * i.quantity,
        })),
      });
    } else {
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 3000);
    }
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
        `El artículo se guardó, pero está INCOMPLETO y no se mostrará en la tienda.\n\nFalta: ${missing.join(", ")}.\n\nPodés completarlo en la pestaña "Flujo de stock".`
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
      commissionType: "percent" as "percent" | "fixed",
      commissionFixed: 0,
      notes: "",
      code: "",
      username: "",
      password: "",
    });
    setShowResellerModal(true);
  };

  const handleSaveReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellerForm.name.trim()) {
      alert("Ingresá el nombre del revendedor.");
      return;
    }
    const resellerId = editingReseller ? editingReseller.id : "res-" + Date.now();

    if (editingReseller) {
      const updated = resellers.map((r) =>
        r.id === editingReseller.id
          ? {
              ...r,
              name: resellerForm.name.trim(),
              phone: resellerForm.phone.replace(/[^0-9]/g, ""),
              zone: resellerForm.zone.trim(),
              commissionPercent: Number(resellerForm.commissionPercent) || 0,
              commissionType: resellerForm.commissionType,
              commissionFixed: Number(resellerForm.commissionFixed) || 0,
              notes: resellerForm.notes.trim(),
            }
          : r
      );
      await persistAllData(products, sales, updated, consignments);
    } else {
      const newRes: Reseller = {
        id: resellerId,
        name: resellerForm.name.trim(),
        phone: resellerForm.phone.replace(/[^0-9]/g, ""),
        zone: resellerForm.zone.trim() || "Local",
        commissionPercent: Number(resellerForm.commissionPercent) || 0,
        commissionType: resellerForm.commissionType,
        commissionFixed: Number(resellerForm.commissionFixed) || 0,
        notes: resellerForm.notes.trim(),
        createdAt: new Date().toISOString(),
      };
      await persistAllData(products, sales, [newRes, ...resellers], consignments);
    }

    // Código y acceso al perfil Asociado
    const res = await fetch("/api/admin/revendedores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: resellerId,
        code: resellerForm.code,
        username: resellerForm.username,
        password: resellerForm.password,
      }),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`Los datos del revendedor se guardaron, pero no el código/acceso:\n${out?.error || "Error al guardar."}`);
      fetchServerData();
      return;
    }
    setResellers((prev) =>
      prev.map((r) =>
        r.id === resellerId ? { ...r, code: out.code || undefined, username: out.username || undefined, hasPassword: out.hasPassword } : r
      )
    );
    setShowResellerModal(false);
  };

  const handleDeleteReseller = async (id: string) => {
    if (!window.confirm("¿Seguro que deseás dar de baja este revendedor?\nPierde el acceso como Asociado y su código deja de funcionar. Sus ventas se conservan.")) return;
    const res = await fetch("/api/admin/revendedores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok && res.status !== 404) {
      const out = await res.json().catch(() => null);
      alert(out?.error || "No se pudo dar de baja al revendedor.");
      return;
    }
    setResellers((prev) => prev.filter((r) => r.id !== id));
  };

  // Consignment delivery handler (Entregar mercadería para revender)
  const handleSaveConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    const reseller = resellers.find((r) => r.id === consignmentForm.resellerId);
    if (!reseller) {
      alert("Seleccioná una revendedora.");
      return;
    }
    if (consignmentForm.items.length === 0) {
      alert("Agregá al menos un artículo.");
      return;
    }

    // Validaciones: cantidad, comisión obligatoria por artículo y stock del depósito
    const qtyByProduct = new Map<string, number>();
    for (const row of consignmentForm.items) {
      const product = products.find((p) => p.id === row.productId);
      if (!product) {
        alert("Seleccioná el artículo en todas las filas.");
        return;
      }
      if (!(Number(row.quantity) > 0)) {
        alert(`Indicá la cantidad a entregar de "${product.title}".`);
        return;
      }
      if (row.commissionPerUnit.trim() === "" || !(Number(row.commissionPerUnit) >= 0)) {
        alert(`Falta la comisión por unidad de "${product.title}". Es obligatoria.`);
        return;
      }
      qtyByProduct.set(product.id, (qtyByProduct.get(product.id) || 0) + Number(row.quantity));
    }
    for (const [productId, qty] of qtyByProduct) {
      const product = products.find((p) => p.id === productId)!;
      if (qty > product.stock) {
        alert(`No hay stock suficiente de "${product.title}" en depósito. Disponible: ${product.stock} un.`);
        return;
      }
    }

    // Descontar del depósito y crear un lote por artículo
    const updatedProducts = products.map((p) => (qtyByProduct.has(p.id) ? { ...p, stock: p.stock - qtyByProduct.get(p.id)! } : p));
    const now = Date.now();
    const newConsignments: Consignment[] = consignmentForm.items.map((row, idx) => {
      const product = products.find((p) => p.id === row.productId)!;
      return {
        id: `cons-${now}-${idx}`,
        resellerId: reseller.id,
        resellerName: reseller.name,
        date: new Date().toISOString(),
        productId: product.id,
        productSku: product.sku || "S/C",
        productTitle: product.title,
        quantityGiven: Number(row.quantity),
        unitAgreedPrice: Number(row.unitAgreedPrice) || product.precioEfectivo || product.price,
        commissionPerUnit: Number(row.commissionPerUnit),
        quantitySold: 0,
        quantityReturned: 0,
        status: "active",
        notes: consignmentForm.notes.trim(),
      };
    });

    persistAllData(updatedProducts, sales, resellers, [...newConsignments, ...consignments]);
    setShowConsignmentModal(false);
  };

  // Definir o cambiar la comisión por unidad de un lote ya entregado
  const handleSetLotCommission = (c: Consignment) => {
    const value = window.prompt(
      `Comisión por unidad vendida para "${c.productTitle}" (${c.resellerName}):`,
      c.commissionPerUnit !== null && c.commissionPerUnit !== undefined ? String(c.commissionPerUnit) : ""
    );
    if (value === null) return;
    const n = Number(value.replace(",", "."));
    if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
      alert("Ingresá un monto válido (0 o más).");
      return;
    }
    const updated = consignments.map((x) => (x.id === c.id ? { ...x, commissionPerUnit: n } : x));
    persistAllData(products, sales, resellers, updated).then(() =>
      // Las ventas de ese artículo que quedaron con comisión "a definir" toman este valor
      applyPendingCommission(c.resellerId, c.productId, n)
    );
  };

  // Comisión de artículos vendidos por una revendedora que quedaron "a definir"
  // (ej: vendidos con su código sin habérsele entregado mercadería de ese artículo)
  const applyPendingCommission = async (resellerId: string, productId: string, commissionUnit: number) => {
    try {
      const res = await fetch("/api/admin/comisiones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resellerId, productId, commissionUnit }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) alert(out.error || "No se pudo guardar la comisión.");
    } catch {
      alert("No se pudo guardar la comisión. Revisá la conexión.");
    }
    fetchServerData();
  };

  const handleDefineSoldCommission = (resellerId: string, resellerName: string, productId: string, productTitle: string) => {
    const value = window.prompt(`Comisión por unidad vendida de "${productTitle}" para ${resellerName}:`, "");
    if (value === null) return;
    const n = Number(value.replace(",", "."));
    if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
      alert("Ingresá un monto válido (0 o más).");
      return;
    }
    applyPendingCommission(resellerId, productId, n);
  };

  // Settle consignment (Rendir cuentas con revendedor)
  const handleSettleConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingConsignment) return;

    const sold = settleMode === "devolver" ? 0 : Number(settleForm.quantitySold) || 0;
    const returned = Number(settleForm.quantityReturned) || 0;
    if (sold + returned <= 0) {
      alert(settleMode === "devolver" ? "Indicá cuántas unidades devuelve." : "Indicá unidades vendidas o devueltas.");
      return;
    }

    // Sólo se rinde lo pendiente (lo que la asociada ya registró como vendido no se vuelve a contar)
    const pendingNow =
      settlingConsignment.quantityGiven - settlingConsignment.quantitySold - settlingConsignment.quantityReturned;
    if (sold + returned > pendingNow) {
      alert(`La suma de vendidos (${sold}) y devueltos (${returned}) supera lo pendiente de rendición (${pendingNow}).`);
      return;
    }

    // 1. Reingresar las unidades devueltas al stock del depósito
    const updatedProducts = products.map((p) =>
      p.id === settlingConsignment.productId ? { ...p, stock: p.stock + returned } : p
    );

    // 2. Si vendió unidades, registrar venta comercial (comisión: la del lote, obligatoria)
    let updatedSales = sales;
    if (sold > 0) {
      const lotCommission = settlingConsignment.commissionPerUnit;
      if (lotCommission === null || lotCommission === undefined) {
        alert("Este lote no tiene comisión por unidad definida. Definila en la columna \"Comisión c/u\" antes de rendir.");
        return;
      }
      const subtotal = sold * settlingConsignment.unitAgreedPrice;
      const commissionAmount = Math.round(lotCommission * sold * 100) / 100;
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
            commissionUnit: lotCommission,
            consignmentId: settlingConsignment.id,
          },
        ],
        settledAt: new Date().toISOString(),
        totalAmount: subtotal,
        paymentMethod: settleForm.paymentMethod,
        status: "completed",
        notes: `Rendición de lote. Comisión revendedora: ${formatMoney(commissionAmount)} (${formatMoney(lotCommission)} c/u). Neto cobrado: $${netToCollect.toLocaleString("es-AR")}.`,
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
            status: (c.quantitySold + sold + c.quantityReturned + returned >= c.quantityGiven ? "settled" : "active") as
              | "active"
              | "settled",
          }
        : c
    );

    persistAllData(updatedProducts, updatedSales, resellers, updatedConsignments);
    setSettlingConsignment(null);
  };

  // Precio unitario de la venta manual según el medio de pago
  const manualSaleUnitPrice = (prod: Product, method: PaymentMethod) => {
    // Efectivo / transferencia / Mercado Pago: Precio Público FT. Tarjeta y otros: Precio Público TC.
    if (isCashPriceMethod(method) && prod.precioEfectivo && prod.precioEfectivo > 0) return prod.precioEfectivo;
    return getItemUnitPrice(prod);
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

    // Stock suficiente considerando el mismo producto en varias líneas
    const qtyByProduct = new Map<string, number>();
    for (const item of saleForm.items) qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.quantity);
    for (const [productId, qty] of qtyByProduct) {
      const prod = products.find((p) => p.id === productId);
      if (prod && qty > prod.stock) {
        alert(`No hay suficiente stock para "${prod.title}". Stock disponible: ${prod.stock}`);
        return;
      }
    }

    for (const item of saleForm.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;
      // Precio Público FT en efectivo / transferencia / Mercado Pago; TC con tarjeta
      const unitPrice = manualSaleUnitPrice(prod, saleForm.paymentMethod);
      const subtotal = Math.round(unitPrice * item.quantity * 100) / 100;
      total += subtotal;
      saleItems.push({
        productId: prod.id,
        productSku: prod.sku || "S/C",
        productTitle: prod.title,
        quantity: item.quantity,
        unitPrice,
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
      totalAmount: Math.round(total * 100) / 100,
      paymentMethod: saleForm.paymentMethod,
      status: "completed",
      notes: [
        saleForm.notes.trim(),
        isCashPriceMethod(saleForm.paymentMethod) ? "Descuento por pago en efectivo (Precio Público FT)" : "",
      ]
        .filter(Boolean)
        .join(" | "),
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
  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm("¿Seguro que deseás anular esta venta? El stock vuelve al depósito (o a la revendedora si era de su mercadería).")) return;
    try {
      const res = await fetch("/api/admin/ventas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saleId }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) alert(out.error || "No se pudo anular la venta.");
    } catch {
      alert("No se pudo anular la venta. Revisá la conexión.");
    }
    fetchServerData();
  };

  // Compras pendientes: confirmar cobro en efectivo, revisar el pago en Mercado Pago o rechazar
  const handlePendingOrder = async (order: Sale, action: "confirmar" | "revisar" | "rechazar") => {
    if (
      action === "confirmar" &&
      !window.confirm(
        `Pedido ${order.orderCode || ""}: ¿recibiste ${formatMoney(order.totalAmount)} de ${order.buyerName || "la clienta"}? Se registra la venta y se descuenta el stock.`
      )
    )
      return;
    if (action === "rechazar" && !window.confirm(`¿Rechazar la compra de ${order.buyerName || "la clienta"}? No se registra ninguna venta.`)) return;
    setPendingBusy(order.id);
    try {
      const res = await fetch("/api/admin/ventas", {
        method: action === "rechazar" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "rechazar" ? { id: order.id } : { id: order.id, action }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) alert(out.error || "No se pudo actualizar la compra.");
      else if (action === "revisar") {
        alert(
          out.status === "completed"
            ? "El pago está acreditado: la compra quedó confirmada."
            : out.status === "cancelled"
            ? "La compra venció sin pago y se anuló."
            : "Mercado Pago todavía no acreditó el pago."
        );
      }
    } catch {
      alert("No se pudo conectar con el servidor.");
    } finally {
      setPendingBusy(null);
      fetchServerData();
    }
  };

  // Ventas de revendedora rendidas (pagadas a la tienda) o de nuevo sin rendir
  const handleSetSalesSettled = async (ids: string[], settled: boolean) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/admin/ventas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, settled }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) alert(out.error || "No se pudo actualizar la venta.");
    } catch {
      alert("No se pudo actualizar la venta. Revisá la conexión.");
    }
    fetchServerData();
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
    const headers = ["FECHA", "CODIGO_PEDIDO", "ID_VENTA", "CLIENTE", "CANAL", "REVENDEDOR", "CODIGO_REVENDEDORA", "PRODUCTOS", "CANT_ITEMS", "TOTAL_ARS", "MEDIO_PAGO", "NOTAS"];
    const rows = sales.map((s) => {
      const itemsSummary = s.items.map((i) => `${i.quantity}x ${i.productTitle} (${i.productSku})`).join(" + ");
      return [
        new Date(s.date).toLocaleString("es-AR"),
        s.orderCode || "",
        s.id,
        `"${(s.buyerName || "Cliente").replace(/"/g, '""')}"`,
        s.channel === "web_whatsapp" ? "Web WhatsApp" : s.channel === "reseller" ? "Revendedor" : "Venta Directa",
        `"${(s.resellerName || "-").replace(/"/g, '""')}"`,
        `"${s.resellerCode || "-"}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        s.items.reduce((sum, i) => sum + i.quantity, 0),
        s.totalAmount,
        (PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod).toUpperCase(),
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
    const q = salesQuery.trim().toLowerCase();
    if (q && ![s.orderCode, s.buyerName, s.resellerName, s.resellerCode].some((v) => (v || "").toLowerCase().includes(q))) {
      return false;
    }
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

  // Perfil Asociado: sólo su panel de ventas
  if (asociadoActive && !isAdmin) {
    return <AsociadoPanel onLogout={handleAsociadoLogout} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0506] text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Aviso de sitio para adultos (en cada visita nueva a la tienda) */}
      {!isAdmin && !entry && <AgeGate />}
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
                <Wallet className="w-3.5 h-3.5" /> Flujo de stock
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
                onClick={() => setAdminTab("finance")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  adminTab === "finance"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-300 hover:text-white hover:bg-red-900/40"
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" /> Flujo de caja
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
                {pendingOrders.length > 0 && (
                  <span className="ml-1 px-1.5 rounded-full bg-amber-500 text-black text-[10px] font-black" title="Compras pendientes de cobro">
                    {pendingOrders.length}
                  </span>
                )}
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
        {isAdmin && adminTab === "finance" && <CashSummaryTab purchases={purchases} sales={sales} resellers={resellers} />}

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
                  Cantidad y precios públicos de cada artículo (mismos valores que <strong>Flujo de stock</strong>).
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
                title="Completar en Flujo de stock"
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
            {/* Compras online pendientes de cobro */}
            {pendingOrders.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-800/60 space-y-3">
                <div>
                  <h3 className="text-base font-bold text-amber-200 flex items-center gap-2">
                    ⏳ Compras pendientes de cobro ({pendingOrders.length})
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Todavía no son ventas y no descontaron stock. Las de efectivo confirmalas cuando recibas el dinero; las de Mercado Pago se
                    confirman solas cuando se acredita el pago.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {pendingOrders.map((o) => {
                    const isMp = o.paymentMethod === "mercadopago";
                    const busy = pendingBusy === o.id;
                    return (
                      <div key={o.id} className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block font-bold text-white">{o.buyerName || "Cliente"}</span>
                            <span className="block text-[11px] text-zinc-400">
                              {new Date(o.date).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              {" · Pedido "}
                              <span className="font-mono font-bold text-amber-300 tracking-wider">{o.orderCode || o.id.slice(-8).toUpperCase()}</span>
                            </span>
                            {o.notes && <span className="block text-[11px] text-zinc-300 mt-0.5">{o.notes}</span>}
                            {o.resellerCode && (
                              <span className="block text-[10px] font-bold text-amber-300 mt-0.5">
                                🏷️ Código {o.resellerCode} → {o.resellerName}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="block text-base font-black font-mono text-white">{formatMoney(o.totalAmount)}</span>
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isMp ? "bg-sky-950 text-sky-300 border-sky-800" : "bg-emerald-950 text-emerald-300 border-emerald-800"
                              }`}
                            >
                              {isMp ? "Mercado Pago · esperando pago" : "Efectivo en mano"}
                            </span>
                          </div>
                        </div>
                        <ul className="space-y-0.5 text-zinc-300">
                          {o.items.map((i, idx) => (
                            <li key={idx}>
                              <strong className="text-white">{i.quantity}x</strong> {i.productTitle}{" "}
                              <span className="text-zinc-500">— {formatMoney(i.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="pt-2 border-t border-zinc-800 flex flex-wrap justify-end gap-2">
                          {isMp ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handlePendingOrder(o, "revisar")}
                              className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold cursor-pointer"
                            >
                              Revisar pago
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handlePendingOrder(o, "confirmar")}
                              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold cursor-pointer"
                            >
                              Confirmar cobro
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handlePendingOrder(o, "rechazar")}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 border border-zinc-700 hover:border-red-800 disabled:opacity-50 text-zinc-200 font-bold cursor-pointer"
                          >
                            {isMp ? "Anular" : "Rechazar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                      items: (() => {
                        const first = products.find((p) => p.stock > 0) || products[0];
                        return first ? [{ productId: first.id, quantity: 1 }] : [];
                      })(),
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
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={salesQuery}
                onChange={(e) => setSalesQuery(e.target.value)}
                placeholder="Buscar código de pedido o cliente"
                className="w-full sm:w-64 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
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
                            {s.orderCode && (
                              <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[10px] font-mono font-bold text-amber-300 tracking-wider">
                                Pedido {s.orderCode}
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1 mt-0.5">
                              {s.channel === "web_whatsapp" && s.resellerId ? (
                                <span className="text-amber-400 font-medium">WhatsApp Web · Venta de {s.resellerName || "revendedora"} (código)</span>
                              ) : s.channel === "web_whatsapp" ? (
                                <span className="text-emerald-400 font-medium">WhatsApp Web</span>
                              ) : s.channel === "reseller" ? (
                                <span className="text-amber-400 font-medium">Revendedor: {s.resellerName}</span>
                              ) : (
                                <span className="text-blue-400 font-medium">Venta Directa</span>
                              )}
                            </span>
                            {s.resellerId && (
                              <span
                                className={`mt-1 block text-[10px] font-bold ${s.commissionPending ? "text-amber-300" : "text-zinc-300"}`}
                              >
                                Comisión: {formatMoney(s.commissionTotal || 0)}
                                {s.commissionPending ? " · a definir (artículo sin comisión asignada)" : ""}
                              </span>
                            )}
                            {s.paymentMethod === "mercadopago" && s.channel === "web_whatsapp" && (
                              <span
                                className={`mt-1 block text-[10px] font-bold ${s.status === "pending" ? "text-amber-300" : "text-sky-300"}`}
                              >
                                {s.status === "pending"
                                  ? "⏳ Esperando el pago en Mercado Pago (productos reservados)"
                                  : "✓ Pagada online con Mercado Pago"}
                              </span>
                            )}
                            {s.notes?.includes("mercadería en consignación") && (
                              <span className="mt-1 block text-[10px] font-bold text-amber-300">
                                📦 De su mercadería en consignación
                              </span>
                            )}
                            {owedToStore(s) > 0 &&
                              (s.settledAt ? (
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                                  ✓ Rendida a la tienda ({formatMoney(owedToStore(s))})
                                  <button
                                    type="button"
                                    onClick={() => handleSetSalesSettled([s.id], false)}
                                    className="text-zinc-500 hover:text-zinc-300 underline font-normal cursor-pointer"
                                  >
                                    deshacer
                                  </button>
                                </span>
                              ) : (
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-sky-300">
                                  A cobrarle: {formatMoney(owedToStore(s))}
                                  <button
                                    type="button"
                                    onClick={() => handleSetSalesSettled([s.id], true)}
                                    className="px-1.5 py-0.5 rounded border border-emerald-700 bg-emerald-950 text-emerald-300 cursor-pointer"
                                  >
                                    Marcar rendida
                                  </button>
                                </span>
                              ))}
                            {s.resellerCode && (
                              <span className="mt-1 block text-[10px] font-bold text-amber-300">
                                🏷️ Código <span className="font-mono">{s.resellerCode}</span> → {s.resellerName || "revendedora"}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="space-y-1">
                              {s.items.map((i, idx) => (
                                <div key={idx} className="text-zinc-300 text-[11px]">
                                  <strong className="text-white">{i.quantity}x</strong> {i.productTitle}{" "}
                                  <span className="text-red-400 font-mono text-[10px]">[{i.productSku}]</span>{" "}
                                  <span className="text-zinc-500">— ${i.subtotal.toLocaleString("es-AR")}</span>
                                  {s.resellerId &&
                                    (i.commissionUnit === null || i.commissionUnit === undefined ? (
                                      i.productId && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDefineSoldCommission(s.resellerId!, s.resellerName || "la revendedora", i.productId, i.productTitle)
                                          }
                                          className="ml-1 px-1.5 py-0.5 rounded border border-amber-700 bg-amber-950 text-amber-300 text-[10px] font-bold cursor-pointer"
                                          title="Definir la comisión por unidad de este artículo para esta revendedora"
                                        >
                                          Definir comisión
                                        </button>
                                      )
                                    ) : (
                                      <span className="ml-1 text-amber-200/80 text-[10px]">· comisión {formatMoney(i.commissionUnit)} c/u</span>
                                    ))}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 uppercase text-zinc-400 font-medium text-[10px]">
                            {PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod}
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
                      notes: "",
                      items: [newConsignmentRow(products.find((p) => p.stock > 0))],
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
                // Todo lo que vendió: mercadería entregada en mano, depósito y compras con su código
                const resellerSales = sales.filter((s) => s.resellerId === r.id);
                const totalUnitsSold = resellerSales.reduce((sum, s) => sum + s.items.reduce((u, i) => u + i.quantity, 0), 0);
                const totalRevenueSold = resellerSales.reduce((sum, s) => sum + s.totalAmount, 0);
                const soldByProduct = new Map<
                  string,
                  { productId: string; title: string; sku: string; units: number; total: number; commission: number; pending: number; byCode: number; inHand: number }
                >();
                for (const s of resellerSales) {
                  const byCode = s.channel === "web_whatsapp";
                  const inHand = !byCode && /consignaci|Rendición de lote/.test(s.notes || "");
                  for (const i of s.items) {
                    const key = i.productId || i.productSku;
                    const row = soldByProduct.get(key) || {
                      productId: i.productId,
                      title: i.productTitle,
                      sku: i.productSku,
                      units: 0,
                      total: 0,
                      commission: 0,
                      pending: 0,
                      byCode: 0,
                      inHand: 0,
                    };
                    row.units += i.quantity;
                    row.total += i.subtotal;
                    row.commission += i.commission || 0;
                    if (i.commissionUnit === null || i.commissionUnit === undefined) row.pending += i.quantity;
                    if (byCode) row.byCode += i.quantity;
                    else if (inHand) row.inHand += i.quantity;
                    soldByProduct.set(key, row);
                  }
                }
                const soldRows = [...soldByProduct.values()].sort((a, b) => b.units - a.units);
                const unsettledSales = resellerSales.filter((s) => !s.settledAt && owedToStore(s) > 0);
                const owedNow = unsettledSales.reduce((sum, s) => sum + owedToStore(s), 0);
                const totalCommissionEarned = resellerSales.reduce((sum, s) => sum + (s.commissionTotal || 0), 0);
                const pendingCommissionSales = resellerSales.filter((s) => s.commissionPending).length;

                return (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-red-900/50 flex flex-col justify-between transition-all shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        {r.code && (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-950 text-amber-300 border border-amber-800 text-[10px] font-bold font-mono">
                            {r.code}
                          </span>
                        )}
                        {r.username && (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold" title="Puede entrar como Asociado">
                            👤 {r.username}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingReseller(r);
                              setResellerForm({
                                name: r.name,
                                phone: r.phone,
                                zone: r.zone,
                                commissionPercent: r.commissionPercent,
                                commissionType: r.commissionType === "fixed" ? "fixed" : "percent",
                                commissionFixed: r.commissionFixed || 0,
                                notes: r.notes || "",
                                code: r.code || "",
                                username: r.username || "",
                                password: "",
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
                            {formatMoney(totalRevenueSold)}
                          </span>
                          <span className="text-[10px] text-zinc-500">{totalUnitsSold} un.</span>
                        </div>
                      </div>

                      {/* Lo que la revendedora cobró y todavía no le pagó a la tienda */}
                      <div className="mt-2 p-2.5 rounded-xl bg-sky-950/30 border border-sky-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-sky-200">
                          Pendiente de rendir: <strong className="font-mono text-sky-300">{formatMoney(owedNow)}</strong>
                          <span className="text-[10px] text-zinc-400"> ({unsettledSales.length} {unsettledSales.length === 1 ? "venta" : "ventas"})</span>
                        </span>
                        {unsettledSales.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿${r.name} te pagó ${formatMoney(owedNow)}? Se marcan como rendidas ${unsettledSales.length} ventas.`)) {
                                handleSetSalesSettled(unsettledSales.map((s) => s.id), true);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Marcar todo rendido
                          </button>
                        )}
                      </div>

                      {/* Artículos vendidos (en mano, del depósito o con su código) */}
                      <div className="mt-3">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1.5">Artículos vendidos</span>
                        {soldRows.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">Todavía no vendió artículos.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {soldRows.map((row) => (
                              <div key={row.productId || row.sku} className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/60 text-[11px]">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-zinc-200 font-semibold leading-snug">
                                    <strong className="text-white">{row.units}x</strong> {row.title}
                                  </span>
                                  <span className="font-mono text-emerald-400 whitespace-nowrap">{formatMoney(row.total)}</span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-400">
                                  {row.inHand > 0 && <span>📦 {row.inHand} en mano</span>}
                                  {row.byCode > 0 && <span className="text-amber-300">🏷️ {row.byCode} con su código</span>}
                                  {row.units - row.inHand - row.byCode > 0 && <span>🏬 {row.units - row.inHand - row.byCode} del depósito</span>}
                                  <span className="text-amber-200">Comisión: {formatMoney(row.commission)}</span>
                                  {row.pending > 0 && row.productId && (
                                    <button
                                      type="button"
                                      onClick={() => handleDefineSoldCommission(r.id, r.name, row.productId, row.title)}
                                      className="px-1.5 py-0.5 rounded border border-amber-700 bg-amber-950 text-amber-300 font-bold cursor-pointer"
                                      title="Definir la comisión por unidad de este artículo"
                                    >
                                      Definir comisión ({row.pending} un.)
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
                        Comisión ganada: <strong className="text-white">{formatMoney(totalCommissionEarned)}</strong>
                        {pendingCommissionSales > 0 && (
                          <span className="ml-1 text-amber-300 font-bold" title="Ventas con algún artículo sin comisión definida">
                            ({pendingCommissionSales} a definir)
                          </span>
                        )}
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
                          <th className="p-3.5">Comisión c/u</th>
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
                                <button
                                  type="button"
                                  onClick={() => handleSetLotCommission(c)}
                                  className={`font-mono text-[11px] px-2 py-0.5 rounded border cursor-pointer ${
                                    c.commissionPerUnit === null || c.commissionPerUnit === undefined
                                      ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                      : "bg-zinc-950 text-zinc-200 border-zinc-700 hover:border-zinc-500"
                                  }`}
                                  title="Definir o cambiar la comisión por unidad de este lote"
                                >
                                  {c.commissionPerUnit === null || c.commissionPerUnit === undefined
                                    ? "Definir"
                                    : formatMoney(c.commissionPerUnit)}
                                </button>
                              </td>
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
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setSettleMode("rendir");
                                      setSettlingConsignment(c);
                                      setSettleForm({
                                        quantitySold: pending,
                                        quantityReturned: 0,
                                        paymentMethod: "efectivo",
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors whitespace-nowrap"
                                  >
                                    Rendir / Cobrar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSettleMode("devolver");
                                      setSettlingConsignment(c);
                                      setSettleForm({
                                        quantitySold: 0,
                                        quantityReturned: pending,
                                        paymentMethod: "efectivo",
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-bold text-[11px] transition-colors whitespace-nowrap"
                                    title="La revendedora devuelve unidades: vuelven al stock del depósito"
                                  >
                                    Devolver
                                  </button>
                                  </div>
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
              <MercadoPagoSettings />

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

              <BackupSettings />
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
                        <button
                          type="button"
                          onClick={() => setZoomProduct(product)}
                          className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
                          aria-label={`Ampliar foto de ${product.title}`}
                        >
                          <Image
                            src={product.image || "/pecados/auriculares.jpg"}
                            alt={product.title}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
                            unoptimized={true}
                            className="object-contain p-1 group-hover:scale-105 transition-transform duration-300 drop-shadow-md select-none"
                          />
                          {!isAdmin && (
                            <span className="absolute bottom-1.5 right-1.5 p-1.5 rounded-full bg-black/70 text-white border border-zinc-700 shadow-md">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </button>

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
                                title="No se muestra en la tienda hasta completar estos datos (pestaña Flujo de stock)"
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
                        Tus datos para el pedido
                      </span>
                      <div>
                        <input
                          type="text"
                          placeholder="Nombre completo *"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          required
                          autoComplete="name"
                          maxLength={80}
                          aria-invalid={showBuyerErrors && buyerName.trim().length < 3}
                          className={`w-full px-3 py-2 rounded-xl bg-zinc-900 border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors ${
                            showBuyerErrors && buyerName.trim().length < 3 ? "border-red-600" : "border-zinc-800"
                          }`}
                        />
                        {showBuyerErrors && buyerName.trim().length < 3 && (
                          <p className="mt-1 text-[10px] text-red-400">Ingresá tu nombre completo.</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Dirección o punto de entrega *"
                          value={buyerAddress}
                          onChange={(e) => setBuyerAddress(e.target.value)}
                          required
                          autoComplete="street-address"
                          maxLength={200}
                          aria-invalid={showBuyerErrors && buyerAddress.trim().length < 3}
                          className={`w-full px-3 py-2 rounded-xl bg-zinc-900 border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors ${
                            showBuyerErrors && buyerAddress.trim().length < 3 ? "border-red-600" : "border-zinc-800"
                          }`}
                        />
                        {showBuyerErrors && buyerAddress.trim().length < 3 && (
                          <p className="mt-1 text-[10px] text-red-400">Ingresá la dirección o el punto de entrega.</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Código de revendedora (opcional)"
                          value={cartCode}
                          onChange={(e) => setCartCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20))}
                          autoCapitalize="characters"
                          className={`w-full px-3 py-2 rounded-xl bg-zinc-900 border text-xs text-white font-mono placeholder-zinc-500 placeholder:font-sans focus:outline-none transition-colors ${
                            codeStatus === "invalid"
                              ? "border-red-600 focus:border-red-500"
                              : codeStatus === "valid"
                              ? "border-emerald-600 focus:border-emerald-500"
                              : "border-zinc-800 focus:border-red-500"
                          }`}
                        />
                        {codeStatus === "checking" && <p className="mt-1 text-[10px] text-zinc-400">Verificando código…</p>}
                        {codeStatus === "valid" && <p className="mt-1 text-[10px] text-emerald-400">✓ Código válido</p>}
                        {codeStatus === "invalid" && (
                          <p className="mt-1 text-[10px] text-red-400">El código no existe. Revisalo o dejalo vacío para continuar.</p>
                        )}
                      </div>
                    </div>

                    {/* Método de pago */}
                    {purchaseCartItems.length > 0 && mpEnabled && (
                      <div className="space-y-2" role="radiogroup" aria-label="Método de pago">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Método de pago</span>
                        {(
                          [
                            ["mercadopago", "Mercado Pago", "Dinero en cuenta, tarjetas, Mercado Crédito o efectivo en Rapipago/Pago Fácil"],
                            ["efectivo", "Efectivo en mano", "Pagás al recibir. Coordinamos la entrega por WhatsApp"],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={checkoutMethod === value}
                            onClick={() => setCheckoutMethod(value)}
                            className={`w-full p-3 rounded-xl border flex items-center gap-3 text-left transition-colors cursor-pointer ${
                              checkoutMethod === value ? "border-sky-500 bg-sky-950/30" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                checkoutMethod === value ? "border-sky-400" : "border-zinc-600"
                              }`}
                            >
                              {checkoutMethod === value && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                            </span>
                            {value === "mercadopago" ? (
                              <span className="w-[74px] h-7 rounded-md bg-white flex items-center justify-center shrink-0 px-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/pecados/mercadopago.png" alt="Mercado Pago" className="max-h-5 w-auto" />
                              </span>
                            ) : (
                              <span className="w-[74px] h-7 rounded-md bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 text-base">
                                💵
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-white">{label}</span>
                              <span className="block text-[10px] text-zinc-400 leading-snug">{hint}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

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
                    {checkoutError && (
                      <p className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">{checkoutError}</p>
                    )}
                    <button
                      onClick={handleFinalizePurchase}
                      disabled={codeStatus === "invalid" || codeStatus === "checking" || checkoutBusy}
                      className={`w-full py-3.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                        purchaseCartItems.length > 0
                          ? "bg-red-600 hover:bg-red-500 shadow-red-950/40"
                          : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40"
                      }`}
                    >
                      {checkoutBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : purchaseCartItems.length > 0 ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                      <span>
                        {purchaseCartItems.length > 0
                          ? checkoutBusy
                            ? "Preparando el pago…"
                            : "Finalizar compra"
                          : "Avisar que me interesa por WhatsApp"}
                      </span>
                    </button>

                    <p className="text-[10px] text-center text-zinc-500 leading-tight">
                      {purchaseCartItems.length > 0 && mpEnabled && checkoutMethod === "mercadopago"
                        ? "Vas a pagar de forma segura en Mercado Pago. Tu compra se confirma cuando se acredita el pago."
                        : purchaseCartItems.length > 0
                        ? "Se abrirá WhatsApp con el detalle de tu pedido para coordinar la entrega. Pagás en efectivo al recibir."
                        : "Al tocar el botón se abrirá WhatsApp con el detalle completo de tus productos y tu mensaje listo para enviar."}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Código de pedido antes de ir a pagar a Mercado Pago */}
      <AnimatePresence>
        {mpRedirect && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-center"
            >
              <h3 className="text-xl font-black text-white">Tu pedido está listo para pagar</h3>
              <div className="mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-700">
                <span className="block text-[11px] uppercase tracking-wider font-bold text-amber-300">Tu código de pedido</span>
                <span className="block mt-0.5 text-3xl font-black font-mono tracking-[0.2em] text-white select-all">{mpRedirect.orderCode}</span>
                <span className="block mt-1 text-[11px] text-amber-200/90">Anotalo: es la referencia de tu compra con la tienda.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = mpRedirect.url;
                }}
                className="mt-5 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                Anoté el código — Ir a pagar con Mercado Pago
              </button>
              <button
                type="button"
                onClick={() => setMpRedirect(null)}
                className="mt-2 w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm cursor-pointer"
              >
                Volver al carrito
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resultado del pago al volver de Mercado Pago */}
      <AnimatePresence>
        {paymentResult && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => paymentResult.status !== "checking" && setPaymentResult(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-center"
            >
              {paymentResult.status === "checking" ? (
                <div className="py-6 flex flex-col items-center gap-3 text-zinc-300">
                  <Loader2 className="w-8 h-8 animate-spin text-red-400" />
                  <p className="text-sm">Confirmando tu pago con Mercado Pago…</p>
                </div>
              ) : (
                <>
                  <div className="text-5xl mb-3">
                    {paymentResult.status === "completed" || paymentResult.status === "sent"
                      ? "🎉"
                      : paymentResult.status === "pending"
                      ? "⏳"
                      : "⚠️"}
                  </div>
                  <h3 className="text-xl font-black text-white">
                    {paymentResult.status === "sent"
                      ? "¡Pedido enviado!"
                      : paymentResult.status === "completed"
                      ? "¡Gracias por tu compra!"
                      : paymentResult.status === "pending"
                      ? "Tu pago está pendiente"
                      : "El pago no se completó"}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-300">
                    {paymentResult.status === "sent"
                      ? "Te abrimos WhatsApp con el detalle de tu pedido: envialo para coordinar la entrega. Pagás en efectivo al recibir."
                      : paymentResult.status === "completed"
                      ? "Recibimos tu pago. Escribinos por WhatsApp para coordinar la entrega."
                      : paymentResult.status === "pending"
                      ? "Cuando Mercado Pago acredite el pago (por ejemplo, si elegiste pagar en efectivo) tu compra queda confirmada. Tus productos quedan reservados."
                      : paymentResult.status === "error"
                      ? "No pudimos confirmar el pago. Si te debitaron el dinero, escribinos por WhatsApp con tu número de compra."
                      : "No se realizó ningún cobro. Tu carrito sigue disponible para que vuelvas a intentarlo."}
                  </p>
                  {paymentResult.orderCode ? (
                    <div className="mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-700">
                      <span className="block text-[11px] uppercase tracking-wider font-bold text-amber-300">Tu código de pedido</span>
                      <span className="block mt-0.5 text-3xl font-black font-mono tracking-[0.2em] text-white select-all">{paymentResult.orderCode}</span>
                      <span className="block mt-1 text-[11px] text-amber-200/90">Anotalo: es la referencia de tu compra con la tienda.</span>
                    </div>
                  ) : (
                    paymentResult.saleId && (
                      <p className="mt-2 text-[11px] text-zinc-500 font-mono">Compra N° {paymentResult.saleId.slice(-8).toUpperCase()}</p>
                    )
                  )}
                  {(paymentResult.status === "completed" || paymentResult.status === "pending" || paymentResult.status === "sent") && paymentResult.items && (
                    <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-left space-y-1">
                      {paymentResult.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between gap-2 text-xs text-zinc-300">
                          <span>
                            <strong className="text-white">{i.quantity}x</strong> {i.title}
                          </span>
                          <span className="font-mono">{formatMoney(i.subtotal)}</span>
                        </div>
                      ))}
                      <div className="pt-1.5 mt-1.5 border-t border-zinc-800 flex justify-between text-sm font-bold text-white">
                        <span>Total</span>
                        <span className="font-mono">{formatMoney(paymentResult.totalAmount || 0)}</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-5 flex flex-col gap-2">
                    {paymentResult.status === "sent" ? null : paymentResult.status === "completed" || paymentResult.status === "error" ? (
                      <a
                        href={paidOrderWhatsAppUrl(paymentResult)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <Phone className="w-4 h-4" /> Escribir por WhatsApp
                      </a>
                    ) : paymentResult.status !== "pending" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentResult(null);
                          setIsCartOpen(true);
                        }}
                        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm cursor-pointer"
                      >
                        Volver al carrito
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPaymentResult(null)}
                      className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm cursor-pointer"
                    >
                      Seguir mirando la tienda
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Foto ampliada con lupa */}
      <AnimatePresence>
        {zoomProduct && (
          <ImageZoom
            key={zoomProduct.id}
            src={zoomProduct.image || "/pecados/auriculares.jpg"}
            zoomSrc={
              zoomProduct.image?.startsWith("/api/pecados/imagen/") ? `${zoomProduct.image}?size=original` : zoomProduct.image
            }
            alt={zoomProduct.title}
            onClose={() => setZoomProduct(null)}
          />
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

      {/* Login del perfil Asociado */}
      <AnimatePresence>
        {showAsociadoLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAsociadoLogin(false)}
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
                  <div className="p-2 rounded-xl bg-amber-950 text-amber-300 border border-amber-800/60">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Acceso Asociado</h3>
                </div>
                <button onClick={() => setShowAsociadoLogin(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAsociadoLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">Usuario</label>
                  <input
                    type="text"
                    value={asociadoUser}
                    onChange={(e) => setAsociadoUser(e.target.value)}
                    placeholder="Tu usuario"
                    autoFocus
                    autoCapitalize="none"
                    autoComplete="username"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={asociadoPass}
                    onChange={(e) => setAsociadoPass(e.target.value)}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {asociadoError && <p className="text-xs text-red-400 font-medium">{asociadoError}</p>}
                <button type="submit" className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold transition-colors cursor-pointer">
                  Ingresar como Asociado
                </button>
              </form>
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
                      <Wallet className="w-3.5 h-3.5 text-red-400" /> Flujo de stock
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
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={prodForm.multiplicadorGanancia || ""}
                        onChange={(e) => {
                          const m = Math.max(0, Number(e.target.value.replace(",", ".")) || 0);
                          setProdForm({
                            ...prodForm,
                            multiplicadorGanancia: m,
                            gananciaSugerida: proveedorConIva(prodForm.costoSinIva) * m,
                          });
                        }}
                        placeholder="Ej: 1.75"
                        className={`w-full px-3 py-1.5 rounded-xl bg-zinc-900 border text-xs font-mono focus:outline-none focus:border-red-500 ${
                          isValidMultiplier(prodForm.multiplicadorGanancia) ? "border-zinc-800 text-white" : "border-amber-600 text-amber-200"
                        }`}
                      />
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
                      onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value as PaymentMethod })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    >
                      {PAYMENT_METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[10px] text-zinc-500">
                      {isCashPriceMethod(saleForm.paymentMethod) ? "Se cobra el Precio Público FT (pago en efectivo)" : "Precio de la tienda (Precio Público TC), sin descuento"}
                    </span>
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
                          {r.name}
                          {r.zone ? ` — ${r.zone}` : ""}
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
                          // Primer producto con stock que todavía no esté en la venta
                          items: [
                            ...saleForm.items,
                            {
                              productId:
                                (
                                  products.find((p) => p.stock > 0 && !saleForm.items.some((it) => it.productId === p.id)) ||
                                  products.find((p) => p.stock > 0) ||
                                  products[0]
                                )?.id || "",
                              quantity: 1,
                            },
                          ],
                        })
                      }
                      className="text-red-400 hover:text-red-300 text-[11px] font-bold"
                    >
                      + Agregar ítem
                    </button>
                  </div>

                  <div className="space-y-2">
                    {saleForm.items.length === 0 && (
                      <p className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500 text-center">
                        Agregá al menos un producto.
                      </p>
                    )}
                    {saleForm.items.map((item, idx) => {
                      const selProd = products.find((p) => p.id === item.productId);
                      const unit = selProd ? manualSaleUnitPrice(selProd, saleForm.paymentMethod) : 0;
                      const updateItem = (patch: Partial<{ productId: string; quantity: number }>) => {
                        const newItems = saleForm.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
                        setSaleForm({ ...saleForm, items: newItems });
                      };
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[minmax(0,1fr)_76px_auto] sm:grid-cols-[minmax(0,1fr)_110px_76px_auto] gap-2 items-end bg-zinc-950 p-2.5 rounded-xl border border-zinc-800"
                        >
                          {/* Producto (sólo el nombre) */}
                          <div className="col-span-3 sm:col-span-1 min-w-0">
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Producto</label>
                            <select
                              value={item.productId}
                              onChange={(e) => updateItem({ productId: e.target.value, quantity: 1 })}
                              className="w-full min-w-0 bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-lg text-white text-xs truncate"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                  {p.title}
                                  {p.stock <= 0 ? " (sin stock)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Monto unitario según el medio de pago */}
                          <div className="min-w-0">
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Monto c/u</label>
                            <div className="px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-white font-mono text-xs truncate">
                              {formatMoney(unit)}
                            </div>
                          </div>

                          {/* Cantidad */}
                          <div>
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Cantidad</label>
                            <input
                              type="number"
                              min={1}
                              max={selProd?.stock || 1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem({ quantity: Math.min(Math.max(1, Number(e.target.value) || 1), Math.max(1, selProd?.stock || 1)) })
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-center text-xs"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => setSaleForm({ ...saleForm, items: saleForm.items.filter((_, i) => i !== idx) })}
                            className="p-2 mb-0.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
                            title="Quitar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {selProd && (
                            <p className="col-span-3 sm:col-span-4 text-[10px] text-zinc-500">
                              Stock disponible: {selProd.stock} · Subtotal:{" "}
                              <span className="text-zinc-300 font-mono">{formatMoney(unit * item.quantity)}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {saleForm.items.length > 0 &&
                    (() => {
                      const lista = saleForm.items.reduce((t, it) => {
                        const p = products.find((x) => x.id === it.productId);
                        return t + (p ? getItemUnitPrice(p) * it.quantity : 0);
                      }, 0);
                      const total = saleForm.items.reduce((t, it) => {
                        const p = products.find((x) => x.id === it.productId);
                        return t + (p ? manualSaleUnitPrice(p, saleForm.paymentMethod) * it.quantity : 0);
                      }, 0);
                      return (
                        <div className="mt-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                          <div className="flex justify-between text-zinc-400">
                            <span>Precio de la tienda</span>
                            <span className="font-mono">{formatMoney(lista)}</span>
                          </div>
                          {lista - total > 0.005 && (
                            <div className="flex justify-between text-emerald-400">
                              <span>Descuento por pago en efectivo</span>
                              <span className="font-mono">−{formatMoney(lista - total)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-zinc-800">
                            <span>Total</span>
                            <span className="font-mono">{formatMoney(total)}</span>
                          </div>
                        </div>
                      );
                    })()}
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

                {/* Código y acceso al perfil Asociado (sólo admin) */}
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/50 space-y-3">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> Código y acceso como Asociado
                  </span>
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Código de revendedora</label>
                    <input
                      type="text"
                      value={resellerForm.code}
                      onChange={(e) => setResellerForm({ ...resellerForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20) })}
                      placeholder="Ej: MARU10 (lo comparte con sus compradores)"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 font-medium block mb-1">Usuario</label>
                      <input
                        type="text"
                        value={resellerForm.username}
                        onChange={(e) => setResellerForm({ ...resellerForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30) })}
                        placeholder="ej: agostina"
                        autoComplete="off"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 font-medium block mb-1">
                        {editingReseller?.hasPassword ? "Nueva contraseña" : "Contraseña"}
                      </label>
                      <input
                        type="password"
                        value={resellerForm.password}
                        onChange={(e) => setResellerForm({ ...resellerForm, password: e.target.value })}
                        placeholder={editingReseller?.hasPassword ? "Vacío = no cambiar" : "Mín. 8 caracteres"}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Con usuario y contraseña puede entrar con el botón <strong>Asociado</strong> y ver/registrar sólo sus ventas.
                    Dejá el usuario vacío para quitarle el acceso.
                  </p>
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
              className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100 z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" /> Entregar Mercadería a Revendedora
                </h3>
                <button onClick={() => setShowConsignmentModal(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveConsignment} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs flex-1">
                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Revendedora</label>
                  <select
                    required
                    value={consignmentForm.resellerId}
                    onChange={(e) => setConsignmentForm({ ...consignmentForm, resellerId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  >
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.zone ? ` — ${r.zone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium">Artículos a entregar</label>
                    <button
                      type="button"
                      onClick={() =>
                        setConsignmentForm({
                          ...consignmentForm,
                          items: [
                            ...consignmentForm.items,
                            newConsignmentRow(
                              products.find((p) => p.stock > 0 && !consignmentForm.items.some((it) => it.productId === p.id))
                            ),
                          ],
                        })
                      }
                      className="text-amber-400 hover:text-amber-300 text-[11px] font-bold"
                    >
                      + Agregar artículo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {consignmentForm.items.map((row, idx) => {
                      const sel = products.find((p) => p.id === row.productId);
                      const update = (patch: Partial<ConsignmentRow>) =>
                        setConsignmentForm({
                          ...consignmentForm,
                          items: consignmentForm.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
                        });
                      const missingCommission = row.commissionPerUnit.trim() === "";
                      return (
                        <div key={idx} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <label className="text-[10px] text-zinc-500 block mb-0.5">Artículo</label>
                              <select
                                value={row.productId}
                                onChange={(e) => {
                                  const p = products.find((x) => x.id === e.target.value);
                                  update({ productId: e.target.value, unitAgreedPrice: p?.precioEfectivo || p?.price || 0 });
                                }}
                                className="w-full min-w-0 bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-lg text-white text-xs"
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                    {p.title} ({p.stock} en depósito)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConsignmentForm({ ...consignmentForm, items: consignmentForm.items.filter((_, i) => i !== idx) })}
                              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
                              aria-label="Quitar artículo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-500 block mb-0.5">Cantidad</label>
                              <input
                                type="number"
                                min={1}
                                max={sel?.stock || 1}
                                required
                                value={row.quantity}
                                onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
                                className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-500 block mb-0.5">Precio venta c/u</label>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                required
                                value={row.unitAgreedPrice}
                                onChange={(e) => update({ unitAgreedPrice: Math.max(0, Number(e.target.value) || 0) })}
                                className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className={`text-[10px] block mb-0.5 font-bold ${missingCommission ? "text-amber-300" : "text-zinc-500"}`}>
                                Comisión c/u *
                              </label>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                required
                                value={row.commissionPerUnit}
                                onChange={(e) => update({ commissionPerUnit: e.target.value })}
                                placeholder="$"
                                className={`w-full px-2 py-1.5 rounded-lg bg-zinc-900 border text-white font-mono ${
                                  missingCommission ? "border-amber-600" : "border-zinc-800"
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-zinc-500">
                    La comisión es un monto fijo por cada unidad que venda la revendedora (de este lote o con su código).
                  </p>
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
                  <button type="submit" className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold">
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
                  {settleMode === "devolver" ? (
                    <>
                      <RotateCcw className="w-4 h-4 text-amber-400" /> Devolución de Mercadería
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Rendición de Mercadería
                    </>
                  )}
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
                {settleMode === "devolver" && (
                  <p className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-900/60 text-amber-200 leading-snug">
                    Las unidades devueltas salen de lo que la revendedora tiene en mano y vuelven al stock del depósito.
                    No se registra ninguna venta.
                  </p>
                )}
                <div className={settleMode === "devolver" ? "" : "grid grid-cols-2 gap-3"}>
                  {settleMode !== "devolver" && (
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
                  )}
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">
                      {settleMode === "devolver" ? "Cantidad que devuelve" : "Cantidad Devuelta"}
                    </label>
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

                {settleMode !== "devolver" && (
                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Medio de Pago Rendido</label>
                  <select
                    value={settleForm.paymentMethod}
                    onChange={(e) => setSettleForm({ ...settleForm, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                )}

                {/* Calculation breakdown */}
                {settleMode !== "devolver" && settleForm.quantitySold > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
                    {(() => {
                      const res = resellers.find((r) => r.id === settlingConsignment.resellerId);
                      const gross = settleForm.quantitySold * settlingConsignment.unitAgreedPrice;
                      const cpu = settlingConsignment.commissionPerUnit;
                      const comm = (cpu ?? 0) * settleForm.quantitySold;
                      const net = gross - comm;
                      return (
                        <>
                          <div className="flex justify-between text-zinc-300">
                            <span>Venta Total:</span>
                            <strong className="font-mono">${gross.toLocaleString("es-AR")}</strong>
                          </div>
                          <div className="flex justify-between text-amber-300">
                            <span>
                              Comisión Revendedora ({cpu === null || cpu === undefined ? "sin definir" : `${formatMoney(cpu)} c/u`}):
                            </span>
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
                    {settleMode === "devolver" ? "Confirmar Devolución" : "Confirmar Rendición"}
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
