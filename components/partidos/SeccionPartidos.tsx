/**
 * Filtros + lista: vive como Client Component para que el chip filtre sin ir al servidor
 * (mismo criterio que la demo — con ~30 partidos/mes filtrar en el cliente es gratis).
 * Desde 2026-09-28 también las fechas de Contenido: cada chip filtra partidos y fechas
 * (`filtrarPartidos` + `filtrarFechas`), y "Fechas" muestra solo las fechas.
 * Desde 2026-09-29: "Match Day" = solo partidos; "Contenido" = fechas + partidos de los
 * jugadores solo-Contenido (`partidosContenido`, vista 0027). Esas tarjetas no abren panel
 * ni muestran Dropbox: el panel del partido y los tickets son de Match Day.
 * Los partidos y los hitos ya llegan traídos por el Server Component `PaginaPartidos`.
 */
'use client';

import { useMemo, useState } from 'react';
import { BarraFiltros } from '@/components/partidos/BarraFiltros';
import { ListaPartidos } from '@/components/partidos/ListaPartidos';
import { usePanel } from '@/lib/paneles/use-panel';
import { filtrarPartidos, type FiltroPartidos } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';
import type { LinksDropbox } from '@/lib/jugadores/links-dropbox';
import { filtrarFechas, type FechaContenido } from '@/lib/partidos/fechas-contenido';

export function SeccionPartidos({
  partidos,
  partidosContenido = [],
  partidosConHito,
  linksDropbox,
  fechas = [],
  hoyUy,
  alertasTicket = {},
}: {
  partidos: PartidoProximo[];
  /** Partidos de jugadores solo-Contenido: se ven únicamente con el filtro "Contenido". */
  partidosContenido?: PartidoProximo[];
  partidosConHito: Set<string>;
  linksDropbox?: Record<string, LinksDropbox>;
  /** Fechas de Contenido de la ventana de la lista (ya normalizadas). */
  fechas?: FechaContenido[];
  /** YYYY-MM-DD en Uruguay, para los filtros Hoy / Esta semana de las fechas. */
  hoyUy: string;
  /** `{ partidoId: texto }` de la lucecita de ticket del usuario (`alertasPorPartido`). */
  alertasTicket?: Record<string, string>;
}) {
  const [filtro, setFiltro] = useState<FiltroPartidos>('todos');
  const { abrir } = usePanel();
  const esContenido = filtro === 'contenido';
  const filtrados = useMemo(
    () => (esContenido ? partidosContenido : filtrarPartidos(partidos, filtro, partidosConHito)),
    [esContenido, partidosContenido, partidos, filtro, partidosConHito],
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
        />
      </div>
    </>
  );
}
