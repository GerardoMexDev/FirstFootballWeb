/**
 * Filtros + lista: vive como Client Component para que el chip filtre sin ir al servidor
 * (mismo criterio que la demo — con ~30 partidos/mes filtrar en el cliente es gratis).
 * Desde 2026-09-28 también las fechas de Contenido: cada chip filtra partidos y fechas
 * (`filtrarPartidos` + `filtrarFechas`), y "Fechas" muestra solo las fechas.
 * Desde 2026-09-29: "Match Day" = solo partidos; "Contenido" = fechas + partidos de los
 * jugadores solo-Contenido (`partidosContenido`, vista 0027). Esas tarjetas no abren panel
 * ni muestran Dropbox: el panel del partido y los tickets son de Match Day.
 * Desde 2026-09-30: "Selección" = partidos de la selección uruguaya (`partidosSeleccion`, vista
 * 0031), que también se suman a "Todos" (`listaSegunFiltro`). No abren panel.
 * Los partidos y los hitos ya llegan traídos por el Server Component `PaginaPartidos`.
 */
'use client';

import { useMemo, useState } from 'react';
import { BarraFiltros } from '@/components/partidos/BarraFiltros';
import { ListaPartidos } from '@/components/partidos/ListaPartidos';
import { usePanel } from '@/lib/paneles/use-panel';
import { filtrarPartidos, type FiltroPartidos } from '@/lib/partidos/utilidades';
import { listaSegunFiltro } from '@/lib/partidos/seleccion';
import type { DatosConvocatoria } from '@/components/partidos/CasillasConvocatoria';
import type { PartidoProximo } from '@/lib/repositorios/tipos';
import type { EstadoVisual } from '@/lib/tickets/tipos';
import type { LinksDropbox } from '@/lib/jugadores/links-dropbox';
import { filtrarFechas, type FechaContenido } from '@/lib/partidos/fechas-contenido';

export function SeccionPartidos({
  partidos,
  partidosContenido = [],
  partidosSeleccion = [],
  convocatoria,
  partidosConHito,
  linksDropbox,
  fechas = [],
  hoyUy,
  alertasTicket = {},
  estadosDiseno = {},
  ultimoMomento = {},
}: {
  partidos: PartidoProximo[];
  /** Partidos de jugadores solo-Contenido: se ven únicamente con el filtro "Contenido". */
  partidosContenido?: PartidoProximo[];
  /** Partidos de la selección uruguaya (0031): filtros Selección y Todos. */
  partidosSeleccion?: PartidoProximo[];
  /** Convocatoria a la selección (0032). */
  convocatoria?: DatosConvocatoria;
  partidosConHito: Set<string>;
  linksDropbox?: Record<string, LinksDropbox>;
  /** Fechas de Contenido de la ventana de la lista (ya normalizadas). */
  fechas?: FechaContenido[];
  /** YYYY-MM-DD en Uruguay, para los filtros Hoy / Esta semana de las fechas. */
  hoyUy: string;
  /** `{ partidoId: texto }` de la lucecita de ticket del usuario (`alertasPorPartido`). */
  alertasTicket?: Record<string, string>;
  /** `{ '<partido>:<jugador>': estado }` del semáforo de diseño (0030). */
  estadosDiseno?: Record<string, EstadoVisual>;
  /** `partido:jugador` de los Match Day de último momento (0040). */
  ultimoMomento?: Record<string, true>;
}) {
  const [filtro, setFiltro] = useState<FiltroPartidos>('todos');
  const { abrir } = usePanel();
  const esContenido = filtro === 'contenido';
  const filtrados = useMemo(
    () =>
      listaSegunFiltro(filtro, { partidos, contenido: partidosContenido, seleccion: partidosSeleccion }, (l) =>
        filtrarPartidos(l, filtro, partidosConHito),
      ),
    [filtro, partidos, partidosContenido, partidosSeleccion, partidosConHito],
  );
  const fechasFiltradas = useMemo(() => filtrarFechas(fechas, filtro, hoyUy), [fechas, filtro, hoyUy]);

  return (
    <>
      <BarraFiltros filtro={filtro} onCambiar={setFiltro} cantidad={filtrados.length} cantidadFechas={fechasFiltradas.length} />
      <div id="lista">
        <ListaPartidos
          partidos={filtrados}
          partidosConHito={partidosConHito}
          onAbrirPartido={esContenido ? undefined : (partidoId) => abrir('partido', partidoId)}
          linksDropbox={esContenido ? undefined : linksDropbox}
          fechas={fechasFiltradas}
          alertasTicket={esContenido ? {} : alertasTicket}
          estadosDiseno={esContenido ? {} : estadosDiseno}
          ultimoMomento={esContenido ? {} : ultimoMomento}
          convocatoria={convocatoria}
        />
      </div>
    </>
  );
}
