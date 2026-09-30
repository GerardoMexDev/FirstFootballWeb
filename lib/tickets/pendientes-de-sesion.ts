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
import { DateTime } from 'luxon';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { pendientesDe } from '@/lib/tickets/permisos';
import { esUrgenteHoy } from '@/lib/tickets/pantalla';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export const pendientesDeSesion = cache(async (): Promise<ResumenTicket[]> => {
  const sesion = await sesionActual();
  if (!sesion || sesion.cargo === 'Prueba') return [];
  const repo = new RepositorioTicketsSupabase(crearClienteServidor());
  const hoy = DateTime.now().setZone(ZONA_AGENCIA);
  const hoyUy = hoy.toISODate() ?? '';
  // Manuales abiertos + automáticos de Match Day de la ventana donde algo puede estar vencido o por
  // vencer (un mes para atrás, un mes para adelante). Si una lectura falla, sigue con la otra.
  const [manuales, automaticos] = await Promise.all([
    repo.listarPendientes().catch((e) => {
      console.error('tickets (pendientes de sesión):', e);
      return [] as ResumenTicket[];
    }),
    repo.listarMatchDay(hoy.minus({ days: 30 }).toISODate() ?? hoyUy, hoy.plus({ days: 30 }).toISODate() ?? hoyUy).catch((e) => {
      console.error('match day (pendientes de sesión):', e);
      return [] as ResumenTicket[];
    }),
  ]);
  return pendientesDe(sesion.cargo, sesion.usuarioId, [...manuales, ...automaticos], esUrgenteHoy(hoyUy));
});
