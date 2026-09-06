/**
 * Ficha de jugador — /jugadores/[jugadorId].
 *
 * La demo abre la ficha en el panel lateral (`.panel`); acá se sirve como ruta propia con
 * SSR (enlace directo, back del navegador, buena para el buscador ⌘K más adelante). El
 * panel lateral con velo/animación/foco es una sesión aparte.
 *
 * `[jugadorId]` es el UUID de `jugadores.id` (consistente con cómo el resto del código
 * referencia jugadores). Trae la ficha, la temporada en curso, los próximos partidos del
 * jugador y sus hitos (mismo motor que la vista `partidos`).
 */
import { notFound } from 'next/navigation';
import { DateTime } from 'luxon';
import { FichaJugador } from '@/components/jugadores/FichaJugador';
import { calcularHitos, ordenarHitos } from '@/lib/motor-hitos';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import { RepositorioHitosSupabase } from '@/lib/repositorios/repositorio-hitos';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

const MAXIMO_PROXIMOS = 5;

export default async function FichaJugadorPage({ params }: { params: { jugadorId: string } }) {
  const supabase = crearClienteServidor();
  const jugador = await new RepositorioJugadoresSupabase(supabase).obtener(params.jugadorId);
  if (!jugador) notFound();

  const repositorioHitos = new RepositorioHitosSupabase(supabase);
  const [temporada, proximos, jugadoresBasicos, totales, escalas] = await Promise.all([
    new RepositorioJugadoresSupabase(supabase).temporadaActual(jugador.id),
    new RepositorioPartidosSupabase(supabase).listarPorJugador(jugador.id),
    repositorioHitos.listarJugadoresActivos(),
    repositorioHitos.listarTotales(),
    repositorioHitos.listarEscalasActivas(),
  ]);

  const totalesPorJugador = new Map(totales.map((t) => [t.jugadorId, t]));
  const hitos = ordenarHitos(
    calcularHitos(
      jugadoresBasicos.filter((j) => j.id === jugador.id),
      totalesPorJugador,
      escalas,
      new Map([[jugador.id, proximos]]),
    ),
  );

  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';

  return (
    <section className="vista on" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Ficha del
          <br />
          <em>jugador</em>
        </h1>
        <p className="sub">{jugador.apodo ?? jugador.nombre}</p>
      </div>

      <FichaJugador
        jugador={jugador}
        temporada={temporada}
        hitos={hitos}
        proximos={proximos.slice(0, MAXIMO_PROXIMOS)}
        hoyUy={hoyUy}
      />
    </section>
  );
}
