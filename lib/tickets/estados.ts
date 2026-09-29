/**
 * Metadatos visibles de cada estado de ticket y reglas de "cuál manda" cuando un partido
 * tiene más de un ticket (hay un chip por partido en el calendario). Puro.
 *
 * Football First. Creado 2026-09-28.
 */
import type { EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

/** El símbolo acompaña al color: el estado se lee aunque no se distingan los colores. */
export const META_ESTADO: Record<EstadoTicket, { etiqueta: string; corta: string; simbolo: string }> = {
  pendiente: { etiqueta: 'Pendiente', corta: 'Pendiente', simbolo: '●' },
  en_revision: { etiqueta: 'En revisión', corta: 'Revisión', simbolo: '◐' },
  aprobado: { etiqueta: 'Aprobado', corta: 'Aprobado', simbolo: '✓' },
  publicado: { etiqueta: 'Publicado', corta: 'Publicado', simbolo: '✓✓' },
  cancelado: { etiqueta: 'Cancelado', corta: 'Cancelado', simbolo: '○' },
};

/**
 * Texto de la lucecita roja (2026-09-29) según lo que hay que hacer. Solo en los estados en
 * los que alguien tiene que actuar; a quién le toca lo decide `debeActuar` (permisos.ts).
 */
export const TEXTO_ALERTA: Partial<Record<EstadoTicket, string>> = {
  pendiente: 'Ticket pendiente',
  en_revision: 'Para revisar',
  aprobado: 'Para publicar',
};

/**
 * `{ partidoId: texto }` a partir de los tickets que ya le tocan al usuario (`pendientesDe`).
 * Con varios tickets en un partido manda el más urgente. Tickets sin partido no alertan.
 */
export function alertasPorPartido(pendientes: ResumenTicket[]): Record<string, string> {
  const alertas: Record<string, string> = {};
  for (const [partidoId, r] of Object.entries(resumirPorPartido(pendientes))) {
    const texto = TEXTO_ALERTA[r.estado];
    if (texto) alertas[partidoId] = texto;
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
