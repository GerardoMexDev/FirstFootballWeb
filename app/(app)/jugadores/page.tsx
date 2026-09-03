/**
 * Vista `jugadores` — grilla del plantel.
 *
 * ANDAMIAJE: esqueleto con las clases de la demo. Las tarjetas (`.jug`) se generan
 * desde la tabla `jugadores` de Supabase en una sesión siguiente; clic → ficha en
 * /jugadores/[jugadorId].
 */
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';

export default function PaginaJugadores() {
  return (
    <section className="vista on" id="v-jugadores" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          El
          <br />
          <em>plantel</em>
        </h1>
        <p className="sub">
          Seis jugadores en seis ligas. Pasá el cursor para ver los números, clic para la ficha
          completa.
        </p>
      </div>

      <div className="plantel" id="plantel">
        <EstadoSinDatos>Pendiente conectar la tabla <code>jugadores</code>.</EstadoSinDatos>
      </div>
    </section>
  );
}
