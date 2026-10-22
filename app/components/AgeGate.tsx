"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldAlert, ShieldCheck, LogOut } from "lucide-react";

// Confirmación válida para la sesión del navegador: se vuelve a pedir en cada visita nueva
const STORAGE_KEY = "ps_age_confirmed";
const EXIT_URL = "https://www.google.com";

// Aviso de sitio para adultos. Se muestra al entrar a la tienda hasta confirmar la mayoría de edad.
export default function AgeGate() {
  // "checking": todavía no se sabe (se cubre la página para no mostrar contenido antes de tiempo)
  const [state, setState] = useState<"checking" | "open" | "closed">("checking");
  const reduce = useReducedMotion();
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let confirmed = false;
    try {
      confirmed = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {}
    setState(confirmed ? "closed" : "open");
  }, []);

  // Bloquear el scroll de fondo y enfocar "Entrar" mientras el aviso está abierto
  useEffect(() => {
    if (state === "closed") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => enterRef.current?.focus(), 400);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [state]);

  const enter = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setState("closed");
  };

  const leave = () => {
    window.location.href = EXIT_URL;
  };

  return (
    <AnimatePresence>
      {state !== "closed" && (
        <motion.div
          key="age-gate"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto bg-[#070304]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          aria-describedby="age-gate-desc"
        >
          {/* Fondo: manchas de luz que se mueven suave */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <motion.div
              className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-red-700/30 blur-3xl"
              animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full bg-rose-600/25 blur-3xl"
              animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -30, 0], scale: [1.1, 1, 1.1] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-1/3 left-1/2 w-[22rem] h-[22rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
              animate={reduce ? undefined : { opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Brillos flotantes */}
            {!reduce &&
              Array.from({ length: 14 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-red-300/60"
                  style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
                  animate={{ y: [0, -30, 0], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 5 + (i % 5), repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                />
              ))}
          </div>

          {state === "open" && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-md my-auto"
            >
              {/* Marco con degradé que gira (recortado al borde redondeado) */}
              <div className="relative rounded-[28px] p-[2px] overflow-hidden shadow-2xl shadow-red-950/60">
              <motion.div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 w-[200%] aspect-square -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,#dc2626,#f43f5e,#f59e0b,#7f1d1d,#dc2626)]"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative rounded-[26px] bg-zinc-950 px-6 py-7 sm:px-9 sm:py-9 text-center overflow-hidden">
                {/* Logo flotando con halo */}
                <motion.div
                  className="relative mx-auto w-44 h-32 sm:w-56 sm:h-40"
                  animate={reduce ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-4 rounded-full bg-red-600/40 blur-2xl"
                    animate={reduce ? undefined : { scale: [0.9, 1.1, 0.9], opacity: [0.5, 0.9, 0.5] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/pecados/logo-transparent.png"
                    alt="Pecados Serranos"
                    className="relative w-full h-full object-contain drop-shadow-[0_10px_25px_rgba(220,38,38,0.45)]"
                  />
                </motion.div>

                {/* Sello +18 */}
                <motion.div
                  initial={reduce ? undefined : { scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
                  className="mx-auto -mt-1 mb-3 inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-red-500 bg-red-950/60 text-red-300 font-black text-lg shadow-[0_0_25px_rgba(239,68,68,0.45)]"
                  aria-hidden="true"
                >
                  +18
                </motion.div>

                <motion.h2
                  id="age-gate-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="text-2xl sm:text-3xl font-black text-white leading-tight"
                >
                  Este es un sitio web <span className="text-red-500">para adultos</span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Aviso a los usuarios
                </motion.p>

                {/* Texto del aviso (lo completa la tienda) */}
                <motion.p
                  id="age-gate-desc"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-4 text-sm text-zinc-300 leading-relaxed"
                >
                  Este sitio web contiene material restringido a menores de edad, que incluye desnudez y objetos explícitos utilizados y/o comercializados para actividad sexual. Al entrar, afirma que tiene por lo menos 18 años de edad o la mayoría de edad en la jurisdicción desde que está accediendo el sitio web y que da consentimiento en ver contenido sexualmente explícito.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="mt-6 flex flex-col gap-2.5"
                >
                  <motion.button
                    ref={enterRef}
                    type="button"
                    onClick={enter}
                    whileHover={reduce ? undefined : { scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 bg-[length:200%_100%] text-white font-bold text-sm shadow-lg shadow-red-900/50 overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    animate={reduce ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  >
                    <span className="relative inline-flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Tengo 18 años o más — Entrar
                    </span>
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={leave}
                    whileHover={reduce ? undefined : { scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3 rounded-2xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold text-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LogOut className="w-4 h-4" /> Soy menor de 18 años — Salir
                    </span>
                  </motion.button>
                </motion.div>

                {/* Controles parentales */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-6 p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-left"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Sugerencia de controles parentales</p>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Si usted es padre, por favor configure <strong className="text-zinc-200">Family Link</strong>, bloquee el acceso a sitios web con
                    contenido para adultos y habilite <strong className="text-zinc-200">SafeSearch</strong> en su motor de búsqueda.
                  </p>
                </motion.div>
              </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
