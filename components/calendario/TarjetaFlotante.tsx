/**
 * Tarjeta flotante con el texto completo de un chip del calendario (reunión de cierre con la
 * agencia, 2026-10-01, punto 1): en celdas angostas el chip corta el texto con "…" y en
 * celular además oculta la etiqueta.
 *
 * - Escritorio: al pasar el mouse (o llegar con Tab) por un chip CORTADO aparece la tarjeta;
 *   si el chip ya se lee entero no aparece nada.
 * - Celular / clic: los chips sin panel (`<div>`: fechas de la agencia, partidos de Contenido y
 *   de la selección, aniversarios de club) la abren y la cierran al tocar. Los que tienen panel
 *   siguen abriendo su panel, que ya muestra todo.
 * - Se cierra con Escape, al tocar afuera, al hacer scroll o al cambiar el tamaño de la ventana.
 *
 * La tarjeta es `aria-hidden`: el texto completo ya está en el chip para el lector de
 * pantalla (el "…" es solo visual), así no se lee dos veces.
 *
 * Football First (Fase 1). Creado 2026-10-05.
 */
'use client';

import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

/** Lo que muestra la tarjeta. */
export interface DatosTarjeta {
  /** YYYY-MM-DD del día de la celda. */
  fecha: string;
  etiqueta: string;
  texto: string;
}

interface Abierta extends DatosTarjeta {
  rect: DOMRect;
  /** true si la abrió un clic/toque (se cierra al tocar afuera); false si fue hover/foco. */
  fija: boolean;
}

const ANCHO = 260;
const MARGEN = 16;

/** "Martes 6 de octubre" — el día es una fecha civil, se formatea en UTC para que no se corra. */
function fechaLarga(fecha: string): string {
  const texto = new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** El chip no se lee entero: texto cortado con "…" o etiqueta oculta (celular). */
function estaCortado(el: HTMLElement): boolean {
  const b = el.querySelector('b');
  const etiquetaOculta = b !== null && getComputedStyle(b).display === 'none';
  return etiquetaOculta || el.scrollWidth > el.clientWidth + 1;
}

/**
 * Estado de la tarjeta + los handlers que se reparten a cada chip.
 * `paraChip(datos)` va en todos los chips; `paraChipSinPanel(datos)` suma el toque.
 */
export function useTarjetaFlotante() {
  const [abierta, setAbierta] = useState<Abierta | null>(null);
  const chipRef = useRef<HTMLElement | null>(null);

  const cerrar = useCallback(() => {
    chipRef.current = null;
    setAbierta(null);
  }, []);

  useEffect(() => {
    if (!abierta) return;
    function alTocarAfuera(e: globalThis.PointerEvent) {
      if (chipRef.current && chipRef.current.contains(e.target as Node)) return;
      cerrar();
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar();
    }
    document.addEventListener('pointerdown', alTocarAfuera);
    document.addEventListener('keydown', alTeclear);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('pointerdown', alTocarAfuera);
      document.removeEventListener('keydown', alTeclear);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierta, cerrar]);

  function mostrar(el: HTMLElement, datos: DatosTarjeta, fija: boolean) {
    chipRef.current = el;
    setAbierta({ ...datos, rect: el.getBoundingClientRect(), fija });
  }

  /** Hover (solo mouse) y foco de teclado: abre si el chip está cortado. */
  function paraChip(datos: DatosTarjeta) {
    return {
      onPointerEnter: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && estaCortado(e.currentTarget)) mostrar(e.currentTarget, datos, false);
      },
      onPointerLeave: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && !abierta?.fija) cerrar();
      },
      onFocus: (e: FocusEvent<HTMLElement>) => {
        if (e.currentTarget.matches(':focus-visible') && estaCortado(e.currentTarget)) mostrar(e.currentTarget, datos, false);
      },
      onBlur: () => {
        if (!abierta?.fija) cerrar();
      },
    };
  }

  /** Chips sin panel: además, el clic/toque abre o cierra la tarjeta (siempre, esté cortado o no). */
  function paraChipSinPanel(datos: DatosTarjeta) {
    return {
      ...paraChip(datos),
      onClick: (e: MouseEvent<HTMLElement>) => {
        if (abierta?.fija && chipRef.current === e.currentTarget) cerrar();
        else mostrar(e.currentTarget, datos, true);
      },
    };
  }

  const tarjeta =
    abierta && typeof document !== 'undefined'
      ? createPortal(<Tarjeta {...abierta} />, document.body)
      : null;

  return { paraChip, paraChipSinPanel, tarjeta };
}

/** La tarjeta en sí: arriba del chip si hay lugar, si no abajo; siempre dentro de la pantalla. */
function Tarjeta({ fecha, etiqueta, texto, rect }: Abierta) {
  const vw = window.innerWidth;
  const ancho = Math.min(ANCHO, vw - MARGEN * 2);
  const left = Math.min(Math.max(rect.left + rect.width / 2 - ancho / 2, MARGEN), vw - MARGEN - ancho);
  const arriba = rect.top > 160;
  const posicion = arriba
    ? { bottom: window.innerHeight - rect.top + 6 }
    : { top: rect.bottom + 6 };

  return (
    <div className="calflot" aria-hidden="true" style={{ left, width: ancho, ...posicion }}>
      <span className="calflot__f">{fechaLarga(fecha)}</span>
      <b className="calflot__e">{etiqueta}</b>
      <span className="calflot__t">{texto}</span>
    </div>
  );
}
