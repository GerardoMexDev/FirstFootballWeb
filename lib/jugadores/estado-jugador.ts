/**
 * Suspender / reactivar un jugador (0049): SIEMPRE por las funciones de la base, que validan
 * el cargo y el motivo (un trigger rechaza cambiar `activo` por otro camino). Reciben el
 * cliente del navegador (sesión del usuario) y devuelven un mensaje listo para mostrar.
 * `puedeSuspender` solo decide si se muestran los botones.
 *
 * Football First. Creado 2026-11-06.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensajeError } from '@/lib/tickets/errores';

export type Resultado = { ok: true } | { ok: false; mensaje: string };

type Cliente = SupabaseClient<any, any, any>;

/** Quién ve los botones Suspender / Reactivar (decisión de Gerardo 2026-11-06). La base valida igual. */
export function puedeSuspender(cargo: string | null | undefined): boolean {
  return cargo === 'Administrador' || cargo === 'Community Manager';
}

export async function suspenderJugador(supabase: Cliente, jugadorId: string, motivo: string): Promise<Resultado> {
  const { error } = await supabase.rpc('jugador_suspender', { p_jugador: jugadorId, p_motivo: motivo });
  return error ? { ok: false, mensaje: mensajeError(error) } : { ok: true };
}

export async function reactivarJugador(supabase: Cliente, jugadorId: string): Promise<Resultado> {
  const { error } = await supabase.rpc('jugador_reactivar', { p_jugador: jugadorId });
  return error ? { ok: false, mensaje: mensajeError(error) } : { ok: true };
}
