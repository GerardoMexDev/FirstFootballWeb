/**
 * Vista `calendario` — "Fechas señaladas" (notas de 7-10 días) + franja de densidad anual +
 * grilla del mes con los eventos de `agenda_anual`.
 *
 * El server trae TODOS los eventos de la ventana de proyección de la vista ([-1, +2] años)
 * de una sola vez y `<Calendario>` (Client) navega meses/años sin volver a pedir nada.
 */
import { DateTime } from 'luxon';
import { NotasAgenda } from '@/components/agenda/NotasAgenda';
import { Calendario } from '@/components/calendario/Calendario';
import { notasProximas } from '@/lib/agenda/notas-proximas';
import { RepositorioAgendaSupabase } from '@/lib/repositorios/repositorio-agenda';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';

export default async function PaginaCalendario() {
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  const anio = Number(hoyUy.slice(0, 4));

  const repo = new RepositorioAgendaSupabase(crearClienteServidor());
  const [eventosNota, eventos] = await Promise.all([
    repo.listarEventosParaNotas(hoyUy),
    // Misma ventana que proyecta agenda_anual (cumpleaños/aniversarios): [-1, +2] años.
    repo.listarEventos(`${anio - 1}-01-01`, `${anio + 2}-12-31`),
  ]);
  const notas = notasProximas(eventosNota, hoyUy);

  return (
    <section className="vista on" id="v-calendario" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Calendario
          <br />
          <em>anual</em>
        </h1>
        <p className="sub">
          Densidad por mes. Las fechas a más de 90 días son tentativas: el fixture se confirma por
          semestre y los horarios los mueve la TV.
        </p>
      </div>

      <NotasAgenda notas={notas} />

      <Calendario eventos={eventos} hoyUy={hoyUy} />
    </section>
  );
}
