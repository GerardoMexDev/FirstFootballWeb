/**
 * Textos de fecha de los tickets: "Vence en 4 días · vie 2/10", "⚠️ Vencido…", y fechas
 * cortas en hora de Uruguay para el historial. Puro (solo luxon).
 *
 * Football First. Creado 2026-09-28.
 */
import { DateTime } from 'luxon';
import type { EstadoTicket } from '@/lib/tickets/tipos';

const ZONA = 'America/Montevideo';
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']; // Luxon: weekday 1 = lunes

/** "vie 2/10" para una fecha civil YYYY-MM-DD. */
export function fechaCortaUy(dia: string): string {
  const d = DateTime.fromISO(dia, { zone: ZONA });
  return `${DIAS[d.weekday - 1]} ${d.day}/${d.month}`;
}

/** "sáb 4/10 20:15" para un instante ISO, en hora de Uruguay. */
export function fechaHoraCortaUy(iso: string): string {
  const d = DateTime.fromISO(iso, { zone: 'utc' }).setZone(ZONA);
  return `${DIAS[d.weekday - 1]} ${d.day}/${d.month} ${d.toFormat('HH:mm')}`;
}

/**
 * Texto de vencimiento. `null` cuando ya no aplica (aprobado, publicado, cancelado).
 * `vencido` pinta en rojo.
 */
export function textoVencimiento(
  fechaLimite: string | null,
  estado: EstadoTicket,
  hoyUy: string,
): { texto: string; vencido: boolean } | null {
  if (estado === 'aprobado' || estado === 'publicado' || estado === 'cancelado') return null;
  if (!fechaLimite) return { texto: 'Sin fecha límite', vencido: false };
  const dias = Math.round(
    DateTime.fromISO(fechaLimite, { zone: 'utc' }).diff(DateTime.fromISO(hoyUy, { zone: 'utc' }), 'days').days,
  );
  const fecha = fechaCortaUy(fechaLimite);
  if (dias === 0) return { texto: 'Vence hoy', vencido: false };
  if (dias === 1) return { texto: `Vence mañana · ${fecha}`, vencido: false };
  if (dias > 1) return { texto: `Vence en ${dias} días · ${fecha}`, vencido: false };
  const atraso = -dias;
  return { texto: `Vencido hace ${atraso} día${atraso === 1 ? '' : 's'} · ${fecha}`, vencido: true };
}

/** "Cumpleaños · jue 1/10": el evento de un ticket de fecha (0028). */
export function textoEvento(motivo: string, fechaEvento: string): string {
  return `${motivo} · ${fechaCortaUy(fechaEvento)}`;
}
