/**
 * Ficha de jugador — /jugadores/[jugadorId].
 *
 * ANDAMIAJE: la demo abre la ficha en el panel lateral (`.panel`). Acá se deja además
 * una ruta propia para enlace directo y SSR. El contenido (hitos, temporada, carrera,
 * datos para contenido, próximos partidos) se arma con `proximos_partidos`, `jugadores`,
 * `estadisticas_partido` y el motor de hitos en una sesión siguiente.
 */
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';

export default function FichaJugador({ params }: { params: { jugadorId: string } }) {
  return (
    <section className="vista on" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Ficha del
          <br />
          <em>jugador</em>
        </h1>
        <p className="sub">
          Jugador <code>{params.jugadorId}</code>. Pendiente conectar los datos.
        </p>
      </div>

      <EstadoSinDatos>
        Acá van hitos por alcanzar, temporada actual, carrera, selección, datos para contenido y
        próximos partidos.
      </EstadoSinDatos>
    </section>
  );
}
