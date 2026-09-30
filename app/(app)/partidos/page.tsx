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
import { NotasAgenda } from '@/components/agenda/NotasAgenda';
import { calcularHitos, ordenarHitos, partidosConHito } from '@/lib/motor-hitos';
import { notasProximas } from '@/lib/agenda/notas-proximas';
import { agruparPorJugador } from '@/lib/partidos/utilidades';
import { RepositorioHitosSupabase } from '@/lib/repositorios/repositorio-hitos';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import { RepositorioAgendaSupabase } from '@/lib/repositorios/repositorio-agenda';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { hastaFechas } from '@/lib/partidos/fechas-contenido';
import { pendientesDeSesion } from '@/lib/tickets/pendientes-de-sesion';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { RepositorioTicketsSupabase, type TicketAutomatico } from '@/lib/repositorios/repositorio-tickets';
import { estadosPorPartidoJugador } from '@/lib/tickets/semaforo';
import { alertasPorTarjeta } from '@/lib/tickets/estados';

export default async function PaginaPartidos() {
  // Fecha de hoy en hora de Uruguay (lo que la demo pone en #fecha-hoy).
  const fechaLarga = DateTime.now()
    .setZone(ZONA_AGENCIA)
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL 'de' yyyy");
  const fechaHoy = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);
  // Día de hoy en Uruguay (YYYY-MM-DD) para la ventana de "Fechas señaladas".
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';

  const supabase = crearClienteServidor();
  const repositorioPartidos = new RepositorioPartidosSupabase(supabase);
  const partidos = await repositorioPartidos.listarProximos();

  const repositorioHitos = new RepositorioHitosSupabase(supabase);
  const repositorioAgenda = new RepositorioAgendaSupabase(supabase);
  const [jugadores, totales, escalas, eventosAgenda, linksDropbox, fechasContenido, pendientes, matchDay, partidosContenido, partidosSeleccion, convocatoria, sesion] = await Promise.all([
    repositorioHitos.listarJugadoresActivos(),
    repositorioHitos.listarTotales(),
    repositorioHitos.listarEscalasActivas(),
    repositorioAgenda.listarEventosParaNotas(hoyUy),
    new RepositorioJugadoresSupabase(supabase).listarLinksDropbox(),
    // Fechas de Contenido para mezclar en la lista: de hoy al último partido cargado.
    repositorioAgenda.listarFechasContenido(hoyUy, hastaFechas(partidos, hoyUy)),
    // Lo que le toca al usuario (misma lectura que el contador de la barra, cacheada).
    pendientesDeSesion(),
    // Semáforo de diseño por partido y jugador (0030). Si falla, las tarjetas se ven sin pastilla.
    new RepositorioTicketsSupabase(supabase).listarMatchDay(hoyUy, hastaFechas(partidos, hoyUy)).catch((e) => {
      console.error('match day (partidos):', e);
      return [] as TicketAutomatico[];
    }),
    // Partidos de jugadores solo-Contenido (filtro "Contenido"). Si falla, el filtro queda
    // solo con las fechas y el resto de la página no se entera.
    repositorioPartidos.listarProximosContenido().catch((e) => {
      console.error('partidos de Contenido:', e);
      return [];
    }),
    // Partidos de la selección uruguaya (0031). Si falla, Selección/Todos siguen sin ellos.
    repositorioPartidos.listarProximosSeleccion().catch((e) => {
      console.error('partidos de la selección:', e);
      return [];
    }),
    // Convocatoria a la selección (0032). Si falla, las tarjetas de Uruguay van sin casillas.
    repositorioPartidos.listarConvocatoria().catch((e) => {
      console.error('convocatoria (partidos):', e);
      return { convocables: [], convocados: {} };
    }),
    sesionActual(),
  ]);
  const totalesPorJugador = new Map(totales.map((t) => [t.jugadorId, t]));
  const hitos = ordenarHitos(
    calcularHitos(jugadores, totalesPorJugador, escalas, agruparPorJugador(partidos)),
  );
  const notas = notasProximas(eventosAgenda, hoyUy);

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

      <HeroPartidoDelDia partidos={partidos} hitos={hitos} linksDropbox={linksDropbox} />
      <TarjetasKpi partidos={partidos} cantidadHitos={hitos.length} />
      <SeccionHitos hitos={hitos} />
      <NotasAgenda notas={notas} />
      <SeccionPartidos
        partidos={partidos}
        partidosContenido={partidosContenido}
        partidosSeleccion={partidosSeleccion}
        convocatoria={{
          ...convocatoria,
          puedeMarcar: sesion?.cargo === 'Administrador' || sesion?.cargo === 'Community Manager',
        }}
        partidosConHito={partidosConHito(hitos)}
        linksDropbox={linksDropbox}
        fechas={fechasContenido}
        hoyUy={hoyUy}
        alertasTicket={alertasPorTarjeta(pendientes, hoyUy)}
        estadosDiseno={estadosPorPartidoJugador(matchDay, hoyUy)}
      />
    </section>
  );
}
