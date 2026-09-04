/**
 * Contratos del patrón repositorio.
 * El frontend depende SOLO de estas interfaces, nunca de un proveedor concreto ni de
 * la forma de la tabla. Las implementaciones (que leen de Postgres) viven en
 * `lib/repositorios/repositorio-*.ts`. Los proveedores externos (API-Football, ESPN, …)
 * viven en `lib/repositorios/externos/` y los usan las Edge Functions, no el navegador.
 */

/** Un partido tal como lo consume la UI (fila de la vista `proximos_partidos`). */
export interface PartidoProximo {
  partidoId: string;
  jugadorId: string;
  jugadorNombre: string;
  jugadorApodo: string | null;
  jugadorFotoUrl: string | null;
  /** Selección a la que pertenece el jugador (si la tiene); NULL si no juega en selección. */
  jugadorSeleccion: string | null;
  /** true si ESTE partido puntual lo juega con la selección, no con el club. */
  conSeleccion: boolean;
  competenciaId: string | null;
  competenciaNombre: string | null;
  competenciaCodigo: string | null;
  competenciaTipo: 'liga' | 'copa' | 'continental' | 'seleccion' | null;
  esInternacional: boolean;
  /** NULL = cobertura de datos sin verificar contra GET /leagues (contexto.md §3). */
  competenciaCobertura: boolean | null;
  clubId: string | null;
  clubNombre: string | null;
  clubEscudoUrl: string | null;
  rivalId: string | null;
  rivalNombre: string | null;
  rivalEscudoUrl: string | null;
  /** ¿Juega de local el club del representado? NULL = sin datos. */
  esLocal: boolean | null;
  /** Instante absoluto ISO en UTC. La UI lo formatea con Luxon (lib/fechas/zonas.ts). */
  inicioUtc: string | null;
  /** Nombre IANA de la sede, p.ej. 'Europe/Brussels'. */
  zonaHorariaEvento: string | null;
  /** Día calendario en Uruguay (YYYY-MM-DD) — clave de agrupación de la lista. */
  diaUy: string | null;
  estado: 'programado' | 'en_juego' | 'finalizado' | 'suspendido' | 'sin_datos' | null;
  ronda: string | null;
  estadio: string | null;
  ciudad: string | null;
  marcadorLocal: number | null;
  marcadorVisitante: number | null;
  tentativo: boolean;
}

export interface RepositorioPartidos {
  /** Próximos partidos de todos los representados, ordenados por fecha. */
  listarProximos(): Promise<PartidoProximo[]>;
  /** Partidos de un jugador puntual (ficha de jugador). */
  listarPorJugador(jugadorId: string): Promise<PartidoProximo[]>;
}

// RepositorioJugadores y RepositorioHitos se definen al conectarlos.
