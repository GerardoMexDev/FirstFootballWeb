/**
 * Reglas de negocio puras sobre `PartidoProximo[]` — sin JSX, sin fetch. Mismo criterio que
 * la demo (`peso`, `filtrar`, agrupar por día), pero basado en `diaUy` (ya calculado por la
 * vista `proximos_partidos` en zona de Uruguay) en vez de aritmética sobre `new Date()`.
 */
import { diasDesdeHoyUy } from '@/lib/fechas/zonas';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export type FiltroPartidos = 'todos' | 'hoy' | 'semana' | 'int' | 'hito';

/** ¿Es hoy, en zona de Uruguay? */
export function esHoyUy(p: PartidoProximo): boolean {
  return p.diaUy !== null && diasDesdeHoyUy(p.diaUy) === 0;
}

/**
 * "Peso" del partido para decidir qué tan grande se muestra la tarjeta (mismo criterio
 * que la demo: los internacionales pesan más). El motor de hitos sumará peso extra cuando
 * exista (hoy no se puede: `escalas_hito` todavía no se conecta acá).
 */
export function pesoPartido(p: PartidoProximo): number {
  return (p.esInternacional ? 2 : 0) + 1;
}

/** Clase modificadora de tamaño de la tarjeta `.match`, igual que `claseP()` en la demo. */
export function claseTarjeta(p: PartidoProximo): string {
  return pesoPartido(p) >= 3 ? 'match--md' : '';
}

/**
 * Filtra la lista según el chip activo. "hito" queda sin resultados hasta que exista el
 * motor de hitos (lib/motor-hitos, sesión aparte) — el chip se deshabilita en la UI mientras
 * tanto, así que no debería llegar a usarse, pero no inventa datos si llegara a pasar.
 */
export function filtrarPartidos(lista: PartidoProximo[], filtro: FiltroPartidos): PartidoProximo[] {
  switch (filtro) {
    case 'hoy':
      return lista.filter(esHoyUy);
    case 'semana':
      return lista.filter((p) => p.diaUy !== null && diasDesdeHoyUy(p.diaUy) < 7);
    case 'int':
      return lista.filter((p) => p.esInternacional);
    case 'hito':
      return [];
    case 'todos':
    default:
      return lista;
  }
}

/** Agrupa por `diaUy`, preservando el orden (la lista ya viene ordenada por `inicioUtc`). */
export function agruparPorDia(lista: PartidoProximo[]): Array<[string, PartidoProximo[]]> {
  const grupos = new Map<string, PartidoProximo[]>();
  for (const p of lista) {
    const clave = p.diaUy ?? 'sin-fecha';
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(p);
    else grupos.set(clave, [p]);
  }
  return [...grupos.entries()];
}
