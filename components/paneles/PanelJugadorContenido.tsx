/**
 * Cuerpo del panel lateral para un jugador del servicio "Contenido": envuelve
 * `FichaContenido` con el bundle de `/api/paneles/jugador-contenido`, más el bloque
 * "Tickets de diseño" (0028).
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { FichaContenido } from '@/components/jugadores/FichaContenido';
import { SuspenderJugador } from '@/components/jugadores/SuspenderJugador';
import { TicketsJugador } from '@/components/tickets/TicketsJugador';
import type { FichaContenidoBundle } from '@/lib/jugadores/cargar-ficha-contenido';

export function PanelJugadorContenido({
  bundle,
  destacar,
}: {
  bundle: FichaContenidoBundle;
  destacar?: string | null;
}) {
  return (
    <FichaContenido
      jugador={bundle.jugador}
      proximas={bundle.proximas}
      hoyUy={bundle.hoyUy}
      destacar={destacar}
      tickets={
        <>
          <TicketsJugador jugadorId={bundle.jugador.id} jugadorNombre={bundle.jugador.nombre} datos={bundle.ticketsJugador} />
          {/* 0049: Admin y CM suspenden desde la ficha; se reactiva en la sección "Suspendidos". */}
          <SuspenderJugador jugadorId={bundle.jugador.id} jugadorNombre={bundle.jugador.nombre} cargo={bundle.ticketsJugador.usuario?.cargo} />
        </>
      }
    />
  );
}
