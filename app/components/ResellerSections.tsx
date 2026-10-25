"use client";

import React, { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { PAYMENT_METHOD_LABELS, commissionStatus, owedToStore, type Reseller, type Sale } from "@/app/products";
import { formatMoney } from "@/lib/pricing";

// Fecha local en formato del <input type="date"> (AAAA-MM-DD)
const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Totales de comisiones de un grupo de ventas, según quién tiene que pagarlas
export function commissionTotals(sales: Sale[]) {
  const t = { total: 0, owed: 0, owedSales: [] as Sale[], paid: 0, lastPaidAt: "", retained: 0, retainedSettled: 0, undefinedCount: 0 };
  for (const s of sales) {
    const st = commissionStatus(s);
    const c = s.commissionTotal || 0;
    if (st === "none") continue;
    if (st === "undefined") {
      t.undefinedCount++;
      continue;
    }
    if (s.commissionPending) t.undefinedCount++;
    t.total += c;
    if (st === "owed") {
      t.owed += c;
      t.owedSales.push(s);
    } else if (st === "paid") {
      t.paid += c;
      if (s.commissionPaidAt && s.commissionPaidAt > t.lastPaidAt) t.lastPaidAt = s.commissionPaidAt;
    } else if (st === "retained") t.retained += c;
    else if (st === "retained_settled") t.retainedSettled += c;
  }
  return t;
}

type Preset = "30d" | "mes" | "mes_pasado" | "todo" | "custom";

// Resumen de comisiones de todas las revendedoras en un período (por defecto, últimos 30 días)
export function CommissionSummary({ sales, resellers }: { sales: Sale[]; resellers: Reseller[] }) {
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

  const rows = useMemo(() => {
    const start = from ? new Date(`${from}T00:00:00`) : null;
    const end = to ? new Date(`${to}T23:59:59.999`) : null;
    const byReseller = new Map<string, Sale[]>();
    for (const s of sales) {
      if (!s.resellerId) continue;
      const d = new Date(s.date);
      if ((start && d < start) || (end && d > end)) continue;
      byReseller.set(s.resellerId, [...(byReseller.get(s.resellerId) || []), s]);
    }
    return [...byReseller.entries()]
      .map(([id, list]) => ({
        id,
        name: resellers.find((r) => r.id === id)?.name || list[0].resellerName || "Revendedora",
        sales: list.length,
        units: list.reduce((u, s) => u + s.items.reduce((t, i) => t + i.quantity, 0), 0),
        ...commissionTotals(list),
      }))
      .sort((a, b) => b.total - a.total);
  }, [sales, resellers, from, to]);

  const sum = (k: "total" | "paid" | "owed" | "retained" | "retainedSettled") => rows.reduce((t, r) => t + r[k], 0);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" /> Comisiones de revendedoras
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Por fecha de venta. <strong className="text-zinc-300">Adeudadas/pagadas</strong>: ventas que cobró la tienda.{" "}
            <strong className="text-zinc-300">Descontadas al rendir</strong>: ventas que cobró la revendedora.
          </p>
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

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No hay comisiones de revendedoras en este período.</p>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-2.5 text-left">Revendedora</th>
                <th className="p-2.5 text-center">Ventas</th>
                <th className="p-2.5 text-center">Unid.</th>
                <th className="p-2.5 text-right">Comisión total</th>
                <th className="p-2.5 text-right text-rose-300">Adeudada</th>
                <th className="p-2.5 text-right text-emerald-400">Pagada</th>
                <th className="p-2.5 text-right text-sky-300">Descontada al rendir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/30">
                  <td className="p-2 font-bold text-white">
                    {r.name}
                    {r.undefinedCount > 0 && (
                      <span className="block text-[10px] font-semibold text-amber-300">
                        {r.undefinedCount} {r.undefinedCount === 1 ? "venta" : "ventas"} con comisión a definir
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center text-zinc-300">{r.sales}</td>
                  <td className="p-2 text-center text-zinc-300">{r.units}</td>
                  <td className="p-2 text-right font-mono font-black text-amber-300">{formatMoney(r.total)}</td>
                  <td className="p-2 text-right font-mono text-rose-300">{r.owed ? formatMoney(r.owed) : "—"}</td>
                  <td className="p-2 text-right font-mono text-emerald-300">
                    {r.paid ? formatMoney(r.paid) : "—"}
                    {r.lastPaidAt && <span className="block text-[10px] text-zinc-500">último pago {fmtDay(r.lastPaidAt)}</span>}
                  </td>
                  <td className="p-2 text-right font-mono text-sky-300">
                    {r.retained + r.retainedSettled ? formatMoney(r.retained + r.retainedSettled) : "—"}
                    {r.retained > 0 && <span className="block text-[10px] text-zinc-500">{formatMoney(r.retained)} sin rendir</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-950/80 font-mono">
              <tr>
                <td className="p-2.5 font-sans font-black text-white uppercase">Total</td>
                <td className="p-2.5" colSpan={2} />
                <td className="p-2.5 text-right font-black text-base text-amber-300">{formatMoney(sum("total"))}</td>
                <td className="p-2.5 text-right font-black text-rose-300">{formatMoney(sum("owed"))}</td>
                <td className="p-2.5 text-right font-black text-emerald-300">{formatMoney(sum("paid"))}</td>
                <td className="p-2.5 text-right font-black text-sky-300">{formatMoney(sum("retained") + sum("retainedSettled"))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// Estado de las comisiones de una revendedora: lo que la tienda le adeuda, lo pagado y lo descontado al rendir
export function ResellerCommissionBox({
  reseller,
  sales,
  onPay,
}: {
  reseller: Reseller;
  sales: Sale[];
  onPay: (ids: string[], paid: boolean, paidAt?: string) => void;
}) {
  const t = commissionTotals(sales);
  const [paidAt, setPaidAt] = useState(() => toInputDate(new Date()));
  return (
    <div className="mt-2 p-3 rounded-xl bg-amber-950/20 border border-amber-900/50 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-amber-200">Comisiones de {reseller.name}</span>
        {t.owed > 0 ? (
          <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-200 font-bold">
            Se le adeudan {formatMoney(t.owed)}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
            {t.total > 0 ? "✓ No se le adeudan comisiones" : "Sin comisiones todavía"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
          <span className="block text-[10px] uppercase text-zinc-500 font-semibold">Adeudadas (cobró la tienda)</span>
          <span className="block text-sm font-black font-mono text-rose-300">{formatMoney(t.owed)}</span>
          <span className="text-[10px] text-zinc-500">{t.owedSales.length} {t.owedSales.length === 1 ? "venta" : "ventas"}</span>
        </div>
        <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
          <span className="block text-[10px] uppercase text-zinc-500 font-semibold">Pagadas</span>
          <span className="block text-sm font-black font-mono text-emerald-300">{formatMoney(t.paid)}</span>
          <span className="text-[10px] text-zinc-500">{t.lastPaidAt ? `Último pago: ${fmtDay(t.lastPaidAt)}` : "Sin pagos registrados"}</span>
        </div>
        <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
          <span className="block text-[10px] uppercase text-zinc-500 font-semibold">Descontadas al rendir (cobró ella)</span>
          <span className="block text-sm font-black font-mono text-sky-300">{formatMoney(t.retained + t.retainedSettled)}</span>
          <span className="text-[10px] text-zinc-500">{t.retained > 0 ? `${formatMoney(t.retained)} todavía sin rendir` : "Todo rendido"}</span>
        </div>
      </div>
      {t.owed > 0 && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <label className="text-zinc-400">
            <span className="block text-[10px] mb-0.5">Fecha de pago</span>
            <input
              type="date"
              value={paidAt}
              max={toInputDate(new Date())}
              onChange={(e) => setPaidAt(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Le pagaste ${formatMoney(t.owed)} de comisiones a ${reseller.name}? Se registra el pago con fecha ${fmtDay(`${paidAt}T12:00:00`)}.`)) {
                onPay(t.owedSales.map((s) => s.id), true, paidAt);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold cursor-pointer"
          >
            Registrar pago de {formatMoney(t.owed)}
          </button>
        </div>
      )}
      {t.undefinedCount > 0 && (
        <p className="text-[10px] text-amber-300">
          {t.undefinedCount} {t.undefinedCount === 1 ? "venta tiene" : "ventas tienen"} artículos con comisión a definir (no se suman hasta definirla).
        </p>
      )}
    </div>
  );
}

// Ventas de una revendedora agrupadas por compra (como en la pestaña Ventas)
export function ResellerSalesList({
  reseller,
  sales,
  onDefineCommission,
  onCommissionPaid,
}: {
  reseller: Reseller;
  sales: Sale[];
  onDefineCommission: (resellerId: string, resellerName: string, productId: string, productTitle: string) => void;
  onCommissionPaid: (ids: string[], paid: boolean, paidAt?: string) => void;
}) {
  const sorted = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (sorted.length === 0) return <p className="text-[11px] text-zinc-500">Todavía no tiene ventas.</p>;
  return (
    <div className="grid gap-2 lg:grid-cols-2 max-h-[32rem] overflow-y-auto pr-1">
      {sorted.map((s) => {
        const st = commissionStatus(s);
        const byCode = s.channel === "web_whatsapp";
        const inHand = !byCode && /consignaci|Rendición de lote/.test(s.notes || "");
        const owed = owedToStore(s);
        return (
          <div key={s.id} className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-[11px] space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold text-white">{s.buyerName || "Cliente"}</span>
                {s.orderCode && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono font-bold text-amber-300 tracking-wider">
                    Pedido {s.orderCode}
                  </span>
                )}
                <span className="block text-[10px] text-zinc-400">
                  {new Date(s.date).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {byCode ? "🏷️ Compra online con su código" : inHand ? "📦 De su mercadería en mano" : "🏬 Del depósito"}
                  {" · "}
                  {PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod}
                </span>
              </div>
              <span className="font-mono font-black text-emerald-400 whitespace-nowrap">{formatMoney(s.totalAmount)}</span>
            </div>

            <ul className="space-y-0.5">
              {s.items.map((i, idx) => (
                <li key={idx} className="text-zinc-300 flex flex-wrap items-center gap-x-1.5">
                  <span>
                    <strong className="text-white">{i.quantity}x</strong> {i.productTitle}
                  </span>
                  <span className="text-zinc-500">— {formatMoney(i.subtotal)}</span>
                  {i.commissionUnit === null || i.commissionUnit === undefined ? (
                    i.productId && (
                      <button
                        type="button"
                        onClick={() => onDefineCommission(reseller.id, reseller.name, i.productId, i.productTitle)}
                        className="px-1.5 py-0.5 rounded border border-amber-700 bg-amber-950 text-amber-300 text-[10px] font-bold cursor-pointer"
                      >
                        Definir comisión
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-amber-200/80">· comisión {formatMoney(i.commissionUnit)} c/u</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="pt-1.5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <span className="font-bold text-amber-300">Comisión: {formatMoney(s.commissionTotal || 0)}</span>
              {st === "owed" && (
                <span className="flex items-center gap-1.5">
                  <span className="text-rose-300 font-bold">Adeudada</span>
                  <button
                    type="button"
                    onClick={() => onCommissionPaid([s.id], true)}
                    className="px-1.5 py-0.5 rounded border border-emerald-700 bg-emerald-950 text-emerald-300 font-bold cursor-pointer"
                  >
                    Marcar pagada hoy
                  </button>
                </span>
              )}
              {st === "paid" && (
                <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  ✓ Pagada el {fmtDay(s.commissionPaidAt as string)}
                  <button type="button" onClick={() => onCommissionPaid([s.id], false)} className="text-zinc-500 hover:text-zinc-300 underline font-normal cursor-pointer">
                    deshacer
                  </button>
                </span>
              )}
              {st === "retained" && <span className="text-sky-300">La descuenta al rendir · a cobrarle {formatMoney(owed)}</span>}
              {st === "retained_settled" && <span className="text-emerald-300">✓ Rendida (comisión descontada)</span>}
              {st === "undefined" && <span className="text-amber-300 font-bold">Comisión a definir</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
