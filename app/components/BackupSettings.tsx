"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, Loader2, Upload, X } from "lucide-react";

// Descarga el backup completo de la base (archivo .psbak comprimido). Devuelve el nombre o lanza un error.
async function downloadBackup(): Promise<string> {
  const res = await fetch("/api/admin/backup", { cache: "no-store" });
  if (!res.ok) {
    const out = await res.json().catch(() => ({}));
    throw new Error(out.error || "No se pudo generar el backup.");
  }
  const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "pecados_backup.psbak";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return `${name} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`;
}

// Ajustes > Copia de seguridad: backup completo de la base y restauración
export default function BackupSettings() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState("");
  const [error, setError] = useState("");
  const [showRestore, setShowRestore] = useState(false);
  // Pasos de la restauración
  const [safetyBackup, setSafetyBackup] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restored, setRestored] = useState(false);

  const doDownload = async (forSafety: boolean) => {
    setDownloading(true);
    setError("");
    setRestoreError("");
    try {
      const name = await downloadBackup();
      if (forSafety) setSafetyBackup(name);
      else setDownloaded(name);
    } catch (e: any) {
      (forSafety ? setRestoreError : setError)(e?.message || "No se pudo generar el backup.");
    } finally {
      setDownloading(false);
    }
  };

  const openRestore = () => {
    setSafetyBackup("");
    setFile(null);
    setUnderstood(false);
    setConfirmText("");
    setRestoreError("");
    setRestored(false);
    setShowRestore(true);
  };

  const canRestore = Boolean(file) && understood && confirmText.trim().toUpperCase() === "RESTAURAR" && !restoring;

  const doRestore = async () => {
    if (!file || !canRestore) return;
    if (!safetyBackup && !window.confirm("No descargaste un backup del estado actual. Si seguís, lo que hay ahora se pierde para siempre. ¿Restaurar igual?")) {
      return;
    }
    setRestoring(true);
    setRestoreError("");
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "x-ps-confirm": "RESTAURAR" },
        body: file,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRestoreError(out.error || "No se pudo restaurar el backup.");
        return;
      }
      setRestored(true);
      // Se recarga el panel con los datos restaurados
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setRestoreError("Se cortó la conexión mientras se restauraba. Recargá la página y revisá los datos antes de reintentar.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Database className="w-4 h-4 text-emerald-400" /> Copia de seguridad de la base de datos
      </h3>
      <p className="text-xs text-zinc-400">
        Descargá un backup <strong className="text-zinc-200">completo y comprimido</strong> de toda la tienda: productos, fotos, stock,
        ventas, compras, revendedoras, mercadería entregada, interesados y configuración. Con ese mismo archivo (.psbak) podés volver la
        tienda exactamente a ese momento.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => doDownload(false)}
          disabled={downloading}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          {downloading && !showRestore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar backup completo
        </button>
        <button
          type="button"
          onClick={openRestore}
          className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-2 border border-zinc-700 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-zinc-400" /> Restaurar un backup
        </button>
      </div>
      {downloaded && (
        <p className="text-xs text-emerald-300 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Backup descargado: {downloaded}. Guardalo en un lugar seguro (tiene todos los datos de la tienda).
        </p>
      )}
      {error && <p className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">{error}</p>}

      {showRestore && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => !restoring && setShowRestore(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-red-900/70 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" /> Restaurar un backup
              </h3>
              <button type="button" onClick={() => setShowRestore(false)} disabled={restoring} className="p-1 rounded-lg text-zinc-400 hover:text-white" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>

            {restored ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">Backup restaurado correctamente.</p>
                <p className="text-xs text-zinc-400">Recargando el panel con los datos restaurados…</p>
              </div>
            ) : (
              <div className="p-4 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-red-100 space-y-1.5">
                  <p className="font-bold text-red-200">⚠ Atención: esta acción reemplaza TODOS los datos de la tienda.</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-red-100/90">
                    <li>Todo lo cargado después de la fecha del backup se pierde: ventas, compras online, stock, productos, fotos y cambios de precios.</li>
                    <li>Las compras que se estén pagando en este momento pueden quedar sin registrar.</li>
                    <li>Las sesiones abiertas de revendedoras pueden cerrarse.</li>
                    <li>No se puede deshacer, salvo con otro backup.</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <p className="font-bold text-white">1. Hacé un backup del estado actual (recomendado)</p>
                  <p className="text-zinc-400">Por las dudas, así podés volver a como está la tienda ahora si algo no sale como esperabas.</p>
                  {safetyBackup ? (
                    <p className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Descargado: {safetyBackup}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => doDownload(true)}
                      disabled={downloading || restoring}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Descargar backup del estado actual
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <p className="font-bold text-white">2. Elegí el backup a restaurar</p>
                  <input
                    type="file"
                    accept=".psbak"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setRestoreError("");
                    }}
                    className="block w-full text-zinc-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-zinc-100 file:font-bold"
                  />
                  {file && (
                    <p className="text-zinc-400">
                      {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                      {file.lastModified ? ` · ${new Date(file.lastModified).toLocaleString("es-AR")}` : ""}
                    </p>
                  )}
                  <p className="text-zinc-500">Sólo se aceptan backups descargados desde este panel.</p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <p className="font-bold text-white">3. Confirmá</p>
                  <label className="flex items-start gap-2 text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
                    Entiendo que se reemplazan todos los datos actuales de la tienda por los del backup.
                  </label>
                  <label className="block text-zinc-400">
                    Escribí <strong className="text-white font-mono">RESTAURAR</strong> para habilitar el botón:
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      autoComplete="off"
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                    />
                  </label>
                </div>

                {restoreError && <p className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200">{restoreError}</p>}

                <div className="pt-2 border-t border-zinc-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRestore(false)}
                    disabled={restoring}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={doRestore}
                    disabled={!canRestore}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {restoring && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {restoring ? "Restaurando… no cierres la página" : "Restaurar backup"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
