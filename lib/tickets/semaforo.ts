/**
 * Semáforo de los tickets (0030): 🔴 pendiente, 🟢 completado, 🟡 vencido; ⚪ cancelado (0040). Sirve para
 * automáticos y manuales ("completado" de un manual es el estado 'publicado'). Puro.
 *
 * Football First. Creado 2026-09-30.
 */
import { DateTime } from 'luxon';
import type { EstadoVisual, ResumenTicket } from '@/lib/tickets/tipos';

export const META_VISUAL: Record<EstadoVisual, { etiqueta: string; simbolo: string }> = {
  pendiente: { etiqueta: 'Pendiente', simbolo: '●' },
  completado: { etiqueta: 'Completado', simbolo: '✓' },
  vencido: { etiqueta: 'Vencido', simbolo: '!' },
  cancelado: { etiqueta: 'Cancelado', simbolo: '–' },
};

export function estadoVisual(t: ResumenTicket, hoyUy: string): EstadoVisual | null {
  if (t.estado === 'cancelado') return 'cancelado';
  if (t.estado === 'publicado' || t.estado === 'aprobado' || t.estado === 'en_revision') return 'completado';
  if (t.fechaLimite && DateTime.fromISO(t.fechaLimite) < DateTime.fromISO(hoyUy)) return 'vencido';
  return 'pendiente';
}

const ORDEN: EstadoVisual[] = ['vencido', 'pendiente', 'completado', 'cancelado'];
export function peorEstado(estados: (EstadoVisual | null)[]): EstadoVisual | null {
  for (const e of ORDEN) if (estados.includes(e)) return e;
  return null;
}

/** `{ '<partido>:<jugador>': true }` de los Match Day de último momento, para las tarjetas (0040). */
export function ultimoMomentoPorPartidoJugador(tickets: ResumenTicket[]): Record<string, true> {
  const r: Record<string, true> = {};
  for (const t of tickets) if (t.partidoId && t.ultimoMomento) r[`${t.partidoId}:${t.jugadorId}`] = true;
  return r;
}

/** `{ '<partido>:<jugador>': semáforo }` para las tarjetas de /partidos (0030). */
export function estadosPorPartidoJugador(tickets: ResumenTicket[], hoyUy: string): Record<string, EstadoVisual> {
  const r: Record<string, EstadoVisual> = {};
  for (const t of tickets) {
    const e = estadoVisual(t, hoyUy);
    if (t.partidoId && e) r[`${t.partidoId}:${t.jugadorId}`] = e;
  }
  return r;
}
