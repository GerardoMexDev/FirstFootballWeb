/**
 * Tildar/destildar "Convocado" de un representado de Match Day en un partido de la selección
 * uruguaya (RPC `seleccion_convocar`, migración 0032). Convocado = ese partido pasa a Match Day
 * con su cara y su ticket automático para el Diseñador. Solo Administrador y Community Manager
 * (lo valida la base).
 *
 * Football First. Creado 2026-09-30.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensajeError } from '@/lib/tickets/errores';
import type { Resultado } from '@/lib/tickets/acciones';

type Cliente = SupabaseClient<any, any, any>;

export async function convocar(
  supabase: Cliente,
  partidoId: string,
  jugadorId: string,
  convocado: boolean,
): Promise<Resultado<null>> {
  const { error } = await supabase.rpc('seleccion_convocar', {
    p_partido: partidoId,
    p_jugador: jugadorId,
    p_convocado: convocado,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: null };
}
