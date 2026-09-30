/**
 * Vista `tickets` (spec 2026-09-29-pantalla-tickets.md): lo que está en marcha, del más nuevo
 * al más viejo, con contadores de urgencia. Server Component: una sola lectura (abiertos +
 * cerrados de los últimos 60 días) y el filtro por cargo; la parte interactiva es
 * `SeccionTickets`. "Prueba" no tiene esta vista: se lo manda a /partidos.
 *
 * Football First. Creado 2026-09-29.
 */
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { SeccionTickets } from '@/components/tickets/SeccionTickets';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ordenarPantalla, visiblesPara } from '@/lib/tickets/pantalla';
import type { ResumenTicket } from '@/lib/tickets/tipos';

/** Cerrados más viejos que esto no se traen (spec §3). */
const DIAS_CERRADOS = 60;

export default async function PaginaTickets() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (sesion.cargo === 'Prueba') redirect('/partidos');

  const ahora = DateTime.now().setZone(ZONA_AGENCIA);
  const hoyUy = ahora.toISODate() ?? '';
  const desde = ahora.minus({ days: DIAS_CERRADOS }).toISODate() ?? '';

  let tickets: ResumenTicket[] | null = null;
  try {
    const repo = new RepositorioTicketsSupabase(crearClienteServidor());
    // Manuales (abiertos + cerrados de 60 días) y automáticos de Match Day (0030): de 60 días
    // atrás a todo lo que viene. Si los automáticos fallan, se muestran los manuales igual.
    const [manuales, automaticos] = await Promise.all([
      repo.listarParaPantalla(desde),
      repo.listarMatchDay(desde, ahora.plus({ days: 300 }).toISODate() ?? hoyUy).catch((e) => {
        console.error('match day (pantalla tickets):', e);
        return [] as ResumenTicket[];
      }),
    ]);
    tickets = ordenarPantalla([...manuales, ...automaticos]);
  } catch (e) {
    console.error('tickets (pantalla):', e);
  }

  return (
    <section className="vista on" id="v-tickets" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">Tickets</h1>
        <p className="sub">Primero lo que vence antes; después lo completado.</p>
      </div>

      {tickets === null ? (
        <EstadoSinDatos>No pudimos cargar los tickets. Recargá la página.</EstadoSinDatos>
      ) : (
        <SeccionTickets
          tickets={visiblesPara(sesion.cargo, sesion.usuarioId, tickets)}
          cargo={sesion.cargo}
          usuarioId={sesion.usuarioId}
          hoyUy={hoyUy}
          ahoraIso={new Date().toISOString()}
        />
      )}
    </section>
  );
}
