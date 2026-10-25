"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { DollarSign, FileSpreadsheet, PiggyBank, Printer, Receipt, Search, TrendingUp, Users } from "lucide-react";
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
type Cuenta = "Ventas" | "Compras a proveedores" | "Comisiones de revendedoras";
const CUENTAS: Cuenta[] = ["Ventas", "Compras a proveedores", "Comisiones de revendedoras"];

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
}

// Pestaña "Flujo de caja": inversión, venta proyectada, facturación, balance de sumas y saldos y comisiones
export default function CashSummaryTab({ purchases, sales, resellers }: Props) {
  // Período: por defecto los últimos 30 días
  const [from, setFrom] = useState(() => toInputDate(daysAgo(30)));
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [preset, setPreset] = useState<Preset>("30d");
  const [query, setQuery] = useState("");

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
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, purchases, resellers]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const balance = CUENTAS.map((cuenta) => {
    const ms = delPeriodo.filter((m) => m.cuenta === cuenta);
    const debe = round2(ms.reduce((t, m) => t + m.debe, 0));
    const haber = round2(ms.reduce((t, m) => t + m.haber, 0));
    return { cuenta, movimientos: ms.length, debe, haber, saldo: round2(debe - haber) };
  });
  const sumaDebe = round2(balance.reduce((t, b) => t + b.debe, 0));
  const sumaHaber = round2(balance.reduce((t, b) => t + b.haber, 0));
  const saldoFinal = round2(saldoAnterior + sumaDebe - sumaHaber);

  // Comisiones por revendedora en el período
  const commissions = useMemo(() => {
    const byReseller = new Map<string, { id: string; name: string; total: number; sales: number; units: number; pending: number }>();
    for (const s of sales) {
      if (!s.resellerId || !inRange(s.date)) continue;
      const row = byReseller.get(s.resellerId) || { id: s.resellerId, name: resellerName(s), total: 0, sales: 0, units: 0, pending: 0 };
      row.total += s.commissionTotal || 0;
      row.sales += 1;
      row.units += s.items.reduce((u, i) => u + i.quantity, 0);
      if (s.commissionPending) row.pending += 1;
      byReseller.set(s.resellerId, row);
    }
    const rows = [...byReseller.values()].sort((a, b) => b.total - a.total);
    return { rows, total: rows.reduce((t, r) => t + r.total, 0) };
  }, [sales, resellers, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileStamp = () => toInputDate(new Date());

  // Descarga en Excel: balance, movimientos y comisiones del período
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

    const com = [
      ...commissions.rows.map((r) => ({ Revendedora: r.name, Ventas: r.sales, Unidades: r.units, "Total comisiones": round2(r.total) })),
      { Revendedora: "Total", Ventas: "", Unidades: "", "Total comisiones": round2(commissions.total) },
    ];
    const ws3 = XLSX.utils.json_to_sheet(com);
    ws3["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Comisiones");

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
<h2>Comisiones de revendedoras</h2>
<table><thead><tr><th>Revendedora</th><th class="n">Ventas</th><th class="n">Unidades</th><th class="n">Total comisiones</th></tr></thead><tbody>
${commissions.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${r.sales}</td><td class="n">${r.units}</td><td class="n">${esc(money(r.total))}</td></tr>`).join("") || `<tr><td colspan="4">Sin comisiones en el período.</td></tr>`}
</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${esc(money(commissions.total))}</td></tr></tfoot></table>
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
            Lo invertido en mercadería, lo que se proyecta vender, lo facturado, el balance de caja y las comisiones de las revendedoras.
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

      {/* Período y búsqueda: se aplican al balance, a los movimientos y a las comisiones */}
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
        <h3 className="text-base font-bold text-white">
          Balance de sumas y saldos <span className="text-xs font-normal text-zinc-400">· {periodLabel}</span>
        </h3>
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
                  </tr>
                )}
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-zinc-500">
                      No hay movimientos para mostrar.
                    </td>
                  </tr>
                ) : (
                  visibles.map((m) => (
                    <tr key={m.key} className="hover:bg-zinc-800/40">
                      <td className={`${td} text-zinc-300`}>{fmtDate(m.date)}</td>
                      <td
                        className={`p-2 whitespace-nowrap font-semibold ${
                          m.cuenta === "Ventas" ? "text-emerald-300" : m.cuenta === "Compras a proveedores" ? "text-rose-300" : "text-amber-300"
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Comisiones de revendedoras */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" /> Comisiones de revendedoras <span className="text-xs font-normal text-zinc-400">· {periodLabel}</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Suma de comisiones de las ventas concretadas en el período (por fecha de venta).</p>
        </div>

        {commissions.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No hay comisiones de revendedoras en este período.</p>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5 text-left">Revendedora</th>
                  <th className="p-2.5 text-center hidden sm:table-cell">Ventas</th>
                  <th className="p-2.5 text-center hidden sm:table-cell">Unidades</th>
                  <th className="p-2.5 text-right">Total comisiones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {commissions.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30">
                    <td className="p-2 font-bold text-white">
                      {r.name}
                      {r.pending > 0 && (
                        <span className="block text-[10px] font-semibold text-amber-300">
                          {r.pending} {r.pending === 1 ? "venta" : "ventas"} con comisión a definir
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center text-zinc-300 hidden sm:table-cell">{r.sales}</td>
                    <td className="p-2 text-center text-zinc-300 hidden sm:table-cell">{r.units}</td>
                    <td className="p-2 text-right font-mono font-black text-amber-300">{formatMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-950/80">
                <tr>
                  <td className="p-2.5 font-black text-white uppercase">Total</td>
                  <td className="p-2.5 hidden sm:table-cell" colSpan={2} />
                  <td className="p-2.5 text-right font-mono font-black text-base text-amber-300">{formatMoney(commissions.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
