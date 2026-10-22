"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  HandHeart,
  ClipboardList,
  FileSpreadsheet,
  FileUp,
  Plus,
  Search,
  Trash2,
  CheckCheck,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import type { Product, ProductInterest, PurchasePlanItem } from "@/app/products";
import { buildPurchasePlanRows, PLAN_EXCEL_HEADERS } from "@/lib/purchase-plan-excel";
import { SKU_PATTERN } from "@/lib/pricing";

interface Props {
  products: Product[];
  onOpenImport: () => void;
  onPendingCountChange?: (count: number) => void;
}

interface InterestGroup {
  sku: string;
  title: string;
  product?: Product;
  units: number;
  people: number;
  lastDate: string;
  status: "pending" | "ordered";
  entries: ProductInterest[];
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function InterestsTab({ products, onOpenImport, onPendingCountChange }: Props) {
  const [interests, setInterests] = useState<ProductInterest[]>([]);
  const [plan, setPlan] = useState<PurchasePlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState({ sku: "", title: "", quantity: 1, costoSinIva: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) if (p.sku) m.set(p.sku.toUpperCase(), p);
    return m;
  }, [products]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ri, rp] = await Promise.all([
        fetch("/api/admin/interesados", { cache: "no-store" }),
        fetch("/api/admin/pedido-proveedor", { cache: "no-store" }),
      ]);
      if (!ri.ok || !rp.ok) throw new Error(ri.status === 401 || rp.status === 401 ? "auth" : "load");
      setInterests((await ri.json()).interests || []);
      setPlan((await rp.json()).items || []);
    } catch (e: any) {
      setError(
        e?.message === "auth"
          ? "Tu sesión expiró. Salí y volvé a ingresar como administrador."
          : "No se pudieron cargar los interesados."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Agrupar interesados abiertos por producto
  const groups = useMemo(() => {
    const map = new Map<string, InterestGroup>();
    for (const i of interests) {
      if (i.status === "closed") continue;
      const g = map.get(i.productSku) || {
        sku: i.productSku,
        title: productBySku.get(i.productSku)?.title || i.productTitle,
        product: productBySku.get(i.productSku),
        units: 0,
        people: 0,
        lastDate: i.createdAt,
        status: "pending" as const,
        entries: [],
      };
      g.units += i.quantity;
      g.people += 1;
      if (i.createdAt > g.lastDate) g.lastDate = i.createdAt;
      if (i.status === "ordered") g.status = "ordered";
      g.entries.push(i);
      map.set(i.productSku, g);
    }
    return [...map.values()].sort((a, b) => b.units - a.units || (b.lastDate > a.lastDate ? 1 : -1));
  }, [interests, productBySku]);

  const closedInterests = useMemo(() => interests.filter((i) => i.status === "closed"), [interests]);
  const pendingCount = groups.filter((g) => g.status === "pending").length;

  useEffect(() => {
    onPendingCountChange?.(pendingCount);
  }, [pendingCount, onPendingCountChange]);

  // Guardado del pedido (con pequeña espera para agrupar cambios de cantidades/precios)
  const savePlan = useCallback(async (items: PurchasePlanItem[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pedido-proveedor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status === 401 ? "Tu sesión expiró. Volvé a ingresar como administrador." : data?.error || "No se pudo guardar el pedido.");
        return;
      }
      setError("");
      // Refrescar estados de interesados (pendiente <-> en pedido)
      const ri = await fetch("/api/admin/interesados", { cache: "no-store" });
      if (ri.ok) setInterests((await ri.json()).interests || []);
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePlan = (next: PurchasePlanItem[], immediate = false) => {
    setPlan(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePlan(next), immediate ? 0 : 700);
  };

  const planItemFromProduct = (p: Product | undefined, sku: string, title: string, qty: number, fromInterest: boolean): PurchasePlanItem => ({
    productSku: sku,
    productTitle: p?.title || title,
    tipo: p?.tipo || p?.category || "",
    quantity: Math.max(1, qty),
    costoSinIva: p?.costoSinIva || (p?.costPrice ? Math.round(p.costPrice / 1.21) : 0),
    image: p?.image && !p.image.startsWith("data:") ? p.image : "",
    fromInterest,
  });

  const addGroupToPlan = (g: InterestGroup) => {
    const existing = plan.find((i) => i.productSku === g.sku);
    if (existing) {
      updatePlan(
        plan.map((i) => (i.productSku === g.sku ? { ...i, fromInterest: true, quantity: Math.max(i.quantity, g.units) } : i)),
        true
      );
    } else {
      updatePlan([...plan, planItemFromProduct(g.product, g.sku, g.title, g.units, true)], true);
    }
  };

  const closeGroup = async (g: InterestGroup) => {
    if (!window.confirm(`¿Marcar como resueltos los ${g.people} interesados en "${g.title}"?\nDejan de aparecer en esta lista (quedan en el historial).`)) return;
    const res = await fetch("/api/admin/interesados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus: [g.sku], status: "closed" }),
    });
    if (res.ok) load();
  };

  const reopenInterest = async (id: string) => {
    const res = await fetch("/api/admin/interesados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], status: plan.some((p) => p.productSku === interests.find((i) => i.id === id)?.productSku) ? "ordered" : "pending" }),
    });
    if (res.ok) load();
  };

  const addCatalogProduct = (p: Product) => {
    const sku = (p.sku || "").toUpperCase();
    if (!sku) return;
    if (plan.some((i) => i.productSku === sku)) {
      updatePlan(plan.map((i) => (i.productSku === sku ? { ...i, quantity: i.quantity + 1 } : i)), true);
    } else {
      updatePlan([...plan, planItemFromProduct(p, sku, p.title, 1, false)], true);
    }
    setSearch("");
  };

  const addManual = (e: React.FormEvent) => {
    e.preventDefault();
    const sku = manual.sku.trim().toUpperCase();
    if (!SKU_PATTERN.test(sku)) {
      alert("Ingresá un código válido (letras, números, espacio, punto, guion).");
      return;
    }
    if (plan.some((i) => i.productSku === sku)) {
      alert("Ese código ya está en el pedido.");
      return;
    }
    const p = productBySku.get(sku);
    const item = planItemFromProduct(p, sku, manual.title.trim() || `Artículo ${sku}`, manual.quantity, false);
    if (manual.costoSinIva > 0) item.costoSinIva = manual.costoSinIva;
    updatePlan([...plan, item], true);
    setManual({ sku: "", title: "", quantity: 1, costoSinIva: 0 });
  };

  const setItemField = (sku: string, field: "quantity" | "costoSinIva", value: number) => {
    updatePlan(plan.map((i) => (i.productSku === sku ? { ...i, [field]: value } : i)));
  };

  const removeItem = (sku: string) => updatePlan(plan.filter((i) => i.productSku !== sku), true);

  const clearPlan = async () => {
    if (plan.length === 0) return;
    if (!window.confirm("¿Vaciar el pedido a proveedor?")) return;
    const interestSkus = plan.filter((i) => i.fromInterest).map((i) => i.productSku);
    if (
      interestSkus.length > 0 &&
      window.confirm("¿Marcar también como resueltos a los interesados de esos productos?\n(Aceptar = resueltos, Cancelar = vuelven a pendientes)")
    ) {
      await fetch("/api/admin/interesados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus: interestSkus, status: "closed" }),
      });
    }
    updatePlan([], true);
  };

  const exportExcel = () => {
    if (plan.length === 0) return;
    const rows = buildPurchasePlanRows(plan, window.location.origin);
    const ws = XLSX.utils.json_to_sheet(rows, { header: PLAN_EXCEL_HEADERS });
    ws["!cols"] = [{ wch: 40 }, { wch: 9 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 60 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");
    XLSX.writeFile(wb, `Pedido_Proveedor_Pecados_Serranos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter((p) => (p.sku || "").toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products]);

  const totals = plan.reduce(
    (acc, i) => {
      acc.units += i.quantity;
      acc.sinIva += i.costoSinIva * i.quantity;
      acc.conIva += i.costoSinIva * 1.21 * i.quantity;
      return acc;
    },
    { units: 0, sinIva: 0, conIva: 0 }
  );

  const inputCls =
    "px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500";

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <HandHeart className="w-6 h-6 text-red-500" /> Interesados y Pedido a Proveedor
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Clientes que pidieron productos <strong>sin stock</strong>. Marcá lo que vas a comprar, completá el pedido y exportalo en el mismo formato Excel que importás en Compras.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200">{error}</div>
      )}

      {/* ====================== INTERESADOS ====================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Productos con interés
            <span className="text-xs font-semibold text-zinc-400">({groups.length})</span>
          </h3>
          {closedInterests.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
            >
              {showClosed ? "Ocultar" : "Ver"} resueltos ({closedInterests.length})
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 flex justify-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
            Todavía no hay interesados. Cuando un cliente toque <strong>&quot;Me interesa&quot;</strong> en un producto sin stock, va a aparecer acá.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-center">Stock</th>
                  <th className="p-2 text-center">Unidades</th>
                  <th className="p-2 text-center">Personas</th>
                  <th className="p-2 text-left whitespace-nowrap">Último</th>
                  <th className="p-2 text-center">Estado</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {groups.map((g) => {
                  const inPlan = plan.some((i) => i.productSku === g.sku);
                  return (
                    <React.Fragment key={g.sku}>
                      <tr className="bg-zinc-950/40 hover:bg-zinc-900/60">
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === g.sku ? null : g.sku)}
                            className="flex items-center gap-2 text-left cursor-pointer"
                          >
                            <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${expanded === g.sku ? "rotate-90" : ""}`} />
                            <span className="font-mono text-[10px] text-red-400 bg-red-950/60 px-1 rounded shrink-0">#{g.sku}</span>
                            <span className="text-white font-semibold line-clamp-1">{g.title}</span>
                          </button>
                        </td>
                        <td className="p-2 text-center font-mono">
                          <span className={(g.product?.stock ?? 0) > 0 ? "text-emerald-400" : "text-zinc-500"}>
                            {g.product ? g.product.stock : "—"}
                          </span>
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-white">{g.units}</td>
                        <td className="p-2 text-center font-mono">{g.people}</td>
                        <td className="p-2 text-zinc-400 whitespace-nowrap">{fmtDate(g.lastDate)}</td>
                        <td className="p-2 text-center">
                          {g.status === "ordered" || inPlan ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold whitespace-nowrap">
                              En pedido
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1.5">
                            {!inPlan && (
                              <button
                                type="button"
                                onClick={() => addGroupToPlan(g)}
                                className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                title="Agregar al pedido a proveedor con las unidades pedidas"
                              >
                                <ClipboardList className="w-3 h-3" /> Voy a comprar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => closeGroup(g)}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 border border-zinc-700 whitespace-nowrap cursor-pointer"
                              title="Marcar como resuelto (ya se avisó al cliente o se descartó)"
                            >
                              <CheckCheck className="w-3 h-3" /> Resuelto
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === g.sku && (
                        <tr className="bg-zinc-950">
                          <td colSpan={7} className="px-8 py-2">
                            <ul className="space-y-1">
                              {g.entries.map((e) => (
                                <li key={e.id} className="flex flex-wrap gap-x-3 text-[11px] text-zinc-300">
                                  <span className="text-zinc-500 font-mono">{fmtDate(e.createdAt)}</span>
                                  <span className="font-semibold text-white">{e.buyerName}</span>
                                  <span>{e.quantity} u.</span>
                                  {e.notes && <span className="text-zinc-400">{e.notes}</span>}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showClosed && closedInterests.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-1 max-h-64 overflow-y-auto">
            {closedInterests.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 text-[11px] text-zinc-400">
                <span className="font-mono">{fmtDate(e.createdAt)}</span>
                <span className="font-mono text-red-400">#{e.productSku}</span>
                <span className="text-zinc-300">{e.productTitle}</span>
                <span>{e.buyerName}</span>
                <span>{e.quantity} u.</span>
                <button type="button" onClick={() => reopenInterest(e.id)} className="underline hover:text-white cursor-pointer">
                  reabrir
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ====================== PEDIDO A PROVEEDOR ====================== */}
      <section className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-red-500" /> Pedido a proveedor
            <span className="text-xs font-semibold text-zinc-400">
              ({plan.length} artículos · {totals.units} u.)
            </span>
            {saving && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportExcel}
              disabled={plan.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </button>
            <button
              type="button"
              onClick={onOpenImport}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
              title="Cuando llegue la mercadería, importá la compra para sumar el stock"
            >
              <FileUp className="w-4 h-4" /> Importar compra recibida
            </button>
            <button
              type="button"
              onClick={clearPlan}
              disabled={plan.length === 0}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-xs font-bold flex items-center gap-1.5 border border-zinc-800 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Vaciar pedido
            </button>
          </div>
        </div>

        {/* Agregar productos sin interés */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="relative p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Agregar del catálogo
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código o nombre…"
                className={`${inputCls} w-full pl-8`}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <ul className="absolute z-20 left-3 right-3 mt-1 rounded-xl bg-zinc-950 border border-zinc-700 shadow-2xl max-h-72 overflow-y-auto">
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addCatalogProduct(p)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="font-mono text-[10px] text-red-400">#{p.sku}</span>
                      <span className="flex-1 text-white line-clamp-1">{p.title}</span>
                      <span className={`font-mono text-[10px] ${p.stock > 0 ? "text-emerald-400" : "text-zinc-500"}`}>{p.stock} u.</span>
                      <Plus className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={addManual} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Agregar por código (artículo nuevo)
            </label>
            <div className="flex flex-wrap gap-1.5">
              <input
                type="text"
                value={manual.sku}
                onChange={(e) => setManual({ ...manual, sku: e.target.value })}
                placeholder="Código"
                className={`${inputCls} w-24 font-mono uppercase`}
              />
              <input
                type="text"
                value={manual.title}
                onChange={(e) => setManual({ ...manual, title: e.target.value })}
                placeholder="Descripción"
                className={`${inputCls} flex-1 min-w-[120px]`}
              />
              <input
                type="number"
                min={1}
                value={manual.quantity}
                onChange={(e) => setManual({ ...manual, quantity: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                title="Cantidad"
                className={`${inputCls} w-16 font-mono`}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={manual.costoSinIva || ""}
                onChange={(e) => setManual({ ...manual, costoSinIva: parseFloat(e.target.value || "0") })}
                placeholder="P.U. s/IVA"
                className={`${inputCls} w-24 font-mono`}
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
          </form>
        </div>

        {plan.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
            El pedido está vacío. Usá <strong>&quot;Voy a comprar&quot;</strong> en los productos con interés o agregá artículos del catálogo.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-2 text-left">Cod.</th>
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-center">Origen</th>
                  <th className="p-2 text-center">#Pedida</th>
                  <th className="p-2 text-right whitespace-nowrap">P.U. s/IVA</th>
                  <th className="p-2 text-right whitespace-nowrap">Total c/IVA</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {plan.map((i) => (
                  <tr key={i.productSku} className="bg-zinc-950/40">
                    <td className="p-2 font-mono text-red-400 whitespace-nowrap">{i.productSku}</td>
                    <td className="p-2 text-white">
                      <span className="line-clamp-1">{i.productTitle}</span>
                    </td>
                    <td className="p-2 text-center">
                      {i.fromInterest ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">Interés</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold">Manual</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={i.quantity}
                        onChange={(e) => setItemField(i.productSku, "quantity", Math.max(1, parseInt(e.target.value || "1", 10)))}
                        className={`${inputCls} w-16 text-center font-mono`}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={i.costoSinIva}
                        onChange={(e) => setItemField(i.productSku, "costoSinIva", Math.max(0, parseFloat(e.target.value || "0")))}
                        className={`${inputCls} w-24 text-right font-mono`}
                      />
                    </td>
                    <td className="p-2 text-right font-mono text-white whitespace-nowrap">{money(i.costoSinIva * 1.21 * i.quantity)}</td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(i.productSku)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                        title="Quitar del pedido"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-900 text-xs">
                <tr>
                  <td colSpan={3} className="p-2 font-bold text-zinc-300">Total</td>
                  <td className="p-2 text-center font-mono font-bold text-white">{totals.units}</td>
                  <td className="p-2 text-right font-mono text-zinc-400 whitespace-nowrap">{money(totals.sinIva)} s/IVA</td>
                  <td className="p-2 text-right font-mono font-black text-white whitespace-nowrap">{money(totals.conIva)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-[11px] text-zinc-500">
          El Excel exportado usa las columnas <span className="font-mono">Imagen · #Pedida · Cod. · P.U. · Imp. · Total · Descripción</span>, igual que la planilla de compra: cuando llegue la mercadería podés importar ese mismo archivo (ajustando cantidades si hace falta).
        </p>
      </section>
    </div>
  );
}
