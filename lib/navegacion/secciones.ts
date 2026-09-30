/**
 * Secciones de la app, definidas UNA vez para la nav de arriba (`Nav`, > 960 px) y la barra
 * de pestañas inferior (`BarraInferior`, ≤ 960 px), así nunca se desincronizan.
 * "Tickets" no aparece para el cargo Prueba (spec 2026-09-29-pantalla-tickets.md).
 *
 * Football First. Creado 2026-09-29 (sacado de components/layout/Nav.tsx).
 */
import type { NombreIcono } from '@/components/comunes/Ico';

export interface Seccion {
  v: 'partidos' | 'calendario' | 'jugadores' | 'tickets';
  /** Texto de la nav de arriba. */
  etiqueta: string;
  /** Texto corto de la barra inferior. */
  corta: string;
  icono: NombreIcono;
}

export const SECCIONES: Seccion[] = [
  { v: 'partidos', etiqueta: 'Partidos', corta: 'Partidos', icono: 'reloj' },
  // 2026-09-30: un solo calendario con filtros (antes "Match Day" y "Calendario general").
  { v: 'calendario', etiqueta: 'Calendario', corta: 'Calendario', icono: 'calendario' },
  { v: 'jugadores', etiqueta: 'Jugadores', corta: 'Jugadores', icono: 'persona' },
  { v: 'tickets', etiqueta: 'Tickets', corta: 'Tickets', icono: 'lista' },
];

export function seccionesPara(cargo: string): Seccion[] {
  return cargo === 'Prueba' ? SECCIONES.filter((s) => s.v !== 'tickets') : SECCIONES;
}

export function esSeccionActiva(pathname: string, v: string): boolean {
  return pathname === `/${v}` || pathname.startsWith(`/${v}/`);
}
