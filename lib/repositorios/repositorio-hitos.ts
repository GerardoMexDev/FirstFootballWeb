/**
 * Trae lo que necesita el motor de hitos (lib/motor-hitos/): las escalas activas
 * (`escalas_hito`), los totales corrientes por jugador (vista `totales_jugador`) y los
 * jugadores activos. El cálculo en sí vive en `lib/motor-hitos/`, esto solo lee Postgres.
 */
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { Database } from '@/lib/supabase/tipos-db';
import type { EscalaHito, JugadorBasico, TotalesJugador } from '@/lib/motor-hitos/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

// `.returns<T[]>()` fuerza la forma del resultado — sin esto, esta combinación de versiones
// de supabase-js/postgrest-js infiere `never` en `.select('col, col')` (ver avances.md §10).
type FilaEscala = Pick<
  Database['public']['Tables']['escalas_hito']['Row'],
  'metrica' | 'base' | 'paso' | 'aviso' | 'plantilla_frase'
>;
type FilaTotales = Database['public']['Views']['totales_jugador']['Row'];
type FilaJugador = Pick<Database['public']['Tables']['jugadores']['Row'], 'id' | 'nombre' | 'apodo'>;

export class RepositorioHitosSupabase {
  constructor(private readonly supabase: ClienteSupabase) {}

  async listarEscalasActivas(): Promise<EscalaHito[]> {
    const { data, error } = await this.supabase
      .from('escalas_hito')
      .select('metrica, base, paso, aviso, plantilla_frase')
      .eq('activo', true)
      .returns<FilaEscala[]>();
    if (error) throw new Error(`No se pudo leer escalas_hito: ${error.message}`);

    return data.map((e) => ({
      metrica: e.metrica,
      base: e.base,
      paso: e.paso,
      aviso: e.aviso,
      plantillaFrase: e.plantilla_frase,
    }));
  }

  async listarTotales(): Promise<TotalesJugador[]> {
    const { data, error } = await this.supabase.from('totales_jugador').select('*').returns<FilaTotales[]>();
    if (error) throw new Error(`No se pudo leer totales_jugador: ${error.message}`);

    return data
      .filter((t): t is FilaTotales & { jugador_id: string } => t.jugador_id !== null)
      .map((t) => ({
        jugadorId: t.jugador_id,
        carreraPartidos: t.carrera_partidos,
        carreraGoles: t.carrera_goles,
        carreraAsistencias: t.carrera_asistencias,
        seleccionPartidos: t.seleccion_partidos,
        seleccionGoles: t.seleccion_goles,
      }));
  }

  async listarJugadoresActivos(): Promise<JugadorBasico[]> {
    const { data, error } = await this.supabase
      .from('jugadores')
      .select('id, nombre, apodo')
      .eq('activo', true)
      .returns<FilaJugador[]>();
    if (error) throw new Error(`No se pudo leer jugadores: ${error.message}`);
    return data;
  }
}
