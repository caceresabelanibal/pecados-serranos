"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

interface MpStatus {
  configured: boolean;
  enabled: boolean;
  testMode: boolean;
  tokenHint: string;
  account: { id: number; nickname: string; email: string; siteId: string } | null;
}

// Ajustes > Mercado Pago: credenciales de la cuenta que cobra las compras online
export default function MercadoPagoSettings() {
  const [status, setStatus] = useState<MpStatus | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mercadopago", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (method: "PUT" | "DELETE", body: object, okMsg: string) => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch("/api/admin/mercadopago", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "No se pudo guardar.");
        return;
      }
      setStatus(out);
      setToken("");
      setSaved(okMsg);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-sky-400" /> Cobro online con Mercado Pago
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Con Mercado Pago activo, el botón <strong className="text-zinc-200">Finalizar compra</strong> del carrito lleva al cliente a pagar en
        Mercado Pago (dinero en cuenta, tarjetas, Mercado Crédito o efectivo) y el dinero entra a la cuenta de estas credenciales. Sin
        Mercado Pago, los pedidos siguen llegando por WhatsApp.
      </p>

      {status && (
        <div
          className={`mt-4 p-3 rounded-xl border text-xs ${
            status.enabled ? "bg-emerald-950/30 border-emerald-800 text-emerald-200" : "bg-zinc-950 border-zinc-800 text-zinc-300"
          }`}
        >
          {status.configured ? (
            <>
              <span className="font-bold">{status.enabled ? "✓ Cobro online activo" : "⏸ Cobro online pausado"}</span>
              {status.testMode && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">MODO PRUEBA</span>}
              <span className="block mt-1 text-zinc-300">
                Cobra en la cuenta: <strong className="text-white">{status.account?.nickname || "—"}</strong>
                {status.account?.email ? ` (${status.account.email})` : ""}
              </span>
              <span className="block text-zinc-500 font-mono">Access Token: {status.tokenHint}</span>
            </>
          ) : (
            <span>Todavía no está configurado.</span>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <label className="text-xs text-zinc-400 font-medium block">
          {status?.configured ? "Reemplazar Access Token de producción" : "Access Token de producción"}
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value.trim())}
          placeholder="APP_USR-…"
          autoComplete="off"
          spellCheck={false}
          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => send("PUT", { accessToken: token, enabled: true }, "Credenciales verificadas y guardadas. El cobro online quedó activo.")}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Verificar y guardar
          </button>
          {status?.configured && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  send("PUT", { enabled: !status.enabled }, status.enabled ? "Cobro online pausado: los pedidos vuelven a WhatsApp." : "Cobro online activado.")
                }
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer"
              >
                {status.enabled ? "Pausar cobro online" : "Activar cobro online"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("¿Quitar las credenciales de Mercado Pago? La tienda vuelve a tomar pedidos por WhatsApp.")) {
                    send("DELETE", {}, "Credenciales eliminadas.");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-red-950/60 border border-zinc-800 hover:border-red-900 text-zinc-400 hover:text-red-200 text-xs font-bold cursor-pointer"
              >
                Quitar credenciales
              </button>
            </>
          )}
        </div>
        {error && <p className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">{error}</p>}
        {saved && <p className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs">{saved}</p>}
      </div>

      <details className="mt-4 text-xs text-zinc-400">
        <summary className="cursor-pointer font-semibold text-zinc-300">¿Dónde consigo el Access Token?</summary>
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          <li>
            Entrá con la cuenta de Mercado Pago que va a recibir el dinero a{" "}
            <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer" className="text-sky-400 inline-flex items-center gap-0.5">
              Tus integraciones <ExternalLink className="w-3 h-3" />
            </a>
            .
          </li>
          <li>Creá una aplicación (tipo de pago: &quot;Pagos online&quot;, producto: &quot;Checkout Pro&quot;).</li>
          <li>
            En la aplicación, abrí <strong className="text-zinc-200">Credenciales de producción</strong> (puede pedir completar los datos del negocio).
          </li>
          <li>
            Copiá el <strong className="text-zinc-200">Access Token</strong> (empieza con APP_USR-) y pegalo acá. Es secreto: no lo compartas.
          </li>
        </ol>
        <p className="mt-2">Los avisos de pago se configuran solos: no hace falta cargar ninguna URL en Mercado Pago.</p>
      </details>
    </div>
  );
}
