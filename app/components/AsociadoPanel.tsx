"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Ban, Edit3, Loader2, LogOut, Package, Plus, Receipt, Trash2, UserCheck, X } from "lucide-react";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS, commissionStatus, isCashPriceMethod, owedToStore, type PaymentMethod, type Sale } from "@/app/products";
import { formatMoney } from "@/lib/pricing";
import { commissionTotals } from "@/app/components/ResellerSections";

interface AsociadoProduct {
  id: string;
  title: string;
  stock: number;
  precioFT: number;
  precioTC: number;
}
interface AsociadoConsignment {
  id: string;
  date: string;
  productId: string;
  productTitle: string;
  image: string;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  pending: number;
  unitAgreedPrice: number;
  commissionPerUnit: number | null;
  status: string;
  notes: string;
}
interface AsociadoSale {
  id: string;
  date: string;
  buyerName: string;
  buyerPhone?: string;
  channel: string;
  totalAmount: number;
  paymentMethod: string;
  resellerCode?: string | null;
  notes?: string;
  commissionTotal?: number;
  commissionPending?: boolean;
  settledAt?: string | null; // rendida (pagada) a la tienda
  orderCode?: string | null; // código de pedido
  commissionPaidAt?: string | null; // comisión que le pagó la tienda (ventas que cobró la tienda)
  editable?: boolean; // la cargó ella y no está rendida: puede editarla o anularla
  items: { key: string; productTitle: string; quantity: number; unitPrice: number; subtotal: number; commission?: number }[];
}

// Período de las ventas que se muestran (y sobre el que se calcula el pago a la tienda)
type Period = "sin_rendir" | "semana" | "semana_pasada" | "mes" | "mes_pasado" | "todas";
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "sin_rendir", label: "Sin rendir" },
  { value: "semana", label: "Esta semana" },
  { value: "semana_pasada", label: "Semana pasada" },
  { value: "mes", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "todas", label: "Todas" },
];

// Rango [desde, hasta) del período; la semana empieza el lunes
function periodRange(period: Period): [Date, Date] | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "semana" || period === "semana_pasada") {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    if (period === "semana_pasada") monday.setDate(monday.getDate() - 7);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 7);
    return [monday, end];
  }
  if (period === "mes") return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  if (period === "mes_pasado") return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  return null;
}

// Notas que agrega el sistema a la venta (no se muestran al editar)
const AUTO_NOTES = [
  "Vendido de su mercadería en consignación",
  "Descuento por pago en efectivo (Precio Público FT)",
  "Registrada por la asociada",
];
const userNotes = (notes?: string) =>
  (notes || "")
    .split(" | ")
    .filter((n) => n && !AUTO_NOTES.includes(n))
    .join(" | ");
interface AsociadoData {
  reseller: { id: string; name: string; zone: string; code: string | null };
  sales: AsociadoSale[];
  products: AsociadoProduct[];
  consignments: AsociadoConsignment[];
}

// Cada ítem de la venta sale de su mercadería ("c:<consignación>") o del depósito ("p:<producto>")
interface SaleOption {
  key: string;
  label: string;
  available: number;
  unit: (m: PaymentMethod) => number;
  list: number;
  commission: number | null; // comisión por unidad (null = sin definir)
}

interface Props {
  onLogout: () => void;
}

const fmtDate = (iso: string, withTime = true) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

