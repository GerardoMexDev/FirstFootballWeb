/**
 * Escrituras de tickets: SIEMPRE por las funciones de la base (0025), nunca a las tablas.
 * Reciben el cliente de Supabase del navegador (sesión del usuario → la base valida
 * puesto y estado). Devuelven `Resultado` con un mensaje listo para mostrar.
 *
 * Football First. Creado 2026-09-28.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensajeError } from '@/lib/tickets/errores';
import type { Accion } from '@/lib/tickets/tipos';

export type Resultado<T> = { ok: true; valor: T } | { ok: false; mensaje: string };

type Cliente = SupabaseClient<any, any, any>;

export async function crearTicket(
  supabase: Cliente,
  partidoId: string,
  jugadorId: string,
  nota: string,
): Promise<Resultado<string>> {
  const { data, error } = await supabase.rpc('ticket_crear', {
    p_partido: partidoId,
    p_jugador: jugadorId,
    p_nota: nota,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: data as string };
}

/** Ticket atado a una fecha (cumpleaños, aniversario, "Otra fecha") — 0028. `fecha` yyyy-mm-dd. */
export async function crearTicketEvento(
  supabase: Cliente,
  datos: { jugadorId: string; fecha: string; motivo: string; nota: string },
): Promise<Resultado<string>> {
  const { data, error } = await supabase.rpc('ticket_crear_evento', {
    p_jugador: datos.jugadorId,
    p_fecha: datos.fecha,
    p_motivo: datos.motivo,
    p_nota: datos.nota,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: data as string };
}

/** Tilda o destilda "Completado" de un partido de Match Day para un jugador (solo Diseñador, 0030). */
export async function marcarDiseno(
  supabase: Cliente,
  partidoId: string,
  jugadorId: string,
  completado: boolean,
): Promise<Resultado<null>> {
  const { error } = await supabase.rpc('diseno_partido_marcar', {
    p_partido: partidoId,
    p_jugador: jugadorId,
    p_completado: completado,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: null };
}

// 0030: recorrido simple. Las RPC viejas (entregar, aprobar, devolver, publicar) quedan en la base.
const FUNCION: Record<Accion, string> = {
  completar: 'ticket_completar',
  reabrir: 'ticket_reabrir',
  cancelar: 'ticket_cancelar',
  comentar: 'ticket_comentar',
};

export async function ejecutarAccion(
  supabase: Cliente,
  accion: Accion,
  ticketId: string,
  datos: { texto?: string },
): Promise<Resultado<null>> {
  const args: Record<string, string | null> = { p_ticket: ticketId, p_texto: datos.texto ?? null };
  const { error } = await supabase.rpc(FUNCION[accion], args);
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: null };
}
