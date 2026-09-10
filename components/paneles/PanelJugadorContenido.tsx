/**
 * Cuerpo del panel lateral para un jugador del servicio "Contenido": envuelve
 * `FichaContenido` con el bundle de `/api/paneles/jugador-contenido`.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { FichaContenido } from '@/components/jugadores/FichaContenido';
import type { FichaContenidoBundle } from '@/lib/jugadores/cargar-ficha-contenido';

export function PanelJugadorContenido({ bundle }: { bundle: FichaContenidoBundle }) {
  return <FichaContenido jugador={bundle.jugador} proximas={bundle.proximas} hoyUy={bundle.hoyUy} />;
}
