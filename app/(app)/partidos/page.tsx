/**
 * Vista `partidos` — hero del partido del día, KPIs, "se vienen los hitos", filtros y
 * lista agrupada por día. Server Component: trae partidos (`proximos_partidos`) e hitos
 * (`lib/motor-hitos`) en el servidor; la sección de filtros vive en un Client Component
 * aparte (`SeccionPartidos`) para poder filtrar sin ir al servidor.
 */
import { DateTime } from 'luxon';
import { HeroPartidoDelDia } from '@/components/partidos/HeroPartidoDelDia';
import { TarjetasKpi } from '@/components/partidos/TarjetasKpi';
import { SeccionHitos } from '@/components/partidos/SeccionHitos';
import { SeccionPartidos } from '@/components/partidos/SeccionPartidos';
import { calcularHitos, ordenarHitos, partidosConHito } from '@/lib/motor-hitos';
import { agruparPorJugador } from '@/lib/partidos/utilidades';
import { RepositorioHitosSupabase } from '@/lib/repositorios/repositorio-hitos';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';

export default async function PaginaPartidos() {
  // Fecha de hoy en hora de Uruguay (lo que la demo pone en #fecha-hoy).
  const hoyUy = DateTime.now()
    .setZone(ZONA_AGENCIA)
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL 'de' yyyy");
  const fechaHoy = hoyUy.charAt(0).toUpperCase() + hoyUy.slice(1);

  const supabase = crearClienteServidor();
  const partidos = await new RepositorioPartidosSupabase(supabase).listarProximos();

  const repositorioHitos = new RepositorioHitosSupabase(supabase);
  const [jugadores, totales, escalas] = await Promise.all([
    repositorioHitos.listarJugadoresActivos(),
    repositorioHitos.listarTotales(),
    repositorioHitos.listarEscalasActivas(),
  ]);
  const totalesPorJugador = new Map(totales.map((t) => [t.jugadorId, t]));
  const hitos = ordenarHitos(
    calcularHitos(jugadores, totalesPorJugador, escalas, agruparPorJugador(partidos)),
  );

  return (
    <section className="vista on" id="v-partidos" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Próximos
          <br />
          <em>partidos</em>
        </h1>
        <p className="sub" id="fecha-hoy">
          {fechaHoy}
        </p>
      </div>

      <HeroPartidoDelDia partidos={partidos} hitos={hitos} />
      <TarjetasKpi partidos={partidos} cantidadHitos={hitos.length} />
      <SeccionHitos hitos={hitos} />
      <SeccionPartidos partidos={partidos} partidosConHito={partidosConHito(hitos)} />
    </section>
  );
}
