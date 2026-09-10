/**
 * Vista `calendario-general` — servicio "Contenido" de la agencia. Mismo layout que
 * Match Day (Fechas señaladas + franja de densidad + grilla del mes), pero alimentada por
 * la vista `agenda_contenido`: cumpleaños, aniversario de fundación de club, aniversario del
 * debut en selección y aniversario del debut profesional, para el roster `servicio_contenido`
 * (12 jugadores). Sin partidos.
 *
 * El server trae TODOS los eventos de la ventana de proyección ([-1, +2] años) y
 * `<Calendario>` (Client) navega meses sin volver a pedir nada.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { DateTime } from 'luxon';
import { NotasAgenda } from '@/components/agenda/NotasAgenda';
import { Calendario } from '@/components/calendario/Calendario';
import { notasProximas, FUENTES_CONTENIDO } from '@/lib/agenda/notas-proximas';
import { RepositorioAgendaSupabase } from '@/lib/repositorios/repositorio-agenda';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';

export default async function PaginaCalendarioGeneral() {
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  const anio = Number(hoyUy.slice(0, 4));

  const repo = new RepositorioAgendaSupabase(crearClienteServidor(), 'agenda_contenido');
  const [eventosNota, eventos] = await Promise.all([
    repo.listarEventosParaNotas(hoyUy),
    repo.listarEventos(`${anio - 1}-01-01`, `${anio + 2}-12-31`),
  ]);
  const notas = notasProximas(eventosNota, hoyUy, { fuentes: FUENTES_CONTENIDO });

  return (
    <section className="vista on" id="v-calendario-general" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Calendario
          <br />
          <em>general</em>
        </h1>
        <p className="sub">
          Cumpleaños y aniversarios de club, de debut en selección y de debut profesional de
          todos los representados con servicio de contenido. Las fechas se repiten cada año.
        </p>
      </div>

      <NotasAgenda notas={notas} />

      <Calendario eventos={eventos} hoyUy={hoyUy} />
    </section>
  );
}
