/**
 * Semáforo de los tickets (0030): 🔴 pendiente, 🟢 completado, 🟡 vencido. Sirve para
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
};

export function estadoVisual(t: ResumenTicket, hoyUy: string): EstadoVisual | null {
  if (t.estado === 'cancelado') return null;
  if (t.estado === 'publicado' || t.estado === 'aprobado' || t.estado === 'en_revision') return 'completado';
  if (t.fechaLimite && DateTime.fromISO(t.fechaLimite) < DateTime.fromISO(hoyUy)) return 'vencido';
  return 'pendiente';
}

const ORDEN: EstadoVisual[] = ['vencido', 'pendiente', 'completado'];
export function peorEstado(estados: (EstadoVisual | null)[]): EstadoVisual | null {
  for (const e of ORDEN) if (estados.includes(e)) return e;
  return null;
}
