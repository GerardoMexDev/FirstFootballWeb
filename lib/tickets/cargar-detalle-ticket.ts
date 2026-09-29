/**
 * Bundle del panel del ticket: el ticket + su historial + quién mira (para decidir botones).
 * Cliente SSR con cookies → RLS aplica.
 *
 * Football First. Creado 2026-09-28.
 */
import { DateTime } from 'luxon';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { DetalleTicket, EventoHistorial } from '@/lib/tickets/tipos';

export interface DetalleTicketBundle {
  ticket: DetalleTicket;
  historial: EventoHistorial[];
  usuario: { id: string; cargo: string };
  hoyUy: string;
}

export async function cargarDetalleTicket(
  supabase: ReturnType<typeof crearClienteServidor>,
  id: string,
): Promise<DetalleTicketBundle | null> {
  const [detalle, sesion] = await Promise.all([
    new RepositorioTicketsSupabase(supabase).obtenerDetalle(id),
    sesionActual(),
  ]);
  if (!detalle || !sesion) return null;
  return {
    ...detalle,
    usuario: { id: sesion.usuarioId, cargo: sesion.cargo },
    hoyUy: DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '',
  };
}
