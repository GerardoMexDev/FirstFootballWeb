/**
 * Cuerpo del panel de detalle de jugador: reusa `FichaJugador` tal cual (es presentacional
 * puro), con el bundle que trae `/api/paneles/jugador`. Mismo contenido que la ruta
 * `/jugadores/[id]`.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { FichaJugador } from '@/components/jugadores/FichaJugador';
import type { FichaJugadorBundle } from '@/lib/jugadores/cargar-ficha';

export function PanelJugador({ bundle }: { bundle: FichaJugadorBundle }) {
  return (
    <FichaJugador
      jugador={bundle.jugador}
      temporada={bundle.temporada}
      hitos={bundle.hitos}
      proximos={bundle.proximos}
      hoyUy={bundle.hoyUy}
    />
  );
}
