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

const FUNCION: Record<Accion, string> = {
  entregar: 'ticket_entregar',
  aprobar: 'ticket_aprobar',
  devolver: 'ticket_devolver',
  publicar: 'ticket_publicar',
  cancelar: 'ticket_cancelar',
  comentar: 'ticket_comentar',
};

export async function ejecutarAccion(
  supabase: Cliente,
  accion: Accion,
  ticketId: string,
  datos: { texto?: string; link?: string },
): Promise<Resultado<null>> {
  const args: Record<string, string | null> = { p_ticket: ticketId, p_texto: datos.texto ?? null };
  if (accion === 'entregar') args.p_link = datos.link ?? '';
  const { error } = await supabase.rpc(FUNCION[accion], args);
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: null };
}
