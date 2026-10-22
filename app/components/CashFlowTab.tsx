"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, Edit3, FileSpreadsheet, FileUp, Search, Wallet, X } from "lucide-react";
import type { Product } from "@/app/products";
import { flujoDeCaja, formatMoney, missingFields } from "@/lib/pricing";
import { buildSearchText, matchesSearch } from "@/lib/search";

export type PricingPatch = Partial<Pick<Product, "costoSinIva" | "multiplicadorGanancia" | "stock" | "precioEfectivo">>;

interface Props {
  products: Product[];
  onUpdateProduct: (id: string, patch: PricingPatch) => void;
  onEditProduct: (p: Product) => void;
  onOpenImport: () => void;
  importSuccessBanner: string | null;
  onCloseImportBanner: () => void;
  recentlyImported: Record<string, { type: "new" | "restock"; addedQty: number }>;
}

// Input numérico que guarda al salir del campo o con Enter (evita guardar en cada tecla)
function NumberCell({
  value,
  onCommit,
  step = "1",
  integer = false,
  invalid = false,
  className = "",
}: {
  value: number;
  onCommit: (v: number) => void;
  step?: string;
  integer?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = integer ? parseInt(draft || "0", 10) : parseFloat((draft || "0").replace(",", "."));
    const v = Number.isFinite(n) && n >= 0 ? n : 0;
    setDraft(null);
    if (v !== value) onCommit(v);
  };
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={draft ?? (value || value === 0 ? String(value) : "")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className={`w-full px-2 py-1 rounded-lg bg-zinc-950 border text-xs text-center font-mono focus:outline-none focus:border-red-500 ${
        invalid ? "border-amber-600 text-amber-200" : "border-zinc-800 text-white"
      } ${className}`}
    />
  );
}

