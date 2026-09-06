/**
 * Filtros + lista: vive como Client Component para que el chip filtre sin ir al servidor
 * (mismo criterio que la demo — con ~30 partidos/mes filtrar en el cliente es gratis).
 * Los partidos y los hitos ya llegan traídos por el Server Component `PaginaPartidos`.
 */
'use client';

import { useMemo, useState } from 'react';
import { BarraFiltros } from '@/components/partidos/BarraFiltros';
import { ListaPartidos } from '@/components/partidos/ListaPartidos';
import { usePanel } from '@/lib/paneles/use-panel';
import { filtrarPartidos, type FiltroPartidos } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function SeccionPartidos({
  partidos,
  partidosConHito,
}: {
  partidos: PartidoProximo[];
  partidosConHito: Set<string>;
}) {
  const [filtro, setFiltro] = useState<FiltroPartidos>('todos');
  const { abrir } = usePanel();
  const filtrados = useMemo(
    () => filtrarPartidos(partidos, filtro, partidosConHito),
    [partidos, filtro, partidosConHito],
  );

  return (
    <>
      <BarraFiltros filtro={filtro} onCambiar={setFiltro} cantidad={filtrados.length} />
      <div id="lista">
        <ListaPartidos
          partidos={filtrados}
          partidosConHito={partidosConHito}
          onAbrirPartido={(partidoId) => abrir('partido', partidoId)}
        />
      </div>
    </>
  );
}
