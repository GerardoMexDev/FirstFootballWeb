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

/**
 * Un jugador como lo pinta la grilla del plantel (vista `jugadores`). Números de carrera
 * de la vista `totales_jugador` (base manual + lo sincronizado) — `null` si la agencia no
 * cargó la base de ese jugador (contexto.md §10, cero invenciones).
 */
export interface JugadorPlantel {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  posicion: string | null;
  nacionalidad: string | null;
  /** Nombre de la selección si tiene caps con ella; `null` si no juega en selección. */
  seleccion: string | null;
  /** Ruta pública de la foto (`/jugadores/<slug>.webp`) o `null` → la tarjeta usa el fondo `.jug__fb`. */
  fotoUrl: string | null;
  clubNombre: string | null;
  clubEscudoUrl: string | null;
  clubPais: string | null;
  carreraPartidos: number | null;
  carreraGoles: number | null;
  carreraAsistencias: number | null;
}

/** Números del jugador en el año calendario en curso (vista `temporada_actual`). */
export interface TemporadaActual {
  partidos: number | null;
  minutos: number | null;
  goles: number | null;
  asistencias: number | null;
  amarillas: number | null;
  rojas: number | null;
  valoracionPromedio: number | null;
}

/**
 * La ficha completa de un jugador (`/jugadores/[jugadorId]`). Todo lo de la grilla + las
 * fechas y datos de contacto para "Datos para contenido". Los campos `debut`, `fichaje` e
 * `instagram` hoy suelen venir `null` (no cargados) → la ficha muestra "Sin datos", no los
 * inventa.
 */
export interface JugadorFicha extends JugadorPlantel {
  /** YYYY-MM-DD (fecha civil, sin hora). */
  fechaNacimiento: string | null;
  debut: string | null;
  debutSeleccion: string | null;
  fichaje: string | null;
  instagram: string | null;
  seleccionPartidos: number | null;
  seleccionGoles: number | null;
}

export interface RepositorioJugadores {
  /** Todo el plantel activo, ordenado por nombre. */
  listar(): Promise<JugadorPlantel[]>;
  /** Un jugador por id, o `null` si no existe o está inactivo. */
  obtener(jugadorId: string): Promise<JugadorFicha | null>;
  /** Números del año en curso, o `null` si el jugador no jugó ningún partido este año. */
  temporadaActual(jugadorId: string): Promise<TemporadaActual | null>;
}

// RepositorioHitos: la clase `RepositorioHitosSupabase` se usa directo (sin interfaz)
// desde las páginas que arman el motor de hitos.
