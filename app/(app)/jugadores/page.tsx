/**
 * Vista `jugadores` — grilla del plantel conectada a la tabla `jugadores` (+ `clubes` y
 * `totales_jugador`). Server Component: trae el plantel y calcula, con el mismo motor de
 * hitos que la vista `partidos`, la frase del hito más próximo de cada jugador para la pill
 * de la tarjeta. La navegación a la ficha vive en el Client Component `GrillaPlantel`.
 */
import { GrillaPlantel } from '@/components/jugadores/GrillaPlantel';
import { calcularHitos, ordenarHitos } from '@/lib/motor-hitos';
import { agruparPorJugador } from '@/lib/partidos/utilidades';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import { RepositorioHitosSupabase } from '@/lib/repositorios/repositorio-hitos';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export default async function PaginaJugadores() {
  const supabase = crearClienteServidor();
  const repositorioHitos = new RepositorioHitosSupabase(supabase);

  const [jugadores, partidos, jugadoresBasicos, totales, escalas] = await Promise.all([
    new RepositorioJugadoresSupabase(supabase).listar(),
    new RepositorioPartidosSupabase(supabase).listarProximos(),
    repositorioHitos.listarJugadoresActivos(),
    repositorioHitos.listarTotales(),
    repositorioHitos.listarEscalasActivas(),
  ]);

  const totalesPorJugador = new Map(totales.map((t) => [t.jugadorId, t]));
  const hitos = ordenarHitos(
    calcularHitos(jugadoresBasicos, totalesPorJugador, escalas, agruparPorJugador(partidos)),
  );

  // id de jugador → frase del hito más próximo (el primero tras ordenar). Solo uno por tarjeta.
  const hitoFrasePorJugador: Record<string, string> = {};
  for (const hito of hitos) {
    if (!hitoFrasePorJugador[hito.jugadorId]) hitoFrasePorJugador[hito.jugadorId] = hito.frase;
  }

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

      <GrillaPlantel jugadores={jugadores} hitoFrasePorJugador={hitoFrasePorJugador} />
    </section>
  );
}
