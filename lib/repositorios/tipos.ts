/**
 * Contratos del patrón repositorio.
 * El frontend depende SOLO de estas interfaces, nunca de un proveedor concreto ni de
 * la forma de la tabla. Las implementaciones (que leen de Postgres) viven en
 * `lib/repositorios/repositorio-*.ts`. Los proveedores externos (API-Football, ESPN, …)
 * viven en `lib/repositorios/externos/` y los usan las Edge Functions, no el navegador.
 *
 * ANDAMIAJE: interfaces mínimas para fijar el patrón. Se completan cuando se conecte
 * la vista `proximos_partidos` en la sesión siguiente.
 */

/** Un partido tal como lo consume la UI (fila de la vista `proximos_partidos`). */
export interface PartidoProximo {
  partidoId: string;
  jugadorId: string;
  jugadorNombre: string;
  jugadorApodo: string | null;
  competenciaNombre: string | null;
  competenciaCodigo: string | null;
  esInternacional: boolean;
  clubNombre: string | null;
  rivalNombre: string | null;
  esLocal: boolean | null;
  /** Instante absoluto ISO en UTC. La UI lo formatea con Luxon a hora de Uruguay. */
  inicioUtc: string | null;
  /** Nombre IANA de la sede, p.ej. 'Europe/Brussels'. */
  zonaHorariaEvento: string | null;
  /** Día calendario en Uruguay (YYYY-MM-DD), para agrupar. */
  diaUy: string | null;
  estado: string;
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
  /** Partidos de un jugador. */
  listarPorJugador(jugadorId: string): Promise<PartidoProximo[]>;
}

// RepositorioJugadores y RepositorioHitos se definen al conectarlos.
