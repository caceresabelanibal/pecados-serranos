"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";

interface Props {
  src: string; // imagen a mostrar
  zoomSrc?: string; // imagen en alta resolución para la lupa
  alt: string;
  onClose: () => void;
}

const ZOOM = 2.5;

// Vista ampliada de un producto con lupa que se mueve con el mouse o arrastrando el dedo
export default function ImageZoom({ src, zoomSrc, alt, onClose }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 }); // posición de la lupa (0..1) sobre la imagen
  const [lensOn, setLensOn] = useState(true);
  const dragging = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const measure = useCallback(() => {
    const r = imgRef.current?.getBoundingClientRect();
    if (r && r.width > 0) setBox({ w: r.width, h: r.height });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    // Precargar la imagen de alta resolución
    if (zoomSrc) new window.Image().src = zoomSrc;
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
    };
  }, [measure, zoomSrc]);

  const moveTo = (clientX: number, clientY: number) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setPos({
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    });
  };

  const lensSize = box ? Math.round(Math.min(160, Math.max(110, box.w * 0.38))) : 140;
  const lensImg = zoomSrc || src;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Foto ampliada: ${alt}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="relative z-10 w-full max-w-3xl flex flex-col items-center"
      >
        <div className="w-full flex items-center justify-between gap-2 mb-2">
          <p className="text-xs sm:text-sm font-semibold text-white line-clamp-1">{alt}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLensOn((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                lensOn ? "bg-red-600 border-red-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-300"
              }`}
              aria-pressed={lensOn}
            >
              <Search className="w-3.5 h-3.5" /> Lupa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="relative rounded-2xl bg-white overflow-hidden select-none"
          style={{ touchAction: lensOn ? "none" : "auto" }}
          onPointerDown={(e) => {
            if (!lensOn) return;
            dragging.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            moveTo(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            // Con mouse la lupa sigue al puntero; con el dedo, mientras se arrastra
            if (lensOn && (e.pointerType === "mouse" || dragging.current)) moveTo(e.clientX, e.clientY);
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={measure}
            draggable={false}
            className="block max-w-full max-h-[75vh] w-auto h-auto object-contain"
          />

          {lensOn && box && (
            <div
              className="pointer-events-none absolute rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgba(220,38,38,0.9),0_10px_30px_rgba(0,0,0,0.5)] bg-no-repeat bg-white"
              style={{
                width: lensSize,
                height: lensSize,
                left: pos.x * box.w - lensSize / 2,
                top: pos.y * box.h - lensSize / 2,
                backgroundImage: `url("${lensImg}")`,
                backgroundSize: `${box.w * ZOOM}px ${box.h * ZOOM}px`,
                backgroundPosition: `${-(pos.x * box.w * ZOOM - lensSize / 2)}px ${-(pos.y * box.h * ZOOM - lensSize / 2)}px`,
              }}
            />
          )}
        </div>

        <p className="mt-2 text-[11px] text-zinc-400 text-center">
          {lensOn ? "Arrastrá la lupa (o mové el mouse) para ver otro punto de la foto." : "Activá la lupa para ver de cerca."}
        </p>
      </motion.div>
    </div>
  );
}
