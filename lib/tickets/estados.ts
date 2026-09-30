/**
 * Metadatos visibles de cada estado de ticket y reglas de "cuál manda" cuando un partido
 * tiene más de un ticket (hay un chip por partido en el calendario). Puro.
 *
 * Football First. Creado 2026-09-28.
 */
import { DateTime } from 'luxon';
import type { EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

/** El símbolo acompaña al color: el estado se lee aunque no se distingan los colores. */
export const META_ESTADO: Record<EstadoTicket, { etiqueta: string; corta: string; simbolo: string }> = {
  pendiente: { etiqueta: 'Pendiente', corta: 'Pendiente', simbolo: '●' },
  en_revision: { etiqueta: 'En revisión', corta: 'Revisión', simbolo: '◐' },
  aprobado: { etiqueta: 'Aprobado', corta: 'Aprobado', simbolo: '✓' },
  // 0030: 'publicado' es el estado "Completado" del recorrido simple.
  publicado: { etiqueta: 'Completado', corta: 'Completado', simbolo: '✓' },
  cancelado: { etiqueta: 'Cancelado', corta: 'Cancelado', simbolo: '○' },
};

/**
 * Texto de la lucecita (0030): solo lo que venció o vence en 2 días o menos. A quién le toca lo
 * decide `debeActuar` (permisos.ts); acá se vuelve a mirar la fecha para elegir el texto.
 */
export const TEXTO_ALERTA = { vencido: 'Vencido', por_vencer: 'Vence pronto' } as const;

/** Urgencia de un pendiente por su fecha límite (mismo criterio que pantalla.ts, sin importarlo). */
function urgenciaSimple(t: ResumenTicket, hoyUy: string): keyof typeof TEXTO_ALERTA | null {
  if (t.estado !== 'pendiente' || !t.fechaLimite) return null;
  const dias = Math.round(DateTime.fromISO(t.fechaLimite, { zone: 'utc' }).diff(DateTime.fromISO(hoyUy, { zone: 'utc' }), 'days').days);
  if (dias < 0) return 'vencido';
  if (dias <= 2) return 'por_vencer';
  return null;
}

/**
 * `{ partidoId: texto }` de la lucecita: "Vencido" le gana a "Vence pronto" en el mismo partido.
 * Tickets sin partido, completados o al día no alertan.
 */
export function alertasPorPartido(pendientes: ResumenTicket[], hoyUy: string): Record<string, string> {
  const alertas: Record<string, string> = {};
  for (const t of pendientes) {
    if (!t.partidoId) continue;
    const u = urgenciaSimple(t, hoyUy);
    if (!u) continue;
    if (u === 'vencido' || !alertas[t.partidoId]) alertas[t.partidoId] = TEXTO_ALERTA[u];
  }
  return alertas;
}

const URGENCIA: EstadoTicket[] =['pendiente', 'en_revision', 'aprobado', 'publicado'];

/** El estado más urgente de la lista (cancelado no cuenta). `null` si no queda ninguno. */
export function estadoMasUrgente(estados: EstadoTicket[]): EstadoTicket | null {
  for (const e of URGENCIA) if (estados.includes(e)) return e;
  return null;
}

export interface ResumenPartido {
  estado: EstadoTicket;
  /** Tickets no cancelados del partido, en el orden recibido. */
  ticketIds: string[];
}

/** `{ partidoId: { estado más urgente, ids } }` — sin cancelados ni tickets sin partido. */
export function resumirPorPartido(tickets: ResumenTicket[]): Record<string, ResumenPartido> {
  const porPartido: Record<string, ResumenTicket[]> = {};
  for (const t of tickets) {
    if (!t.partidoId || t.estado === 'cancelado') continue;
    (porPartido[t.partidoId] ??= []).push(t);
  }
  const resumen: Record<string, ResumenPartido> = {};
  for (const [partidoId, lista] of Object.entries(porPartido)) {
    const estado = estadoMasUrgente(lista.map((t) => t.estado));
    if (estado) resumen[partidoId] = { estado, ticketIds: lista.map((t) => t.id) };
  }
  return resumen;
}

/** `{ yyyy-mm-dd: tickets }` de los tickets de fecha no cancelados (Calendario general, 0028). */
export function ticketsPorDia(tickets: ResumenTicket[]): Record<string, ResumenTicket[]> {
  const porDia: Record<string, ResumenTicket[]> = {};
  for (const t of tickets) {
    if (!t.fechaEvento || t.estado === 'cancelado') continue;
    (porDia[t.fechaEvento] ??= []).push(t);
  }
  return porDia;
}

/** `{ ticketId: texto }` de la lucecita para tickets de fecha vencidos o por vencer. */
export function alertasPorTicket(pendientes: ResumenTicket[], hoyUy: string): Record<string, string> {
  const alertas: Record<string, string> = {};
  for (const t of pendientes) {
    const u = urgenciaSimple(t, hoyUy);
    if (t.fechaEvento && u) alertas[t.id] = TEXTO_ALERTA[u];
  }
  return alertas;
}

/** Texto de la lucecita para UN ticket (0030): "Vencido", "Vence pronto" o nada. */
export function alertaDe(t: ResumenTicket, hoyUy: string): string | undefined {
  const u = urgenciaSimple(t, hoyUy);
  return u ? TEXTO_ALERTA[u] : undefined;
}