// Perfil "Asociado" (revendedor): sólo sus ventas, su mercadería y el registro de nuevas ventas
export default function AsociadoPanel({ onLogout }: Props) {
  const [data, setData] = useState<AsociadoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ventas" | "mercaderia">("ventas");
  const [showModal, setShowModal] = useState(false);
  const [period, setPeriod] = useState<Period>("sin_rendir");
  // Venta que se está editando (null = venta nueva)
  const [editingSale, setEditingSale] = useState<AsociadoSale | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{
    buyerName: string;
    buyerPhone: string;
    paymentMethod: PaymentMethod;
    notes: string;
    items: { key: string; quantity: number }[];
  }>({ buyerName: "", buyerPhone: "", paymentMethod: "efectivo", notes: "", items: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/asociado", { cache: "no-store" });
      const d = await res.json();
      if (!d?.reseller) {
        onLogout();
        return;
      }
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  // Al editar, las unidades de la venta original se devuelven antes de volver a descontar
  const editQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of editingSale?.items || []) if (i.key) m.set(i.key, (m.get(i.key) || 0) + i.quantity);
    return m;
  }, [editingSale]);

  // Opciones para vender: primero su mercadería en mano, después el depósito de la tienda
  const consignmentOptions = useMemo<SaleOption[]>(
    () =>
      (data?.consignments || [])
        .map((c) => ({ c, available: c.pending + (editQty.get(`c:${c.id}`) || 0) }))
        .filter(({ available }) => available > 0)
        .map(({ c, available }) => ({
          key: `c:${c.id}`,
          label: `${c.productTitle} — ${available} en mano`,
          available,
          unit: () => c.unitAgreedPrice,
          list: c.unitAgreedPrice,
          commission: c.commissionPerUnit,
        })),
    [data, editQty]
  );
  const productOptions = useMemo<SaleOption[]>(
    () =>
      (data?.products || []).map((p) => {
        const available = p.stock + (editQty.get(`p:${p.id}`) || 0);
        return {
        key: `p:${p.id}`,
        label: `${p.title}${available <= 0 ? " (sin stock)" : ""}`,
        available,
        unit: (m: PaymentMethod) => (isCashPriceMethod(m) ? p.precioFT : p.precioTC),
        list: p.precioTC,
        // Del depósito: la comisión asignada para ese artículo en su último lote
        commission:
          (data?.consignments || []).find((c) => c.productId === p.id && c.commissionPerUnit !== null)?.commissionPerUnit ?? null,
        };
      }),
    [data, editQty]
  );
  const optionByKey = useMemo(
    () => new Map([...consignmentOptions, ...productOptions].map((o) => [o.key, o])),
    [consignmentOptions, productOptions]
  );

  const firstFreeOption = (items: { key: string }[]) =>
    [...consignmentOptions, ...productOptions].find((o) => o.available > 0 && !items.some((i) => i.key === o.key)) ||
    [...consignmentOptions, ...productOptions].find((o) => o.available > 0);

  const openModal = (presetKey?: string) => {
    const first = presetKey ? optionByKey.get(presetKey) : firstFreeOption([]);
    setEditingSale(null);
    setForm({ buyerName: "", buyerPhone: "", paymentMethod: "efectivo", notes: "", items: first ? [{ key: first.key, quantity: 1 }] : [] });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSale(null);
  };

  const openEdit = (sale: AsociadoSale) => {
    setEditingSale(sale);
    setForm({
      buyerName: sale.buyerName === "Cliente" ? "" : sale.buyerName,
      buyerPhone: sale.buyerPhone || "",
      paymentMethod: (PAYMENT_METHOD_OPTIONS.some((o) => o.value === sale.paymentMethod) ? sale.paymentMethod : "efectivo") as PaymentMethod,
      notes: userNotes(sale.notes),
      items: sale.items.filter((i) => i.key).map((i) => ({ key: i.key, quantity: i.quantity })),
    });
    setError("");
    setShowModal(true);
  };

  const cancelSale = async (sale: AsociadoSale) => {
    if (!window.confirm(`¿Anular la venta a ${sale.buyerName || "Cliente"} por ${formatMoney(sale.totalAmount)}? Los productos vuelven a tu mercadería o al depósito.`)) return;
    const res = await fetch("/api/asociado/ventas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sale.id }),
    }).catch(() => null);
    if (res?.status === 401) {
      onLogout();
      return;
    }
    if (!res?.ok) {
      const out = await res?.json().catch(() => null);
      alert(out?.error || "No se pudo anular la venta.");
    }
    await load();
  };

  const listTotal = form.items.reduce((t, i) => t + (optionByKey.get(i.key)?.list || 0) * i.quantity, 0);
  const total = form.items.reduce((t, i) => t + (optionByKey.get(i.key)?.unit(form.paymentMethod) || 0) * i.quantity, 0);
  const myCommission = form.items.reduce((t, i) => t + (optionByKey.get(i.key)?.commission || 0) * i.quantity, 0);
  const commissionUndefined = form.items.some((i) => optionByKey.get(i.key)?.commission === null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.items.length === 0) {
      setError("Agregá al menos un producto.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/asociado/ventas", {
        method: editingSale ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingSale ? { id: editingSale.id } : {}),
          buyerName: form.buyerName,
          buyerPhone: form.buyerPhone,
          paymentMethod: form.paymentMethod,
          notes: form.notes,
          items: form.items.map((i) =>
            i.key.startsWith("c:")
              ? { consignmentId: i.key.slice(2), quantity: i.quantity }
              : { productId: i.key.slice(2), quantity: i.quantity }
          ),
        }),
      });
      const out = await res.json().catch(() => null);
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) {
        setError(out?.error || (editingSale ? "No se pudo guardar el cambio." : "No se pudo registrar la venta."));
        return;
      }
      setShowModal(false);
      setEditingSale(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const allSales = data?.sales || [];
  const range = periodRange(period);
  const sales = allSales.filter((s) => {
    if (period === "sin_rendir") return !s.settledAt && owedToStore(s) > 0;
    if (!range) return true;
    const d = new Date(s.date);
    return d >= range[0] && d < range[1];
  });
  const consignments = data?.consignments || [];
  const totalVendido = sales.reduce((t, s) => t + s.totalAmount, 0);
  const unidades = sales.reduce((t, s) => t + s.items.reduce((u, i) => u + i.quantity, 0), 0);
  // Pago a la tienda: lo que cobró ella menos su comisión, de las ventas mostradas que todavía no rindió
  const pagoATienda = sales.reduce((t, s) => t + (s.settledAt ? 0 : owedToStore(s)), 0);
  const pagoPendienteComision = sales.some((s) => !s.settledAt && owedToStore(s) > 0 && s.commissionPending);
  const enMano = consignments.reduce((t, c) => t + c.pending, 0);
  const valorEnMano = consignments.reduce((t, c) => t + c.pending * c.unitAgreedPrice, 0);
  const comisionGanada = sales.reduce((t, s) => t + (s.commissionTotal || 0), 0);
  const activas = consignments.filter((c) => c.pending > 0);
  const cerradas = consignments.filter((c) => c.pending <= 0);

  const kpi = (items: [string, string, string][]) => (
    <div
      className={`grid gap-2 sm:gap-4 ${
        items.length === 5 ? "grid-cols-2 sm:grid-cols-5" : items.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
      }`}
    >
      {items.map(([label, value, color], idx) => (
        <div
          key={label}
          className={`p-3 sm:p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 ${
            items.length === 5 && idx === 4 ? "col-span-2 sm:col-span-1 border-sky-900/70 bg-sky-950/30" : ""
          }`}
        >
          <span className="block text-[10px] sm:text-[11px] uppercase font-semibold text-zinc-400 leading-tight">{label}</span>
          <span className={`block mt-1 text-lg sm:text-2xl font-black font-mono break-words ${color}`}>{value}</span>
        </div>
      ))}
    </div>
  );

  const consignmentCard = (c: AsociadoConsignment) => (
    <div key={c.id} className={`p-3 sm:p-4 rounded-2xl border ${c.pending > 0 ? "bg-zinc-900/70 border-zinc-800" : "bg-zinc-950/60 border-zinc-900 opacity-80"}`}>
      <div className="flex gap-3">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white overflow-hidden shrink-0 border border-zinc-800">
          {c.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt={c.productTitle} className="w-full h-full object-contain" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-sm font-bold text-white leading-snug">{c.productTitle}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                c.pending > 0 ? "bg-amber-950 text-amber-300 border-amber-800" : "bg-zinc-900 text-zinc-400 border-zinc-700"
              }`}
            >
              {c.pending > 0 ? `${c.pending} en mano` : "Rendida"}
            </span>
          </div>
          <span className="block text-[11px] text-zinc-400 mt-0.5">Entregada el {fmtDate(c.date, false)}</span>
          <span className="block text-xs text-white mt-1">
            Precio de venta: <strong className="font-mono">{formatMoney(c.unitAgreedPrice)}</strong> c/u
          </span>
          <span className="block text-xs mt-0.5">
            {c.commissionPerUnit === null ? (
              <span className="text-amber-300 font-semibold">Comisión a definir por la tienda</span>
            ) : (
              <span className="text-amber-300">
                Tu comisión: <strong className="font-mono">{formatMoney(c.commissionPerUnit)}</strong> por unidad
              </span>
            )}
          </span>
          {/* Lo que le corresponde a la tienda (proveedora de la mercadería) por cada unidad vendida */}
          <span className="block text-xs mt-0.5">
            {c.commissionPerUnit === null ? (
              <span className="text-zinc-400">A pagar a la tienda: se calcula cuando se defina tu comisión</span>
            ) : (
              <span className="text-sky-300">
                A pagar a la tienda: <strong className="font-mono">{formatMoney(c.unitAgreedPrice - c.commissionPerUnit)}</strong> por unidad
                {c.pending > 0 && (
                  <span className="text-zinc-400">
                    {" "}
                    · por las {c.pending} en mano: <strong className="font-mono text-sky-300">{formatMoney((c.unitAgreedPrice - c.commissionPerUnit) * c.pending)}</strong>
                  </span>
                )}
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        {[
          ["Entregadas", c.quantityGiven, "text-white"],
          ["Vendidas", c.quantitySold, "text-emerald-400"],
          ["Devueltas", c.quantityReturned, "text-zinc-400"],
          ["En mano", c.pending, "text-amber-300"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
            <span className="block text-[9px] uppercase text-zinc-500 font-semibold">{label}</span>
            <span className={`block text-sm font-black font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>
      {c.notes && <p className="mt-2 text-[11px] text-zinc-400">{c.notes}</p>}
      {c.pending > 0 && (
        <button
          type="button"
          onClick={() => openModal(`c:${c.id}`)}
          className="mt-3 w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Registrar venta de este producto
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0506] text-zinc-100">
      {/* Barra del asociado */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-950 via-zinc-950 to-amber-950 border-b border-amber-900/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-sm font-bold text-white truncate">{data?.reseller.name || "Asociado"}</span>
              <span className="block text-[11px] text-amber-300/80 truncate">
                {data?.reseller.zone}
                {data?.reseller.code ? ` · Tu código: ${data.reseller.code}` : ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
        {/* Pestañas */}
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1.5">
          {(
            [
              ["ventas", "Mis ventas", BarChart3, allSales.length],
              ["mercaderia", "Mi mercadería", Package, enMano],
            ] as const
          ).map(([key, label, Icon, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === key ? "bg-red-600 text-white" : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              {tab === "ventas" ? (
                <>
                  <BarChart3 className="w-6 h-6 text-amber-400" /> Mis ventas
                </>
              ) : (
                <>
                  <Package className="w-6 h-6 text-amber-400" /> Mi mercadería
                </>
              )}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {tab === "ventas"
                ? "Ventas registradas a tu nombre y compras hechas con tu código."
                : "Productos que te entregó la tienda para vender, con su precio y lo que te queda en mano."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            disabled={loading || !data}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Registrar venta
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : tab === "ventas" ? (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período de las ventas">
              {PERIOD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPeriod(o.value)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer ${
                    period === o.value
                      ? "bg-sky-600 border-sky-500 text-white"
                      : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {kpi([
              ["Ventas", String(sales.length), "text-white"],
              ["Unidades", String(unidades), "text-amber-300"],
              ["Total vendido", formatMoney(totalVendido), "text-emerald-400"],
              ["Mi comisión", formatMoney(comisionGanada), "text-amber-300"],
              ["Pago a tienda", formatMoney(pagoATienda), "text-sky-300"],
            ])}
            {pagoPendienteComision && (
              <p className="-mt-3 text-[11px] text-amber-300">
                Hay ventas con comisión a definir: el pago a la tienda va a bajar cuando la tienda la cargue.
              </p>
            )}
            {(() => {
              const t = commissionTotals(allSales.map((x) => ({ ...x, resellerId: data?.reseller.id }) as unknown as Sale));
              if (t.total <= 0 && t.undefinedCount === 0) return null;
              const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-AR");
              return (
                <div className="p-3 sm:p-4 rounded-2xl bg-amber-950/20 border border-amber-900/50 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-200">Mis comisiones</span>
                    {t.owed > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-200 font-bold">
                        La tienda te debe {formatMoney(t.owed)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                        ✓ No se te adeudan comisiones
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                      <span className="block text-[10px] uppercase text-zinc-500 font-semibold">A cobrar de la tienda</span>
                      <span className="block text-sm font-black font-mono text-rose-300">{formatMoney(t.owed)}</span>
                      <span className="text-[10px] text-zinc-500">Compras online con tu código</span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                      <span className="block text-[10px] uppercase text-zinc-500 font-semibold">Ya cobradas</span>
                      <span className="block text-sm font-black font-mono text-emerald-300">{formatMoney(t.paid)}</span>
                      <span className="text-[10px] text-zinc-500">{t.lastPaidAt ? `Último pago: ${fmtDay(t.lastPaidAt)}` : "Sin pagos todavía"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                      <span className="block text-[10px] uppercase text-zinc-500 font-semibold">Las descontás al rendir</span>
                      <span className="block text-sm font-black font-mono text-sky-300">{formatMoney(t.retained + t.retainedSettled)}</span>
                      <span className="text-[10px] text-zinc-500">Ventas que cobraste vos{t.retained > 0 ? ` · ${formatMoney(t.retained)} sin rendir` : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {sales.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
                {allSales.length === 0 ? (
                  <>
                    Todavía no tenés ventas registradas. Tocá <strong>Registrar venta</strong> para cargar la primera.
                  </>
                ) : period === "sin_rendir" ? (
                  "No tenés ventas sin rendir: estás al día con la tienda."
                ) : (
                  "No hay ventas en este período."
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sales.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="block text-sm font-bold text-white">
                          {s.buyerName || "Cliente"}
                          {s.orderCode && (
                            <span className="ml-2 align-middle px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[10px] font-mono font-bold text-amber-300 tracking-wider">
                              Pedido {s.orderCode}
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-zinc-400">
                          {fmtDate(s.date)}
                          {" · "}
                          {s.channel === "web_whatsapp" ? `Tienda online (código ${s.resellerCode || ""})` : "Venta registrada"}
                          {" · "}
                          {PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod}
                        </span>
                        {s.notes?.includes("mercadería en consignación") && (
                          <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                            De tu mercadería
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="block text-lg font-black font-mono text-emerald-400">{formatMoney(s.totalAmount)}</span>
                        <span className={`block text-[11px] font-semibold ${s.commissionPending ? "text-amber-300" : "text-amber-200/80"}`}>
                          Tu comisión: {formatMoney(s.commissionTotal || 0)}
                          {s.commissionPending ? " (parte a definir)" : ""}
                        </span>
                        {s.channel === "web_whatsapp" ? (
                          s.commissionPaidAt ? (
                            <span className="block text-[11px] font-semibold text-emerald-400">
                              ✓ Comisión cobrada el {new Date(s.commissionPaidAt).toLocaleDateString("es-AR")}
                            </span>
                          ) : commissionStatus({ ...s, resellerId: data?.reseller.id }) === "owed" ? (
                            <span className="block text-[11px] font-semibold text-rose-300">Cobró la tienda: te adeuda la comisión</span>
                          ) : (
                            <span className="block text-[11px] text-zinc-400">Cobró la tienda</span>
                          )
                        ) : s.settledAt ? (
                          <span className="block text-[11px] font-semibold text-emerald-400">
                            ✓ Rendida a la tienda ({formatMoney(owedToStore(s))})
                          </span>
                        ) : (
                          <span className="block text-[11px] font-semibold text-sky-300">
                            A pagar a la tienda: {formatMoney(owedToStore(s))}
                            {s.commissionPending ? " (menos la comisión a definir)" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {s.items.map((i, idx) => (
                        <li key={idx} className="text-xs text-zinc-300">
                          <strong className="text-white">{i.quantity}x</strong> {i.productTitle}{" "}
                          <span className="text-zinc-500">— {formatMoney(i.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                    {s.editable && (
                      <div className="mt-3 pt-2.5 border-t border-zinc-800 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelSale(s)}
                          className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-900 text-red-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" /> Anular venta
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {kpi([
              ["En mano", `${enMano} u.`, "text-amber-300"],
              ["Valor en mano", formatMoney(valorEnMano), "text-emerald-400"],
              ["Vendidas", `${consignments.reduce((t, c) => t + c.quantitySold, 0)} u.`, "text-white"],
            ])}
            {consignments.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
                La tienda todavía no te entregó mercadería para vender.
              </div>
            ) : (
              <div className="space-y-6">
                {activas.length > 0 && <div className="grid sm:grid-cols-2 gap-3">{activas.map(consignmentCard)}</div>}
                {cerradas.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Rendidas / sin unidades en mano</h2>
                    <div className="grid sm:grid-cols-2 gap-3">{cerradas.map(consignmentCard)}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Registrar venta (el revendedor es siempre el usuario actual) */}
      <AnimatePresence>
        {showModal && data && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-black/85 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-red-400" /> {editingSale ? "Editar venta" : "Registrar venta"}
                </h3>
                <button type="button" onClick={closeModal} className="p-1 rounded-lg text-zinc-400 hover:text-white" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submit} className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-900/60 text-amber-200">
                  Revendedor: <strong>{data.reseller.name}</strong>
                  {data.reseller.zone ? ` — ${data.reseller.zone}` : ""}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Nombre del cliente</label>
                    <input
                      type="text"
                      value={form.buyerName}
                      onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                      placeholder="Cliente"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-medium block mb-1">Teléfono (opcional)</label>
                    <input
                      type="text"
                      value={form.buyerPhone}
                      onChange={(e) => setForm({ ...form, buyerPhone: e.target.value })}
                      placeholder="Ej: 3548..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Medio de pago</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-zinc-500">
                    Tu mercadería se vende al precio acordado. Del depósito: efectivo/transferencia/Mercado Pago a precio en efectivo, tarjeta a precio de la tienda.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium">Productos a vender</label>
                    <button
                      type="button"
                      onClick={() => {
                        const o = firstFreeOption(form.items);
                        if (o) setForm({ ...form, items: [...form.items, { key: o.key, quantity: 1 }] });
                      }}
                      className="text-red-400 hover:text-red-300 text-[11px] font-bold"
                    >
                      + Agregar ítem
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.items.map((item, idx) => {
                      const o = optionByKey.get(item.key);
                      const unit = o ? o.unit(form.paymentMethod) : 0;
                      const max = Math.max(1, o?.available || 1);
                      const update = (patch: Partial<{ key: string; quantity: number }>) =>
                        setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[minmax(0,1fr)_76px_auto] sm:grid-cols-[minmax(0,1fr)_110px_76px_auto] gap-2 items-end bg-zinc-950 p-2.5 rounded-xl border border-zinc-800"
                        >
                          <div className="col-span-3 sm:col-span-1 min-w-0">
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Producto</label>
                            <select
                              value={item.key}
                              onChange={(e) => update({ key: e.target.value, quantity: 1 })}
                              className="w-full min-w-0 bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-lg text-white text-xs"
                            >
                              {consignmentOptions.length > 0 && (
                                <optgroup label="Mi mercadería (en mano)">
                                  {consignmentOptions.map((op) => (
                                    <option key={op.key} value={op.key}>
                                      {op.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Depósito de la tienda">
                                {productOptions.map((op) => (
                                  <option key={op.key} value={op.key} disabled={op.available <= 0}>
                                    {op.label}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                          <div className="min-w-0">
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Monto c/u</label>
                            <div className="px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-white font-mono truncate">{formatMoney(unit)}</div>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Cantidad</label>
                            <input
                              type="number"
                              min={1}
                              max={max}
                              value={item.quantity}
                              onChange={(e) => update({ quantity: Math.min(Math.max(1, Number(e.target.value) || 1), max) })}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-center"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                            className="p-2 mb-0.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
                            aria-label="Quitar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {o && (
                            <p className="col-span-3 sm:col-span-4 text-[10px] text-zinc-500">
                              {item.key.startsWith("c:") ? "De tu mercadería · en mano" : "Del depósito · stock disponible"}: {o.available} · Subtotal:{" "}
                              <span className="text-zinc-300 font-mono">{formatMoney(unit * item.quantity)}</span>
                              {" · "}
                              {o.commission === null ? (
                                <span className="text-amber-300">comisión a definir</span>
                              ) : (
                                <span className="text-amber-300">tu comisión {formatMoney(o.commission)} c/u</span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-medium block mb-1">Notas (opcional)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ej: entrega el sábado"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                  />
                </div>

                {form.items.length > 0 && (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-zinc-400">
                      <span>Precio de lista</span>
                      <span className="font-mono">{formatMoney(listTotal)}</span>
                    </div>
                    {listTotal - total > 0.005 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Descuento por pago en efectivo</span>
                        <span className="font-mono">−{formatMoney(listTotal - total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-zinc-800">
                      <span>Total</span>
                      <span className="font-mono">{formatMoney(total)}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 font-semibold">
                      <span>Tu comisión{commissionUndefined ? " (parte a definir)" : ""}</span>
                      <span className="font-mono">{formatMoney(myCommission)}</span>
                    </div>
                  </div>
                )}

                {error && <p className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200">{error}</p>}

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {editingSale ? "Guardar cambios" : "Confirmar venta"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
