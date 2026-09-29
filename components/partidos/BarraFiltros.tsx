/**
 * Chips de filtro de la vista `partidos`: `.barra`/`.chip` de la demo. Puramente controlado
 * (el estado del filtro vive en `SeccionPartidos`, el padre).
 */
'use client';

import type { FiltroPartidos } from '@/lib/partidos/utilidades';
import { textoCantidades } from '@/lib/partidos/fechas-contenido';

const FILTROS: { f: FiltroPartidos; etiqueta: string }[] = [
  { f: 'todos', etiqueta: 'Todos' },
  { f: 'hoy', etiqueta: 'Hoy' },
  { f: 'semana', etiqueta: 'Esta semana' },
  { f: 'int', etiqueta: 'Internacional' },
  { f: 'hito', etiqueta: 'Con hito' },
  { f: 'fechas', etiqueta: 'Fechas' },
];

export function BarraFiltros({
  filtro,
  onCambiar,
  cantidad,
  cantidadFechas = 0,
}: {
  filtro: FiltroPartidos;
  onCambiar: (filtro: FiltroPartidos) => void;
  cantidad: number;
  /** Fechas de Contenido visibles con el filtro actual. */
  cantidadFechas?: number;
}) {
  return (
    <div className="barra" id="filtros">
      {FILTROS.map(({ f, etiqueta }) => (
        <button
          key={f}
          className={filtro === f ? 'chip on' : 'chip'}
          data-f={f}
          onClick={() => onCambiar(f)}
        >
          {etiqueta}
        </button>
      ))}
      <span className="cuenta" id="cuenta">
        {textoCantidades(cantidad, cantidadFechas)}
      </span>
    </div>
  );
}
