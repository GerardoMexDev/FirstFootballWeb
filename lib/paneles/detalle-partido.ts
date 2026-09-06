/**
 * Pliega las filas de `proximos_partidos` de UN partido (la vista trae una fila por
 * representado involucrado) en una sola forma para el panel de detalle de partido.
 *
 * Casos que resuelve:
 *  - 1 representado: duelo = su club vs el rival, con local/visitante si se sabe (`es_local`).
 *  - 2 representados en el MISMO equipo: igual, y los dos van en "jugadores a cubrir".
 *  - 2 representados en equipos RIVALES (ej. Toluca vs Atlante): el duelo es entre sus dos
 *    clubes; `representadoEsLocal` queda `null` (no hay un "nuestro lado") y cada jugador
 *    lleva su club.
 *  - sin filas: `null`.
 *
 * Puro: no hace fetch. Recibe lo que ya trajo `RepositorioPartidosSupabase.listarPorPartido`.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export interface EquipoDuelo {
  nombre: string | null;
  escudoUrl: string | null;
}

export interface JugadorEnPartido {
  jugadorId: string;
  nombre: string;
  apodo: string | null;
  fotoUrl: string | null;
  /** Club por el que el representado juega ESTE partido (para el caso derby). */
  clubNombre: string | null;
  /** true si este partido puntual lo juega con la selección. */
  conSeleccion: boolean;
}

export interface DetallePartido {
  partidoId: string;
  competenciaNombre: string | null;
  competenciaCodigo: string | null;
  competenciaTipo: PartidoProximo['competenciaTipo'];
  esInternacional: boolean;
  /** Lado izquierdo del duelo (local si se sabe; si no, orden estable). */
  local: EquipoDuelo;
  /** Lado derecho del duelo. */
  visitante: EquipoDuelo;
  /**
   * true/false si TODOS los representados juegan del mismo lado y se sabe cuál; `null` si es
   * un derby entre dos representados o si la vista no trae `es_local`. Cuando es `null` el
   * panel no muestra la línea "Local"/"Visitante" (mismo criterio que el resto: no se inventa).
   */
  representadoEsLocal: boolean | null;
  inicioUtc: string | null;
  zonaHorariaEvento: string | null;
  diaUy: string | null;
  estado: PartidoProximo['estado'];
  ronda: string | null;
  estadio: string | null;
  ciudad: string | null;
  tentativo: boolean;
  jugadores: JugadorEnPartido[];
}

/** Duelo visto desde una fila (un representado): su club de un lado, el rival del otro. */
function dueloDesdeFila(fila: PartidoProximo): { local: EquipoDuelo; visitante: EquipoDuelo } {
  const club: EquipoDuelo = { nombre: fila.clubNombre, escudoUrl: fila.clubEscudoUrl };
  const rival: EquipoDuelo = { nombre: fila.rivalNombre, escudoUrl: fila.rivalEscudoUrl };
  // es_local === false → el club del representado es el visitante.
  return fila.esLocal === false ? { local: rival, visitante: club } : { local: club, visitante: rival };
}

export function plegarDetallePartido(filas: PartidoProximo[]): DetallePartido | null {
  if (filas.length === 0) return null;

  const base = filas[0];
  const clubesDistintos = new Set(filas.map((f) => f.clubNombre).filter(Boolean));
  const esDerby = clubesDistintos.size > 1;

  // representadoEsLocal: solo si TODAS las filas coinciden en un es_local no nulo.
  const localesUnicos = new Set(filas.map((f) => f.esLocal));
  const representadoEsLocal =
    !esDerby && localesUnicos.size === 1 && base.esLocal !== null ? base.esLocal : null;

  // El duelo: en un derby, los dos lados son los clubes de los representados (ordenados por
  // es_local si se sabe, si no por nombre para que sea estable). Si no, se toma de la fila.
  let local: EquipoDuelo;
  let visitante: EquipoDuelo;
  if (esDerby) {
    const filaLocal = filas.find((f) => f.esLocal === true);
    const filaVisita = filas.find((f) => f.esLocal === false);
    if (filaLocal && filaVisita) {
      local = { nombre: filaLocal.clubNombre, escudoUrl: filaLocal.clubEscudoUrl };
      visitante = { nombre: filaVisita.clubNombre, escudoUrl: filaVisita.clubEscudoUrl };
    } else {
      const ordenadas = [...filas].sort((a, b) =>
        (a.clubNombre ?? '').localeCompare(b.clubNombre ?? '', 'es'),
      );
      local = { nombre: ordenadas[0].clubNombre, escudoUrl: ordenadas[0].clubEscudoUrl };
      visitante = { nombre: ordenadas[1].clubNombre, escudoUrl: ordenadas[1].clubEscudoUrl };
    }
  } else {
    ({ local, visitante } = dueloDesdeFila(base));
  }

  const jugadores: JugadorEnPartido[] = [];
  const vistos = new Set<string>();
  for (const f of filas) {
    if (vistos.has(f.jugadorId)) continue;
    vistos.add(f.jugadorId);
    jugadores.push({
      jugadorId: f.jugadorId,
      nombre: f.jugadorNombre,
      apodo: f.jugadorApodo,
      fotoUrl: f.jugadorFotoUrl,
      clubNombre: f.clubNombre,
      conSeleccion: f.conSeleccion,
    });
  }
  jugadores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    partidoId: base.partidoId,
    competenciaNombre: base.competenciaNombre,
    competenciaCodigo: base.competenciaCodigo,
    competenciaTipo: base.competenciaTipo,
    esInternacional: base.esInternacional,
    local,
    visitante,
    representadoEsLocal,
    inicioUtc: base.inicioUtc,
    zonaHorariaEvento: base.zonaHorariaEvento,
    diaUy: base.diaUy,
    estado: base.estado,
    ronda: base.ronda,
    estadio: base.estadio,
    ciudad: base.ciudad,
    tentativo: base.tentativo,
    jugadores,
  };
}
