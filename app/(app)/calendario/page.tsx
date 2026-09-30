/**
 * Vista `calendario` — un solo calendario con filtros Todos / Match Day / Contenido (pedido de
 * Gerardo 2026-09-30; antes eran "Match Day" y "Calendario general"). "Fechas señaladas" + franja
 * de densidad anual + grilla del mes.
 *
 * El filtro vive en la dirección (`?f=matchday|contenido`, por defecto todos): el server filtra
 * eventos y notas, y el enlace se puede compartir. Match Day = partidos/convocatorias/hitos de
 * `agenda_anual`, con el semáforo de diseño (0030); Contenido = fechas de `agenda_contenido`,
 * partidos de los jugadores solo-Contenido (0027) y tickets de fecha (0028).
 *
 * El server trae la ventana de proyección ([-1, +2] años) de una sola vez y `<Calendario>`
 * (Client) navega meses/años sin volver a pedir nada.
 */
import { DateTime } from 'luxon';
import { NotasAgenda } from '@/components/agenda/NotasAgenda';
import { Calendario } from '@/components/calendario/Calendario';
import { FUENTES_CONTENIDO, notasProximas, unirNotas } from '@/lib/agenda/notas-proximas';
import { filtrarCalendario, sumarSeleccion, unirEventos, type FiltroCalendario } from '@/lib/calendario/eventos';
import { RepositorioAgendaSupabase } from '@/lib/repositorios/repositorio-agenda';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { alertasPorPartido, alertasPorTicket, resumirPorPartido, ticketsPorDia } from '@/lib/tickets/estados';
import { estadoVisual, peorEstado } from '@/lib/tickets/semaforo';
import { pendientesDeSesion } from '@/lib/tickets/pendientes-de-sesion';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import type { EstadoVisual, ResumenTicket } from '@/lib/tickets/tipos';

const FILTROS: FiltroCalendario[] = ['todos', 'matchday', 'contenido', 'seleccion'];

export default async function PaginaCalendario({ searchParams }: { searchParams: { f?: string } }) {
  const filtro: FiltroCalendario = FILTROS.includes(searchParams.f as FiltroCalendario) ? (searchParams.f as FiltroCalendario) : 'todos';
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  const anio = Number(hoyUy.slice(0, 4));
  const desde = `${anio - 1}-01-01`;
  const hasta = `${anio + 2}-12-31`;

  const supabase = crearClienteServidor();
  const repoMd = new RepositorioAgendaSupabase(supabase);
  const repoCo = new RepositorioAgendaSupabase(supabase, 'agenda_contenido');
  const repoTk = new RepositorioTicketsSupabase(supabase);
  // Degradación elegante: lo que falle (tickets, partidos de Contenido) se ve como vacío.
  const vacio = (que: string) => (e: unknown) => {
    console.error(`${que} (calendario):`, e);
    return [];
  };
  const [notasMd, notasCo, eventosMd, eventosCo, partidosCo, partidosSel, tickets, ticketsFecha, matchDay, pendientes] = await Promise.all([
    repoMd.listarEventosParaNotas(hoyUy),
    repoCo.listarEventosParaNotas(hoyUy),
    repoMd.listarEventos(desde, hasta),
    repoCo.listarEventos(desde, hasta),
    repoCo.listarPartidosContenido(desde, hasta).catch(vacio('partidos de Contenido')),
    repoMd.listarPartidosSeleccion(desde, hasta).catch(vacio('partidos de la selección')),
    repoTk.listarParaCalendario(desde).catch(vacio('tickets')),
    repoTk.listarEventosEntre(desde, hasta).catch(vacio('tickets de fecha')),
    repoTk.listarMatchDay(desde, hasta).catch(vacio('match day')),
    pendientesDeSesion(),
  ]);

  // La selección va aparte de unirEventos (un convocado comparte refId con Match Day; ver sumarSeleccion).
  const unidos = unirEventos(eventosMd, [...eventosCo, ...partidosCo]);
  const eventos = filtrarCalendario(sumarSeleccion(unidos, partidosSel, filtro), filtro);
  const soloMd = filtro === 'matchday' || filtro === 'todos';
  const notas =
    filtro === 'seleccion'
      ? []
      : filtro === 'matchday'
        ? notasProximas(notasMd, hoyUy)
        : notasProximas(unirNotas(notasCo, notasMd), hoyUy, { fuentes: FUENTES_CONTENIDO });

  // Semáforo por partido: el peor estado entre sus jugadores (vencido > pendiente > completado).
  const porPartido: Record<string, (EstadoVisual | null)[]> = {};
  for (const t of matchDay as ResumenTicket[]) if (t.partidoId) (porPartido[t.partidoId] ??= []).push(estadoVisual(t, hoyUy));
  const estadoPorPartido: Record<string, EstadoVisual> = {};
  for (const [id, estados] of Object.entries(porPartido)) {
    const e = peorEstado(estados);
    if (e) estadoPorPartido[id] = e;
  }

  return (
    <section className="vista on" id="v-calendario" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">Calendario</h1>
        <p className="sub">
          Partidos de Match Day con su estado de diseño (rojo pendiente, verde completado, amarillo
          vencido), las fechas de Contenido y los partidos de la selección uruguaya. Las fechas a más
          de 90 días son tentativas.
        </p>
      </div>

      <NotasAgenda notas={notas} />

      <Calendario
        eventos={eventos}
        hoyUy={hoyUy}
        filtro={filtro}
        estadoPorPartido={soloMd ? estadoPorPartido : {}}
        ticketsPorPartido={soloMd ? resumirPorPartido(tickets as ResumenTicket[]) : {}}
        alertasPorPartido={soloMd ? alertasPorPartido(pendientes, hoyUy) : {}}
        ticketsPorDia={filtro === 'matchday' || filtro === 'seleccion' ? {} : ticketsPorDia(ticketsFecha as ResumenTicket[])}
        alertasPorTicket={alertasPorTicket(pendientes, hoyUy)}
      />
    </section>
  );
}
