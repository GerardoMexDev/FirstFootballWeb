/**
 * Listas de /partidos con la selección uruguaya (0031). Puro, solo imports de tipo (testeable
 * con `node --test`, que no resuelve el alias `@/` en imports de valor).
 *
 * Football First. Creado 2026-09-30.
 */
import type { FiltroPartidos } from './utilidades.ts';
import type { PartidoProximo } from '../repositorios/tipos.ts';

/**
 * Todos = Match Day + selección (0031), por fecha. Si un partido de Uruguay ya está en Match Day
 * (un representado convocado, 0032: es el MISMO partido), se muestra una sola vez — gana el de
 * Match Day, que es el que tiene ticket.
 */
export function unirConSeleccion(md: PartidoProximo[], sel: PartidoProximo[]): PartidoProximo[] {
  const enMatchDay = new Set(md.map((p) => p.partidoId));
  const extra = sel.filter((p) => !enMatchDay.has(p.partidoId));
  const clave = (p: PartidoProximo) => p.inicioUtc ?? '9999';
  return [...md, ...extra].sort((a, b) => clave(a).localeCompare(clave(b)));
}

/** Qué lista mostrar según el filtro de /partidos (Contenido y Selección vienen de otras vistas). */
export function listaSegunFiltro(
  filtro: FiltroPartidos,
  listas: { partidos: PartidoProximo[]; contenido: PartidoProximo[]; seleccion: PartidoProximo[] },
  /** Filtro del resto (Match Day, Hoy, Semana…): en la app, `filtrarPartidos(l, filtro, conHito)`. */
  filtrarResto: (lista: PartidoProximo[]) => PartidoProximo[],
): PartidoProximo[] {
  if (filtro === 'contenido') return listas.contenido;
  if (filtro === 'seleccion') return listas.seleccion;
  if (filtro === 'todos') return unirConSeleccion(listas.partidos, listas.seleccion);
  return filtrarResto(listas.partidos);
}
