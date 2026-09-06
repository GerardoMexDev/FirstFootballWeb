/**
 * Búsqueda del modal ⌘K: filtra en el cliente sobre el plantel y los próximos partidos
 * (precargados al abrir el modal) — mismo criterio que `buscar()` de la demo.
 *
 * Puro y determinista: recibe los arrays ya traídos, no hace fetch ni usa `now()`. El
 * formato de cada fila (fecha legible, hora) lo pone el componente, que sí conoce "hoy".
 *
 * Match sin distinción de acentos ni mayúsculas. Campos indexados:
 *  - jugador: nombre, apodo, club, posición, país del club, nacionalidad.
 *  - partido: club, rival, competencia (nombre y código), estadio, ciudad.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import type { JugadorPlantel, PartidoProximo } from '@/lib/repositorios/tipos';

/** Sin acentos, sin mayúsculas, sin espacios de más. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas diacríticas combinantes (acentos, diéresis)
    .toLowerCase()
    .trim();
}

/** ¿Alguno de los campos contiene la consulta ya normalizada? */
function coincide(consultaNorm: string, campos: Array<string | null | undefined>): boolean {
  return campos.some((c) => c && normalizar(c).includes(consultaNorm));
}

export interface ResultadosBusqueda {
  jugadores: JugadorPlantel[];
  /** Deduplicados por `partidoId` (la vista trae una fila por representado). */
  partidos: PartidoProximo[];
  /** true si la consulta estaba vacía → `partidos` son "los próximos", no un match. */
  vacia: boolean;
}

const MAXIMO_PARTIDOS = 8;
const PROXIMOS_SIN_CONSULTA = 5;

/** Deduplica una lista de filas de partido por `partidoId`, conservando el orden. */
function dedupPartidos(partidos: PartidoProximo[]): PartidoProximo[] {
  const vistos = new Set<string>();
  const salida: PartidoProximo[] = [];
  for (const p of partidos) {
    if (vistos.has(p.partidoId)) continue;
    vistos.add(p.partidoId);
    salida.push(p);
  }
  return salida;
}

export function buscar(
  consulta: string,
  jugadores: JugadorPlantel[],
  partidos: PartidoProximo[],
): ResultadosBusqueda {
  const q = normalizar(consulta);

  if (!q) {
    return {
      jugadores: [],
      partidos: dedupPartidos(partidos).slice(0, PROXIMOS_SIN_CONSULTA),
      vacia: true,
    };
  }

  const jugadoresMatch = jugadores.filter((j) =>
    coincide(q, [j.nombre, j.apodo, j.clubNombre, j.posicion, j.clubPais, j.nacionalidad]),
  );

  const partidosMatch = dedupPartidos(
    partidos.filter((p) =>
      coincide(q, [
        p.clubNombre,
        p.rivalNombre,
        p.competenciaNombre,
        p.competenciaCodigo,
        p.estadio,
        p.ciudad,
      ]),
    ),
  ).slice(0, MAXIMO_PARTIDOS);

  return { jugadores: jugadoresMatch, partidos: partidosMatch, vacia: false };
}
