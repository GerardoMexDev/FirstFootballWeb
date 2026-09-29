/**
 * Datos del bloque "Tickets de diseño" de la ficha del jugador (0028): sus tickets no
 * cancelados, quién mira (para ofrecer "Crear") y sus próximas fechas de Contenido (para
 * el formulario). Si la lectura de tickets falla, `ticketsError` y no se ofrece crear
 * (mismo criterio que el panel del partido: evita duplicados a ciegas).
 *
 * Football First. Creado 2026-09-29.
 */
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { proximasFechas, type ProximaFecha } from '@/lib/jugadores/datos-contenido';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { JugadorFicha } from '@/lib/repositorios/tipos';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export interface TicketsJugadorBundle {
  tickets: ResumenTicket[];
  ticketsError: boolean;
  usuario: { id: string; cargo: string } | null;
  proximas: ProximaFecha[];
  hoyUy: string;
}

export async function cargarTicketsJugador(
  supabase: ReturnType<typeof crearClienteServidor>,
  jugador: JugadorFicha,
  hoyUy: string,
): Promise<TicketsJugadorBundle> {
  let ticketsError = false;
  const [tickets, sesion] = await Promise.all([
    new RepositorioTicketsSupabase(supabase).listarPorJugador(jugador.id).catch((e) => {
      console.error('tickets (ficha del jugador):', e);
      ticketsError = true;
      return [] as ResumenTicket[];
    }),
    sesionActual(),
  ]);
  return {
    tickets,
    ticketsError,
    usuario: sesion ? { id: sesion.usuarioId, cargo: sesion.cargo } : null,
    proximas: proximasFechas(jugador, hoyUy),
    hoyUy,
  };
}
