"use client";

import React, { useMemo, useState } from "react";
import { DollarSign, PiggyBank, Receipt, TrendingUp, Users } from "lucide-react";
import type { PurchaseRecord, Reseller, Sale } from "@/app/products";
import { formatMoney } from "@/lib/pricing";

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

type Preset = "30d" | "mes" | "mes_pasado" | "todo" | "custom";

// Pestaña "Flujo de caja": inversión, venta proyectada, facturación y comisiones de revendedoras
export default function CashSummaryTab({ purchases, sales, resellers }: Props) {
  // Comisiones: por defecto los últimos 30 días
  const [from, setFrom] = useState(() => toInputDate(daysAgo(30)));
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [preset, setPreset] = useState<Preset>("30d");

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

  // Mismos cálculos que "Compras y proveedores" y "Ventas"
  const inversionConIva = purchases.reduce((acc, p) => acc + (p.totalCostConIva || 0), 0);
  const ventaProyectada = purchases.reduce((acc, p) => acc + (p.totalSaleEstimated || 0), 0);
  const facturacionTotal = sales.reduce((acc, s) => acc + s.totalAmount, 0);

  // Comisiones por revendedora en el período elegido (desde/hasta inclusive, en hora local)
  const commissions = useMemo(() => {
    const start = from ? new Date(`${from}T00:00:00`) : null;
    const end = to ? new Date(`${to}T23:59:59.999`) : null;
    const byReseller = new Map<string, { id: string; name: string; total: number; sales: number; units: number; pending: number }>();
    for (const s of sales) {
      if (!s.resellerId) continue;
      const d = new Date(s.date);
      if ((start && d < start) || (end && d > end)) continue;
      const name = resellers.find((r) => r.id === s.resellerId)?.name || s.resellerName || "Revendedora";
      const row = byReseller.get(s.resellerId) || { id: s.resellerId, name, total: 0, sales: 0, units: 0, pending: 0 };
      row.total += s.commissionTotal || 0;
      row.sales += 1;
      row.units += s.items.reduce((u, i) => u + i.quantity, 0);
      if (s.commissionPending) row.pending += 1;
      byReseller.set(s.resellerId, row);
    }
    const rows = [...byReseller.values()].sort((a, b) => b.total - a.total);
    return { rows, total: rows.reduce((t, r) => t + r.total, 0) };
  }, [sales, resellers, from, to]);

  const card = (label: string, value: number, hint: string, Icon: typeof DollarSign, tone: string) => (
    <div className={`p-4 rounded-2xl bg-zinc-900/90 border ${tone}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-zinc-300">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-xl sm:text-3xl font-black text-white mt-1 break-words font-mono">{formatMoney(value)}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{hint}</div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="pb-4 border-b border-zinc-800">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <PiggyBank className="w-6 h-6 text-red-500" /> Flujo de caja
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Lo invertido en mercadería, lo que se proyecta vender, lo facturado y las comisiones de las revendedoras.
        </p>
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

      {/* Comisiones de revendedoras */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> Comisiones de revendedoras
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Suma de comisiones de las ventas concretadas en el período (por fecha de venta).</p>
          </div>
          <div className="flex flex-wrap items-end gap-2 text-xs">
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
                className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                  preset === value ? "bg-red-600 border-red-500 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
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

        {commissions.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No hay comisiones de revendedoras en este período.</p>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Revendedora</th>
                  <th className="p-3 text-center hidden sm:table-cell">Ventas</th>
                  <th className="p-3 text-center hidden sm:table-cell">Unidades</th>
                  <th className="p-3 text-right">Total comisiones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {commissions.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30">
                    <td className="p-3 font-bold text-white">
                      {r.name}
                      {r.pending > 0 && (
                        <span className="block text-[10px] font-semibold text-amber-300">
                          {r.pending} {r.pending === 1 ? "venta" : "ventas"} con comisión a definir
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center text-zinc-300 hidden sm:table-cell">{r.sales}</td>
                    <td className="p-3 text-center text-zinc-300 hidden sm:table-cell">{r.units}</td>
                    <td className="p-3 text-right font-mono font-black text-amber-300">{formatMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-950/80">
                <tr>
                  <td className="p-3 font-black text-white uppercase" colSpan={1}>
                    Total
                  </td>
                  <td className="p-3 hidden sm:table-cell" colSpan={2} />
                  <td className="p-3 text-right font-mono font-black text-lg text-amber-300">{formatMoney(commissions.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
