/**
 * Implementación del patrón repositorio sobre la vista `proximos_partidos` (Postgres/Supabase).
 * Cualquier otra fuente futura (caché, mock de test) implementa la misma interfaz
 * `RepositorioPartidos` — el resto de la app no sabe que esto es Supabase.
 *
 * Nota sobre el filtro `estado != 'finalizado'`: la vista `proximos_partidos` (migración 0001)
 * no filtra por fecha ni por estado — es un JOIN de todos los partidos de cada representado.
 * "Próximos" se aplica acá, en el repositorio, no en el esquema: un partido finalizado no es
 * un "próximo partido". Si en el futuro se necesita el historial, es un método nuevo
 * (`listarHistorial`), no tocar este.
 */
import type { Database } from '@/lib/supabase/tipos-db';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { PartidoProximo, RepositorioPartidos } from './tipos';

/**
 * El cliente tipado, tomado del propio `crearClienteServidor` en vez de reconstruir
 * `SupabaseClient<Database, ...>` a mano: la versión instalada de supabase-js agrega un
 * parámetro de tipo extra (detecta la versión de PostgREST vía `Database.__InternalSupabase`)
 * y un `SupabaseClient<Database>` armado por fuera no calza estructuralmente con el que
 * realmente devuelve `createServerClient`.
 */
type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

type FilaProximoPartido = Database['public']['Views']['proximos_partidos']['Row'];

/** Traduce la fila cruda de la vista (snake_case, tal cual Postgres) al tipo de la UI. */
function aPartidoProximo(fila: FilaProximoPartido): PartidoProximo | null {
  // partido_id/jugador_id nunca deberían ser NULL (son la clave de la fila) — si lo son,
  // la fila está rota y se descarta en vez de mostrar un partido sin identidad.
  if (!fila.partido_id || !fila.jugador_id || !fila.jugador_nombre) return null;

  return {
    partidoId: fila.partido_id,
    jugadorId: fila.jugador_id,
    jugadorNombre: fila.jugador_nombre,
    jugadorApodo: fila.jugador_apodo,
    jugadorFotoUrl: fila.jugador_foto_url,
    jugadorSeleccion: fila.jugador_seleccion,
    conSeleccion: fila.con_seleccion ?? false,
    competenciaId: fila.competencia_id,
    competenciaNombre: fila.competencia_nombre,
    competenciaCodigo: fila.competencia_codigo,
    competenciaTipo: fila.competencia_tipo,
    esInternacional: fila.es_internacional ?? false,
    competenciaCobertura: fila.competencia_cobertura,
    clubId: fila.club_id,
    clubNombre: fila.club_nombre,
    clubEscudoUrl: fila.club_escudo_url,
    rivalId: fila.rival_id,
    rivalNombre: fila.rival_nombre,
    rivalEscudoUrl: fila.rival_escudo_url,
    esLocal: fila.es_local,
    inicioUtc: fila.inicio_utc,
    zonaHorariaEvento: fila.zona_horaria_evento,
    diaUy: fila.dia_uy,
    estado: fila.estado,
    ronda: fila.ronda,
    estadio: fila.estadio,
    ciudad: fila.ciudad,
    marcadorLocal: fila.marcador_local,
    marcadorVisitante: fila.marcador_visitante,
    tentativo: fila.tentativo ?? false,
  };
}

export class RepositorioPartidosSupabase implements RepositorioPartidos {
  constructor(private readonly supabase: ClienteSupabase) {}

  async listarProximos(): Promise<PartidoProximo[]> {
    const { data, error } = await this.supabase
      .from('proximos_partidos')
      .select('*')
      .neq('estado', 'finalizado')
      .order('inicio_utc', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`No se pudo leer proximos_partidos: ${error.message}`);

    return (data ?? [])
      .map(aPartidoProximo)
      .filter((p): p is PartidoProximo => p !== null);
  }

  async listarPorJugador(jugadorId: string): Promise<PartidoProximo[]> {
    const { data, error } = await this.supabase
      .from('proximos_partidos')
      .select('*')
      .eq('jugador_id', jugadorId)
      .neq('estado', 'finalizado')
      .order('inicio_utc', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`No se pudo leer proximos_partidos de ${jugadorId}: ${error.message}`);

    return (data ?? [])
      .map(aPartidoProximo)
      .filter((p): p is PartidoProximo => p !== null);
  }

  async listarPorPartido(partidoId: string): Promise<PartidoProximo[]> {
    // Sin filtro de estado: se pidió este partido puntual (para el panel de detalle).
    const { data, error } = await this.supabase
      .from('proximos_partidos')
      .select('*')
      .eq('partido_id', partidoId);

    if (error) throw new Error(`No se pudo leer proximos_partidos del partido ${partidoId}: ${error.message}`);

    return (data ?? [])
      .map(aPartidoProximo)
      .filter((p): p is PartidoProximo => p !== null);
  }
}
