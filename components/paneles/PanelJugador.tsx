/**
 * Cuerpo del panel de detalle de jugador: reusa `FichaJugador` tal cual (es presentacional
 * puro), con el bundle que trae `/api/paneles/jugador`. Mismo contenido que la ruta
 * `/jugadores/[id]`, más el bloque "Tickets de diseño" (0028), que solo va en el panel.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { FichaJugador } from '@/components/jugadores/FichaJugador';
import { TicketsJugador } from '@/components/tickets/TicketsJugador';
import type { FichaJugadorBundle } from '@/lib/jugadores/cargar-ficha';

export function PanelJugador({ bundle, destacar }: { bundle: FichaJugadorBundle; destacar?: string | null }) {
  return (
    <FichaJugador
      jugador={bundle.jugador}
      temporada={bundle.temporada}
      hitos={bundle.hitos}
      proximos={bundle.proximos}
      hoyUy={bundle.hoyUy}
      destacar={destacar}
      tickets={<TicketsJugador jugadorId={bundle.jugador.id} jugadorNombre={bundle.jugador.nombre} datos={bundle.ticketsJugador} />}
    />
  );
}