export default function CashFlowTab({
  products,
  onUpdateProduct,
  onEditProduct,
  onOpenImport,
  importSuccessBanner,
  onCloseImportBanner,
  recentlyImported,
}: Props) {
  const [query, setQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const rows = useMemo(
    () =>
      products.map((p) => {
        const calc = flujoDeCaja(p);
        const missing = missingFields(p);
        return {
          product: p,
          calc,
          missing,
          // Texto con todos los valores de la fila para el buscador
          searchText: buildSearchText([
            p.sku,
            p.title,
            p.tipo,
            p.category,
            missing.length ? `incompleto ${missing.join(" ")}` : "completo",
            calc.proveedorSinIva,
            calc.proveedorConIva,
            calc.multiplicador,
            calc.ganancia,
            calc.cantidad,
            calc.sinIvaPorCantidad,
            calc.conIvaPorCantidad,
            calc.gananciaTotal,
            calc.precioPublicoFT,
            calc.precioPublicoTC,
          ]),
        };
      }),
    [products]
  );

  const incompleteCount = rows.filter((r) => r.missing.length > 0).length;

  const visible = rows.filter((r) => {
    if (onlyIncomplete && r.missing.length === 0) return false;
    return matchesSearch(r.searchText, query);
  });

  const totals = visible.reduce(
    (t, { calc }) => {
      t.sinIva += calc.proveedorSinIva;
      t.conIva += calc.proveedorConIva;
      t.ganancia += calc.ganancia;
      t.cantidad += calc.cantidad;
      t.sinIvaC += calc.sinIvaPorCantidad;
      t.conIvaC += calc.conIvaPorCantidad;
      t.gananciaTotal += calc.gananciaTotal;
      t.ft += calc.precioPublicoFT;
      t.tc += calc.precioPublicoTC;
      return t;
    },
    { sinIva: 0, conIva: 0, ganancia: 0, cantidad: 0, sinIvaC: 0, conIvaC: 0, gananciaTotal: 0, ft: 0, tc: 0 }
  );

  const exportExcel = () => {
    const data = visible.map(({ product: p, calc: c }) => ({
      Tipo: p.tipo || p.category || "",
      Código: p.sku,
      Descripción: p.title,
      "Proveedor SIN IVA": c.proveedorSinIva,
      "Proveedor con IVA": c.proveedorConIva,
      Multiplicador: c.multiplicador || "",
      Ganancia: c.ganancia,
      Cantidad: c.cantidad,
      "S/IVA * C": c.sinIvaPorCantidad,
      "C/IVA * C": c.conIvaPorCantidad,
      "Ganancia total Maru": c.gananciaTotal,
      "Precio Publico FT": c.precioPublicoFT,
      "Precio Publico TC": c.precioPublicoTC,
    }));
    data.push({
      Tipo: "TOTALES",
      Código: "",
      Descripción: "",
      "Proveedor SIN IVA": totals.sinIva,
      "Proveedor con IVA": totals.conIva,
      Multiplicador: "",
      Ganancia: totals.ganancia,
      Cantidad: totals.cantidad,
      "S/IVA * C": totals.sinIvaC,
      "C/IVA * C": totals.conIvaC,
      "Ganancia total Maru": totals.gananciaTotal,
      "Precio Publico FT": totals.ft,
      "Precio Publico TC": totals.tc,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 50 }, ...Array(10).fill({ wch: 16 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flujo de caja");
    XLSX.writeFile(wb, `Flujo_de_caja_Pecados_Serranos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const th = "p-2.5 text-center whitespace-nowrap";
  const td = "p-2 text-center font-mono whitespace-nowrap";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-red-500" /> Flujo de caja
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Mismas fórmulas que la planilla VShop. Editá <strong>Proveedor SIN IVA</strong>, <strong>multiplicador</strong>,{" "}
            <strong>Cantidad</strong> y <strong>Precio Público FT</strong>; el resto se calcula solo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenImport}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/40 transition-all cursor-pointer"
            title="Subir el Excel de una compra para sumar stock o agregar productos nuevos"
          >
            <FileUp className="w-4 h-4" /> Importar Compra (Excel)
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Buscador: cualquier valor de la fila (código, descripción, tipo, importes, cantidades, multiplicador) */}
      <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cualquier valor: código, descripción, tipo, importes ($19.175), cantidad, x1.7, incompleto…"
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-[11px] text-zinc-400 whitespace-nowrap">
          {visible.length} de {rows.length}
        </span>
      </div>

      {importSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-700/80 text-emerald-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-white">Importación de compra guardada</h4>
              <p className="text-xs text-emerald-200 mt-0.5">{importSuccessBanner}</p>
            </div>
          </div>
          <button type="button" onClick={onCloseImportBanner} className="p-1 rounded-lg hover:bg-emerald-900/60 text-emerald-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {incompleteCount > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{incompleteCount}</strong> {incompleteCount === 1 ? "producto incompleto" : "productos incompletos"}: no se
              muestran en la tienda hasta completar todos los valores.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setOnlyIncomplete((v) => !v)}
            className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-100 font-bold cursor-pointer"
          >
            {onlyIncomplete ? "Ver todos" : "Ver sólo incompletos"}
          </button>
        </div>
      )}


      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950/95 sticky top-0 z-20 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className={th}>Código</th>
                <th className="p-2.5 text-left min-w-[200px]">Artículo</th>
                <th className={`${th} min-w-[110px]`}>Proveedor SIN IVA</th>
                <th className={`${th} text-amber-300`}>Proveedor con IVA</th>
                <th className={`${th} text-rose-300 min-w-[150px]`}>Ganancia</th>
                <th className={`${th} min-w-[80px]`}>Cantidad</th>
                <th className={th}>S/IVA * C</th>
                <th className={`${th} text-amber-300`}>C/IVA * C</th>
                <th className={`${th} text-rose-300`}>Ganancia total Maru</th>
                <th className={`${th} text-emerald-400 min-w-[110px]`}>Precio Publico FT</th>
                <th className={`${th} text-blue-400`}>Precio Publico TC</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-zinc-500">
                    No hay artículos para mostrar.
                  </td>
                </tr>
              ) : (
                visible.map(({ product: p, calc: c, missing }) => {
                  const imported = recentlyImported[(p.sku || "").toUpperCase()];
                  const noMult = missing.includes("Multiplicador de ganancia");
                  return (
                    <tr
                      key={p.id}
                      className={missing.length > 0 ? "bg-amber-950/15 hover:bg-amber-950/25" : imported ? "bg-emerald-950/20" : "hover:bg-zinc-800/40"}
                    >
                      <td className="p-2 text-center font-mono font-bold text-red-400 whitespace-nowrap align-top">
                        {p.sku}
                        {imported && (
                          <span className="block text-[9px] font-sans text-emerald-300">
                            {imported.type === "new" ? "Nuevo" : "+Stock"} (+{imported.addedQty})
                          </span>
                        )}
                      </td>
                      <td className="p-2 align-top">
                        <span className="text-white font-semibold line-clamp-2" title={p.title}>
                          {p.title}
                        </span>
                        <span className="text-[10px] text-zinc-500">{p.tipo || p.category}</span>
                        {missing.length > 0 && (
                          <span
                            className="mt-1 flex items-start gap-1 text-[10px] font-bold text-amber-300"
                            title="No se muestra en la tienda hasta completar estos datos"
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-px" /> Incompleto: falta {missing.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <NumberCell
                          value={c.proveedorSinIva}
                          step="0.01"
                          invalid={c.proveedorSinIva <= 0}
                          onCommit={(v) => onUpdateProduct(p.id, { costoSinIva: v })}
                        />
                      </td>
                      <td className={`${td} text-amber-300`}>{formatMoney(c.proveedorConIva)}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-20 shrink-0" title="Multiplicador sobre Proveedor con IVA (ej: 1.5, 1.75, 2)">
                            <NumberCell
                              value={c.multiplicador}
                              step="0.01"
                              invalid={noMult}
                              onCommit={(v) => onUpdateProduct(p.id, { multiplicadorGanancia: v })}
                            />
                          </div>
                          <span className="font-mono text-rose-300 whitespace-nowrap">{formatMoney(c.ganancia)}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <NumberCell value={c.cantidad} integer onCommit={(v) => onUpdateProduct(p.id, { stock: v })} />
                      </td>
                      <td className={`${td} text-zinc-300`}>{formatMoney(c.sinIvaPorCantidad)}</td>
                      <td className={`${td} text-amber-300`}>{formatMoney(c.conIvaPorCantidad)}</td>
                      <td className={`${td} text-rose-300 font-bold`}>{formatMoney(c.gananciaTotal)}</td>
                      <td className="p-2">
                        <NumberCell
                          value={c.precioPublicoFT}
                          step="0.01"
                          invalid={c.precioPublicoFT <= 0}
                          onCommit={(v) => onUpdateProduct(p.id, { precioEfectivo: v })}
                        />
                      </td>
                      <td className={`${td} text-blue-300 font-bold`}>{formatMoney(c.precioPublicoTC)}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => onEditProduct(p)}
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                          title="Editar artículo completo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-zinc-950 text-white font-black border-t-2 border-red-700 sticky bottom-0 z-20">
              <tr>
                <td colSpan={2} className="p-2.5 uppercase tracking-wider text-red-400 text-[11px]">
                  Totales ({visible.length} artículos)
                </td>
                <td className={td}>{formatMoney(totals.sinIva)}</td>
                <td className={`${td} text-amber-300`}>{formatMoney(totals.conIva)}</td>
                <td className={`${td} text-rose-300`}>{formatMoney(totals.ganancia)}</td>
                <td className={td}>{totals.cantidad}</td>
                <td className={td}>{formatMoney(totals.sinIvaC)}</td>
                <td className={`${td} text-amber-300`}>{formatMoney(totals.conIvaC)}</td>
                <td className={`${td} text-rose-300`}>{formatMoney(totals.gananciaTotal)}</td>
                <td className={`${td} text-emerald-400`}>{formatMoney(totals.ft)}</td>
                <td className={`${td} text-blue-300`}>{formatMoney(totals.tc)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
