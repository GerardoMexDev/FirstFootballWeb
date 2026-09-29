/**
 * Tickets que esperan algo del usuario de la sesión (`pendientesDe`), leídos UNA vez por
 * request: el layout (contador de la barra) y las páginas (lucecita de /partidos y del
 * calendario) llaman a esta función y React.cache evita la segunda consulta.
 *
 * Degradación elegante: si la lectura falla, lista vacía (la app se ve sin alertas).
 * "Prueba" nunca tiene pendientes: ni se consulta.
 *
 * Football First. Creado 2026-09-29 (sacado de app/(app)/layout.tsx).
 */
import { cache } from 'react';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { pendientesDe } from '@/lib/tickets/permisos';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export const pendientesDeSesion = cache(async (): Promise<ResumenTicket[]> => {
  const sesion = await sesionActual();
  if (!sesion || sesion.cargo === 'Prueba') return [];
  const tickets = await new RepositorioTicketsSupabase(crearClienteServidor())
    .listarPendientes()
    .catch((e) => {
      console.error('tickets (pendientes de sesión):', e);
      return [];
    });
  return pendientesDe(sesion.cargo, sesion.usuarioId, tickets);
});
