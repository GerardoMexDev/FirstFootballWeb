/**
 * Filtros + lista: vive como Client Component para que el chip filtre sin ir al servidor
 * (mismo criterio que la demo — con ~30 partidos/mes filtrar en el cliente es gratis).
 * Los partidos ya llegan traídos por el Server Component `PaginaPartidos`.
 */
'use client';

import { useMemo, useState } from 'react';
import { BarraFiltros } from '@/components/partidos/BarraFiltros';
import { ListaPartidos } from '@/components/partidos/ListaPartidos';
import { filtrarPartidos, type FiltroPartidos } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function SeccionPartidos({ partidos }: { partidos: PartidoProximo[] }) {
  const [filtro, setFiltro] = useState<FiltroPartidos>('todos');
  const filtrados = useMemo(() => filtrarPartidos(partidos, filtro), [partidos, filtro]);

  return (
    <>
      <BarraFiltros filtro={filtro} onCambiar={setFiltro} cantidad={filtrados.length} />
      <div id="lista">
        <ListaPartidos partidos={filtrados} />
      </div>
    </>
  );
}
