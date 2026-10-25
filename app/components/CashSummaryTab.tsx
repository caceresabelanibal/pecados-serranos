"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { DollarSign, FileSpreadsheet, Loader2, PiggyBank, Plus, Printer, Receipt, Search, Trash2, TrendingUp, X } from "lucide-react";
import { PAYMENT_METHOD_LABELS, type PurchaseRecord, type Reseller, type Sale } from "@/app/products";
import { formatMoney } from "@/lib/pricing";
import { buildSearchText, matchesSearch } from "@/lib/search";

interface Props {
  purchases: PurchaseRecord[];
  sales: Sale[]; // ventas concretadas (sin anuladas ni compras pendientes de cobro)
  resellers: Reseller[];
}

// Fecha local en formato del <input type="date"> (AAAA-MM-DD)
const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const round2 = (n: number) => Math.round(n * 100) / 100;
// Montos de la planilla: siempre con 2 decimales (como una planilla contable)
const money = (n: number) => `$${(Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Preset = "30d" | "mes" | "mes_pasado" | "todo" | "custom";

// Cuentas del balance (caja: el Debe es lo que entra, el Haber lo que sale)
// Cuentas fijas (salen de ventas, compras y comisiones); los registros manuales suman una cuenta por categoría
type Cuenta = string;
const CUENTAS: Cuenta[] = ["Ventas", "Compras a proveedores", "Comisiones de revendedoras"];

// Categorías sugeridas para los registros manuales (también se puede escribir otra)
const CATEGORIAS_HABER = [
  "Equipamiento y mobiliario",
  "Insumos y packaging",
  "Servicios",
  "Alquiler",
  "Publicidad",
  "Impuestos y gastos bancarios",
  "Envíos",
  "Retiro del dueño",
  "Otros egresos",
];
const CATEGORIAS_DEBE = ["Aporte de capital", "Préstamo recibido", "Otros ingresos"];

interface CashEntry {
  id: string;
  date: string;
  side: "debe" | "haber";
  category: string;
  description: string;
  amount: number;
}

interface Movimiento {
  key: string;
  date: string;
  cuenta: Cuenta;
  comprobante: string;
  detalle: string;
  medio: string;
  debe: number;
  haber: number;
  notas?: string;
  manualId?: string; // registro manual (se puede borrar)
}

// Pestaña "Flujo de caja": inversión, venta proyectada, facturación y balance de sumas y saldos
export default function CashSummaryTab({ purchases, sales, resellers }: Props) {
  // Período: por defecto los últimos 30 días
  const [from, setFrom] = useState(() => toInputDate(daysAgo(30)));
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [preset, setPreset] = useState<Preset>("30d");
  const [query, setQuery] = useState("");

  // Registros manuales de caja (ej: perchas, posnet, aporte de capital)
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/caja", { cache: "no-store" });
      if (res.ok) setEntries((await res.json()).entries || []);
    } catch {}
  }, []);
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const emptyForm = () => ({ date: toInputDate(new Date()), side: "haber" as "debe" | "haber", category: "", customCategory: "", description: "", amount: "" });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  // Categorías ya usadas (para elegirlas de nuevo) + las sugeridas del lado elegido
  const categoryOptions = useMemo(() => {
    const used = entries.filter((e) => e.side === form.side).map((e) => e.category);
    return [...new Set([...(form.side === "haber" ? CATEGORIAS_HABER : CATEGORIAS_DEBE), ...used])];
  }, [entries, form.side]);

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingEntry) return;
    const category = form.category === "__otra" ? form.customCategory.trim() : form.category;
    setSavingEntry(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: form.date, side: form.side, category, description: form.description, amount: Number(String(form.amount).replace(",", ".")) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(out.error || "No se pudo guardar el registro.");
        return;
      }
      setShowForm(false);
      setForm(emptyForm());
      await loadEntries();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setSavingEntry(false);
    }
  };

  const deleteEntry = async (id: string, label: string) => {
    if (!window.confirm(`¿Borrar el registro "${label}"?`)) return;
    const res = await fetch("/api/admin/caja", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (!res?.ok) alert("No se pudo borrar el registro.");
    loadEntries();
  };

  const applyPreset = (p: Preset) => {
    const now = new Date();
    setPreset(p);
    if (p === "30d") {
      setFrom(toInputDate(daysAgo(30)));
      setTo(toInputDate(now));
    } else if (p === "mes") {
      setFrom(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(toInputDate(now));
    } else if (p === "mes_pasado") {
      setFrom(toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setTo(toInputDate(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (p === "todo") {
      setFrom("");
      setTo("");
    }
  };

  const periodLabel = from || to ? `${from ? fmtDate(`${from}T00:00:00`) : "inicio"} al ${to ? fmtDate(`${to}T00:00:00`) : "hoy"}` : "Todo el historial";

  // Mismos cálculos que "Compras y proveedores" y "Ventas" (totales históricos)
  const inversionConIva = purchases.reduce((acc, p) => acc + (p.totalCostConIva || 0), 0);
  const ventaProyectada = purchases.reduce((acc, p) => acc + (p.totalSaleEstimated || 0), 0);
  const facturacionTotal = sales.reduce((acc, s) => acc + s.totalAmount, 0);

  const resellerName = (s: Sale) => resellers.find((r) => r.id === s.resellerId)?.name || s.resellerName || "Revendedora";

  // Todos los movimientos de caja, en orden cronológico
  const movimientos = useMemo<Movimiento[]>(() => {
    const list: Movimiento[] = [];
    for (const s of sales) {
      const code = s.orderCode ? `Pedido ${s.orderCode}` : `Venta ${s.id.slice(-6).toUpperCase()}`;
      const items = s.items.map((i) => `${i.quantity}x ${i.productTitle}`).join(", ");
      list.push({
        key: `v-${s.id}`,
        date: s.date,
        cuenta: "Ventas",
        comprobante: code,
        detalle: `${s.buyerName || "Cliente"}${s.resellerId ? ` · ${resellerName(s)}` : ""} — ${items}`,
        medio: PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod || "",
        debe: s.totalAmount,
        haber: 0,
      });
      if (s.resellerId && (s.commissionTotal || 0) > 0) {
        list.push({
          key: `c-${s.id}`,
          date: s.date,
          cuenta: "Comisiones de revendedoras",
          comprobante: code,
          detalle: `Comisión de ${resellerName(s)}`,
          medio: "",
          debe: 0,
          haber: s.commissionTotal || 0,
        });
      }
    }
    for (const p of purchases) {
      list.push({
        key: `p-${p.id}`,
        date: p.date,
        cuenta: "Compras a proveedores",
        comprobante: p.fileName || "Compra",
        detalle: `Compra de mercadería: ${p.totalUnits || 0} u. en ${p.totalItems || 0} artículos`,
        notas: p.notes || "",
        medio: "",
        debe: 0,
        haber: p.totalCostConIva || 0,
      });
    }
    for (const e of entries) {
      list.push({
        key: `m-${e.id}`,
        date: e.date,
        cuenta: e.category,
        comprobante: "Registro manual",
        detalle: e.description,
        medio: "",
        debe: e.side === "debe" ? e.amount : 0,
        haber: e.side === "haber" ? e.amount : 0,
        manualId: e.id,
      });
    }
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, purchases, resellers, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Período: saldo anterior (lo previo al "desde") y movimientos dentro del rango
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  const inRange = (iso: string) => {
    const d = new Date(iso);
    return (!start || d >= start) && (!end || d <= end);
  };
  const saldoAnterior = start
    ? round2(movimientos.filter((m) => new Date(m.date) < start).reduce((t, m) => t + m.debe - m.haber, 0))
    : 0;
  const delPeriodo = movimientos.filter((m) => inRange(m.date));

  // Saldo acumulado (se calcula sobre todo el período; la búsqueda sólo oculta filas)
  let running = saldoAnterior;
  const conSaldo = delPeriodo.map((m) => {
    running = round2(running + m.debe - m.haber);
    return { ...m, saldo: running };
  });
  const visibles = conSaldo.filter((m) =>
    matchesSearch(buildSearchText([m.cuenta, m.comprobante, m.detalle, m.medio, fmtDate(m.date), m.debe || "", m.haber || ""]), query)
  );

  // Balance de sumas y saldos por cuenta (período elegido)
  const cuentasManuales = [...new Set(delPeriodo.filter((m) => m.manualId).map((m) => m.cuenta))].filter((c) => !CUENTAS.includes(c)).sort();
  const balance = [...CUENTAS, ...cuentasManuales].map((cuenta) => {
    const ms = delPeriodo.filter((m) => m.cuenta === cuenta);
    const debe = round2(ms.reduce((t, m) => t + m.debe, 0));
    const haber = round2(ms.reduce((t, m) => t + m.haber, 0));
    return { cuenta, movimientos: ms.length, debe, haber, saldo: round2(debe - haber) };
  });
  const sumaDebe = round2(balance.reduce((t, b) => t + b.debe, 0));
  const sumaHaber = round2(balance.reduce((t, b) => t + b.haber, 0));
  const saldoFinal = round2(saldoAnterior + sumaDebe - sumaHaber);

  const fileStamp = () => toInputDate(new Date());

  // Descarga en Excel: balance y movimientos del período
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const bal = [
      ...balance.map((b) => ({ Cuenta: b.cuenta, Movimientos: b.movimientos, Debe: b.debe, Haber: b.haber, Saldo: b.saldo })),
      { Cuenta: "Sumas", Movimientos: delPeriodo.length, Debe: sumaDebe, Haber: sumaHaber, Saldo: round2(sumaDebe - sumaHaber) },
      { Cuenta: "Saldo anterior", Movimientos: "", Debe: "", Haber: "", Saldo: saldoAnterior },
      { Cuenta: "Saldo final", Movimientos: "", Debe: "", Haber: "", Saldo: saldoFinal },
    ];
    const ws1 = XLSX.utils.json_to_sheet(bal);
    ws1["!cols"] = [{ wch: 30 }, { wch: 13 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Sumas y saldos");

    const mov = [
      ...(start ? [{ Fecha: "", Cuenta: "Saldo anterior", Comprobante: "", Detalle: "", "Medio de pago": "", Debe: "", Haber: "", Saldo: saldoAnterior }] : []),
      ...visibles.map((m) => ({
        Fecha: fmtDate(m.date),
        Cuenta: m.cuenta,
        Comprobante: m.comprobante,
        Detalle: m.detalle,
        "Medio de pago": m.medio,
        Debe: m.debe || "",
        Haber: m.haber || "",
        Saldo: m.saldo,
      })),
    ];
    const ws2 = XLSX.utils.json_to_sheet(mov);
    ws2["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 22 }, { wch: 60 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Movimientos");

    XLSX.writeFile(wb, `Flujo_de_caja_Pecados_Serranos_${fileStamp()}.xlsx`);
  };

  // Impresión (o "Guardar como PDF"): planilla en blanco y negro en una ventana aparte
  const print = () => {
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
    const cell = (n: number) => (n ? esc(money(n)) : "");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Flujo de caja · Pecados Serranos</title>
<style>
  body{font:11px/1.35 Arial,Helvetica,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 2px} h2{font-size:13px;margin:18px 0 6px}
  .muted{color:#555} table{width:100%;border-collapse:collapse;margin-top:4px}
  th,td{border:1px solid #bbb;padding:3px 5px;vertical-align:top} th{background:#eee;text-align:left}
  .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums} tfoot td,.tot td{font-weight:bold;background:#f5f5f5}
  .cards{display:flex;gap:12px} .cards div{border:1px solid #bbb;padding:6px 10px;flex:1} .cards b{display:block;font-size:14px}
  @page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>Flujo de caja — Pecados Serranos</h1>
<div class="muted">Período: ${esc(periodLabel)}${query ? ` · Búsqueda: "${esc(query)}"` : ""} · Emitido el ${esc(new Date().toLocaleString("es-AR"))}</div>
<div class="cards" style="margin-top:10px">
  <div>Inversión total (c/IVA)<b>${esc(money(inversionConIva))}</b></div>
  <div>Venta proyectada<b>${esc(money(ventaProyectada))}</b></div>
  <div>Facturación total (histórica)<b>${esc(money(facturacionTotal))}</b></div>
</div>
<h2>Balance de sumas y saldos</h2>
<table><thead><tr><th>Cuenta</th><th class="n">Mov.</th><th class="n">Debe</th><th class="n">Haber</th><th class="n">Saldo</th></tr></thead><tbody>
${balance.map((b) => `<tr><td>${esc(b.cuenta)}</td><td class="n">${b.movimientos}</td><td class="n">${cell(b.debe)}</td><td class="n">${cell(b.haber)}</td><td class="n">${esc(money(b.saldo))}</td></tr>`).join("")}
</tbody><tfoot>
<tr><td>Sumas</td><td class="n">${delPeriodo.length}</td><td class="n">${esc(money(sumaDebe))}</td><td class="n">${esc(money(sumaHaber))}</td><td class="n">${esc(money(round2(sumaDebe - sumaHaber)))}</td></tr>
${start ? `<tr><td colspan="4">Saldo anterior</td><td class="n">${esc(money(saldoAnterior))}</td></tr>` : ""}
<tr><td colspan="4">Saldo final</td><td class="n">${esc(money(saldoFinal))}</td></tr>
</tfoot></table>
<h2>Movimientos</h2>
<table><thead><tr><th>Fecha</th><th>Cuenta</th><th>Comprobante</th><th>Detalle</th><th>Medio</th><th class="n">Debe</th><th class="n">Haber</th><th class="n">Saldo</th></tr></thead><tbody>
${start ? `<tr class="tot"><td colspan="7">Saldo anterior</td><td class="n">${esc(money(saldoAnterior))}</td></tr>` : ""}
${visibles.map((m) => `<tr><td>${esc(fmtDate(m.date))}</td><td>${esc(m.cuenta)}</td><td>${esc(m.comprobante)}</td><td>${esc(m.detalle)}</td><td>${esc(m.medio)}</td><td class="n">${cell(m.debe)}</td><td class="n">${cell(m.haber)}</td><td class="n">${esc(money(m.saldo))}</td></tr>`).join("") || `<tr><td colspan="8">Sin movimientos en el período.</td></tr>`}
</tbody></table>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      alert("El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para este sitio.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const card = (label: string, value: number, hint: string, Icon: typeof DollarSign, tone: string) => (
    <div className={`p-4 rounded-2xl bg-zinc-900/90 border ${tone}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-zinc-300">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-xl sm:text-3xl font-black text-white mt-1 break-words font-mono">{formatMoney(value)}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{hint}</div>
    </div>
  );

  const th = "p-2.5 text-center whitespace-nowrap";
  const td = "p-2 text-center font-mono whitespace-nowrap";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-red-500" /> Flujo de caja
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Lo invertido en mercadería, lo que se proyecta vender, lo facturado, y el balance de caja.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Descargar Excel
          </button>
          <button
            type="button"
            onClick={print}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {card("Inversión total (c/IVA)", inversionConIva, "Total abonado a proveedores (todas las compras)", DollarSign, "border-red-900/50")}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-900/50">
          <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-zinc-300">
            <TrendingUp className="w-3.5 h-3.5" /> Venta proyectada
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1 break-words font-mono">{formatMoney(ventaProyectada)}</div>
          <div className="text-[11px] text-emerald-400 mt-0.5">Margen: +{formatMoney(ventaProyectada - inversionConIva)}</div>
        </div>
        {card("Facturación total", facturacionTotal, `Monto total vendido (${sales.length} ventas, histórico)`, Receipt, "border-sky-900/50")}
      </div>

      {/* Período y búsqueda: se aplican al balance y a los movimientos */}
      <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col lg:flex-row lg:items-end gap-3 text-xs">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en los movimientos: pedido, cliente, revendedora, compra…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {(
            [
              ["30d", "Últimos 30 días"],
              ["mes", "Este mes"],
              ["mes_pasado", "Mes pasado"],
              ["todo", "Todo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPreset(value)}
              className={`px-3 py-2 rounded-xl font-bold border cursor-pointer ${
                preset === value ? "bg-red-600 border-red-500 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="flex gap-2">
            <label className="text-zinc-400">
              <span className="block text-[10px] mb-0.5">Desde</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                }}
                className="px-2 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white [color-scheme:dark]"
              />
            </label>
            <label className="text-zinc-400">
              <span className="block text-[10px] mb-0.5">Hasta</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                }}
                className="px-2 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white [color-scheme:dark]"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Balance de sumas y saldos */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white">
            Balance de sumas y saldos <span className="text-xs font-normal text-zinc-400">· {periodLabel}</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setFormError("");
              setShowForm((v) => !v);
            }}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showForm ? "Cancelar" : "Agregar registro"}
          </button>
        </div>
        {showForm && (
          <form onSubmit={saveEntry} className="p-3 sm:p-4 rounded-2xl bg-zinc-900/90 border border-red-900/50 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 text-xs items-end">
            <div className="lg:col-span-1">
              <span className="block text-[10px] text-zinc-400 mb-1">Tipo</span>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    ["debe", "Debe", "entra"],
                    ["haber", "Haber", "sale"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, side: value, category: "", customCategory: "" })}
                    className={`px-2 py-1.5 rounded-lg border font-bold cursor-pointer ${
                      form.side === value
                        ? value === "debe"
                          ? "bg-emerald-900/60 border-emerald-600 text-emerald-200"
                          : "bg-rose-900/60 border-rose-600 text-rose-200"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400"
                    }`}
                  >
                    {label} <span className="font-normal opacity-80">({hint})</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="text-zinc-400">
              <span className="block text-[10px] mb-1">Fecha</span>
              <input
                type="date"
                value={form.date}
                max={toInputDate(new Date())}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white [color-scheme:dark]"
              />
            </label>
            <label className="text-zinc-400">
              <span className="block text-[10px] mb-1">Categoría</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white"
              >
                <option value="">Elegí una categoría…</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__otra">Otra (escribir)…</option>
              </select>
              {form.category === "__otra" && (
                <input
                  type="text"
                  value={form.customCategory}
                  onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                  placeholder="Nombre de la categoría"
                  maxLength={60}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white"
                />
              )}
            </label>
            <label className="text-zinc-400 lg:col-span-2">
              <span className="block text-[10px] mb-1">Descripción</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={form.side === "haber" ? "Ej: 20 perchas de madera / Posnet Getnet" : "Ej: Aporte para mercadería"}
                maxLength={300}
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white"
              />
            </label>
            <label className="text-zinc-400">
              <span className="block text-[10px] mb-1">Monto ($)</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.,]/g, "") })}
                placeholder="0"
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center justify-end gap-2">
              {formError && <p className="mr-auto p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-200">{formError}</p>}
              <button
                type="submit"
                disabled={savingEntry}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {savingEntry && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar registro
              </button>
            </div>
          </form>
        )}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-950/95 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="p-2.5 text-left">Cuenta</th>
                  <th className={th}>Movimientos</th>
                  <th className={`${th} text-emerald-400`}>Debe (entra)</th>
                  <th className={`${th} text-rose-300`}>Haber (sale)</th>
                  <th className={th}>Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {balance.map((b) => (
                  <tr key={b.cuenta} className="hover:bg-zinc-800/40">
                    <td className="p-2 font-semibold text-zinc-200 whitespace-nowrap">{b.cuenta}</td>
                    <td className={`${td} text-zinc-300`}>{b.movimientos}</td>
                    <td className={`${td} text-emerald-300`}>{b.debe ? money(b.debe) : "—"}</td>
                    <td className={`${td} text-rose-300`}>{b.haber ? money(b.haber) : "—"}</td>
                    <td className={`${td} font-bold ${b.saldo < 0 ? "text-rose-300" : "text-white"}`}>{money(b.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-950/90 border-t border-zinc-700 text-[11px]">
                <tr>
                  <td className="p-2 font-black text-white uppercase">Sumas</td>
                  <td className={`${td} text-zinc-300`}>{delPeriodo.length}</td>
                  <td className={`${td} font-black text-emerald-300`}>{money(sumaDebe)}</td>
                  <td className={`${td} font-black text-rose-300`}>{money(sumaHaber)}</td>
                  <td className={`${td} font-black text-white`}>{money(round2(sumaDebe - sumaHaber))}</td>
                </tr>
                {start && (
                  <tr>
                    <td className="p-2 text-zinc-400" colSpan={4}>
                      Saldo anterior (antes del {fmtDate(`${from}T00:00:00`)})
                    </td>
                    <td className={`${td} text-zinc-300`}>{money(saldoAnterior)}</td>
                  </tr>
                )}
                <tr>
                  <td className="p-2 font-black text-white uppercase" colSpan={4}>
                    Saldo final
                  </td>
                  <td className={`${td} font-black text-base ${saldoFinal < 0 ? "text-rose-300" : "text-amber-300"}`}>{money(saldoFinal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Movimientos (planilla) */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-white">
          Movimientos <span className="text-xs font-normal text-zinc-400">· {visibles.length} de {delPeriodo.length}</span>
        </h3>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs">
              <thead className="bg-zinc-950/95 sticky top-0 z-20 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className={th}>Fecha</th>
                  <th className="p-2.5 text-left">Cuenta</th>
                  <th className={th}>Comprobante</th>
                  <th className="p-2.5 text-left min-w-[240px]">Detalle</th>
                  <th className={th}>Medio de pago</th>
                  <th className={`${th} text-emerald-400`}>Debe</th>
                  <th className={`${th} text-rose-300`}>Haber</th>
                  <th className={th}>Saldo</th>
                  <th className="p-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {start && (
                  <tr className="bg-zinc-950/40">
                    <td className={`${td} text-zinc-500`}>{fmtDate(`${from}T00:00:00`)}</td>
                    <td className="p-2 text-zinc-400 italic" colSpan={6}>
                      Saldo anterior
                    </td>
                    <td className={`${td} text-zinc-300`}>{money(saldoAnterior)}</td>
                    <td />
                  </tr>
                )}
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-zinc-500">
                      No hay movimientos para mostrar.
                    </td>
                  </tr>
                ) : (
                  visibles.map((m) => (
                    <tr key={m.key} className="hover:bg-zinc-800/40">
                      <td className={`${td} text-zinc-300`}>{fmtDate(m.date)}</td>
                      <td
                        className={`p-2 whitespace-nowrap font-semibold ${
                          m.manualId
                            ? "text-violet-300"
                            : m.cuenta === "Ventas"
                            ? "text-emerald-300"
                            : m.cuenta === "Compras a proveedores"
                            ? "text-rose-300"
                            : "text-amber-300"
                        }`}
                      >
                        {m.cuenta}
                      </td>
                      <td className={`${td} text-red-400 font-bold`}>{m.comprobante}</td>
                      <td className="p-2 text-zinc-300" title={m.notas || undefined}>
                        {m.detalle}
                        {m.notas && <span className="ml-1 text-zinc-500 cursor-help">ⓘ</span>}
                      </td>
                      <td className="p-2 text-center text-zinc-400 whitespace-nowrap">{m.medio || "—"}</td>
                      <td className={`${td} text-emerald-300`}>{m.debe ? money(m.debe) : ""}</td>
                      <td className={`${td} text-rose-300`}>{m.haber ? money(m.haber) : ""}</td>
                      <td className={`${td} font-bold ${m.saldo < 0 ? "text-rose-300" : "text-white"}`}>{money(m.saldo)}</td>
                      <td className="p-2 text-center">
                        {m.manualId && (
                          <button
                            type="button"
                            onClick={() => deleteEntry(m.manualId as string, m.detalle)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Borrar registro manual"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
