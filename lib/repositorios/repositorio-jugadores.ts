/**
 * Implementación del patrón repositorio para el plantel (tablas `jugadores` + `clubes` +
 * vistas `totales_jugador` y `temporada_actual`). El resto de la app depende de la interfaz
 * `RepositorioJugadores`, no de que esto sea Supabase.
 *
 * - Números de CARRERA: de `totales_jugador` (base manual + lo sincronizado). `null` si la
 *   agencia no cargó la base de ese jugador — no se asume 0 (contexto.md §10).
 * - Números del AÑO en curso: de `temporada_actual`. Si el jugador no jugó ningún partido
 *   este año, la vista no lo trae y `temporadaActual()` devuelve `null` (la ficha lo trata
 *   como "la temporada recién arranca", no como ceros).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { Database } from '@/lib/supabase/tipos-db';
import type {
  JugadorFicha,
  JugadorPlantel,
  RepositorioJugadores,
  TemporadaActual,
} from './tipos';

// Ver avances.md §10: un `SupabaseClient<Database>` reconstruido a mano no calza con el que
// devuelve `createServerClient` en esta versión — se toma el tipo del propio factory.
type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

type FilaTotales = Database['public']['Views']['totales_jugador']['Row'];
type FilaTemporada = Database['public']['Views']['temporada_actual']['Row'];

/** Club embebido en la fila de `jugadores` (solo lo que usa la grilla/ficha). */
interface ClubEmbebido {
  nombre: string | null;
  escudo_url: string | null;
  pais: string | null;
}

/** Columnas de `jugadores` que pide la grilla + el club embebido por la FK. */
interface FilaJugadorPlantel {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  posicion: string | null;
  nacionalidad: string | null;
  seleccion: string | null;
  foto_url: string | null;
  clubes: ClubEmbebido | null;
}

/** La fila anterior + las fechas que solo necesita la ficha completa. */
interface FilaJugadorFicha extends FilaJugadorPlantel {
  fecha_nacimiento: string | null;
  debut: string | null;
  debut_seleccion: string | null;
  fichaje: string | null;
  instagram: string | null;
}

// `clubes!jugadores_club_actual_id_fkey(...)` desambigua por nombre de la FK: `jugadores`
// tiene varias relaciones que salen de `club_actual_id` (a `clubes` y al view
// `proximos_partidos`), así que un `clubes(...)` a secas no resuelve.
const CAMPOS_PLANTEL =
  'id, nombre, apodo, dorsal, posicion, nacionalidad, seleccion, foto_url, ' +
  'clubes!jugadores_club_actual_id_fkey(nombre, escudo_url, pais)';

const CAMPOS_FICHA =
  CAMPOS_PLANTEL + ', fecha_nacimiento, debut, debut_seleccion, fichaje, instagram';

/** `jugadores.id` es un UUID. Un `id` con otra forma no es un error 500: es "no existe". */
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Combina la fila de `jugadores` (+club) con la de `totales_jugador` en el tipo de la UI. */
function aJugadorPlantel(fila: FilaJugadorPlantel, totales: FilaTotales | undefined): JugadorPlantel {
  return {
    id: fila.id,
    nombre: fila.nombre,
    apodo: fila.apodo,
    dorsal: fila.dorsal,
    posicion: fila.posicion,
    nacionalidad: fila.nacionalidad,
    seleccion: fila.seleccion,
    fotoUrl: fila.foto_url,
    clubNombre: fila.clubes?.nombre ?? null,
    clubEscudoUrl: fila.clubes?.escudo_url ?? null,
    clubPais: fila.clubes?.pais ?? null,
    carreraPartidos: totales?.carrera_partidos ?? null,
    carreraGoles: totales?.carrera_goles ?? null,
    carreraAsistencias: totales?.carrera_asistencias ?? null,
  };
}

export class RepositorioJugadoresSupabase implements RepositorioJugadores {
  constructor(private readonly supabase: ClienteSupabase) {}

  async listar(): Promise<JugadorPlantel[]> {
    const [{ data: jugadores, error: errJ }, { data: totales, error: errT }] = await Promise.all([
      this.supabase
        .from('jugadores')
        .select(CAMPOS_PLANTEL)
        .eq('activo', true)
        .order('nombre', { ascending: true })
        .returns<FilaJugadorPlantel[]>(),
      this.supabase.from('totales_jugador').select('*').returns<FilaTotales[]>(),
    ]);

    if (errJ) throw new Error(`No se pudo leer jugadores: ${errJ.message}`);
    if (errT) throw new Error(`No se pudo leer totales_jugador: ${errT.message}`);

    const totalesPorId = new Map((totales ?? []).map((t) => [t.jugador_id, t]));
    return (jugadores ?? []).map((j) => aJugadorPlantel(j, totalesPorId.get(j.id) ?? undefined));
  }

  async obtener(jugadorId: string): Promise<JugadorFicha | null> {
    if (!ES_UUID.test(jugadorId)) return null;

    const [{ data: fila, error: errJ }, { data: totales, error: errT }] = await Promise.all([
      this.supabase
        .from('jugadores')
        .select(CAMPOS_FICHA)
        .eq('id', jugadorId)
        .eq('activo', true)
        .maybeSingle<FilaJugadorFicha>(),
      this.supabase
        .from('totales_jugador')
        .select('*')
        .eq('jugador_id', jugadorId)
        .maybeSingle<FilaTotales>(),
    ]);

    if (errJ) throw new Error(`No se pudo leer el jugador ${jugadorId}: ${errJ.message}`);
    if (errT) throw new Error(`No se pudo leer totales_jugador de ${jugadorId}: ${errT.message}`);
    if (!fila) return null;

    return {
      ...aJugadorPlantel(fila, totales ?? undefined),
      fechaNacimiento: fila.fecha_nacimiento,
      debut: fila.debut,
      debutSeleccion: fila.debut_seleccion,
      fichaje: fila.fichaje,
      instagram: fila.instagram,
      seleccionPartidos: totales?.seleccion_partidos ?? null,
      seleccionGoles: totales?.seleccion_goles ?? null,
    };
  }

  async temporadaActual(jugadorId: string): Promise<TemporadaActual | null> {
    const { data, error } = await this.supabase
      .from('temporada_actual')
      .select('*')
      .eq('jugador_id', jugadorId)
      .maybeSingle<FilaTemporada>();

    if (error) throw new Error(`No se pudo leer temporada_actual de ${jugadorId}: ${error.message}`);
    if (!data) return null;

    return {
      partidos: data.partidos,
      minutos: data.minutos,
      goles: data.goles,
      asistencias: data.asistencias,
      amarillas: data.amarillas,
      rojas: data.rojas,
      valoracionPromedio: data.valoracion_promedio,
    };
  }
}
