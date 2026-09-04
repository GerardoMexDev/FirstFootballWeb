/**
 * Vista `partidos` — hero del partido del día, KPIs, filtros y lista agrupada por día,
 * todo sobre la vista `proximos_partidos` (Supabase). Server Component: la trae en el
 * servidor, la sección de filtros vive en un Client Component aparte (SeccionPartidos)
 * para poder filtrar sin ir al servidor.
 *
 * "Se vienen los hitos" queda pendiente (lib/motor-hitos, sesión aparte): no se fabrica
 * una sección vacía en su lugar.
 */
import { DateTime } from 'luxon';
import { HeroPartidoDelDia } from '@/components/partidos/HeroPartidoDelDia';
import { TarjetasKpi } from '@/components/partidos/TarjetasKpi';
import { SeccionPartidos } from '@/components/partidos/SeccionPartidos';
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

      <HeroPartidoDelDia partidos={partidos} />
      <TarjetasKpi partidos={partidos} />
      <SeccionPartidos partidos={partidos} />
    </section>
  );
}
