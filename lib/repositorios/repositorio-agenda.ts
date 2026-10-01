/**
 * Lee de la vista `agenda_anual` lo que necesitan las "Fechas señaladas" (notas que avisan
 * con 7-10 días de anticipación en calendario y en partidos). El filtrado por ventana y el
 * cálculo de `diasFalta`/`urgente` viven en `lib/agenda/notas-proximas.ts` (puro y testeado);
 * esto solo trae las filas del rango.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { DateTime } from 'luxon';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { DIAS_AVISO_AGENDA, type EventoAgenda, type FuenteAgenda } from '@/lib/agenda/notas-proximas';
import type { EventoCalendario } from '@/lib/calendario/eventos';
import { normalizarFechas, type FechaContenido, type FuenteFecha } from '@/lib/partidos/fechas-contenido';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

const FUENTES_FECHA_FIJA: FuenteAgenda[] = [
  'cumpleanos',
  'aniversario_club',
  'aniversario_seleccion',
  'aniversario_debut',
  'fecha_agencia',
];

// `.returns<T[]>()` fuerza la forma — sin esto la combinación de versiones de
// supabase-js/postgrest-js infiere `never` en `.select('col, col')` (ver avances.md §10).
type FilaAgenda = { fuente: string | null; titulo: string | null; dia_uy: string | null };
type FilaAgendaCal = FilaAgenda & {
  ref_id: string | null;
  cuando_utc: string | null;
  competencia_codigo: string | null;
  es_internacional: boolean | null;
  tentativo: boolean | null;
  /** Día en la sede (0013). Puede no venir si la migración aún no corrió → se cae a `dia_uy`. */
  dia_local_sede: string | null;
};

export class RepositorioAgendaSupabase {
  constructor(
    private readonly supabase: ClienteSupabase,
    private readonly vista: 'agenda_anual' | 'agenda_contenido' = 'agenda_anual',
  ) {}

  /**
   * Eventos de fecha fija (cumpleaños, aniversarios) entre hoy y hoy+`dias`, en zona de Uruguay.
   * @param hoyUy YYYY-MM-DD en zona de Uruguay
   */
  async listarEventosParaNotas(hoyUy: string, dias = DIAS_AVISO_AGENDA): Promise<EventoAgenda[]> {
    const hasta = DateTime.fromISO(hoyUy, { zone: 'utc' }).plus({ days: dias }).toISODate() ?? hoyUy;

    const { data, error } = await this.supabase
      .from(this.vista)
      .select('fuente, titulo, dia_uy')
      .in('fuente', FUENTES_FECHA_FIJA)
      .gte('dia_uy', hoyUy)
      .lte('dia_uy', hasta)
      .returns<FilaAgenda[]>();
    if (error) throw new Error(`No se pudo leer ${this.vista}: ${error.message}`);

    return (data ?? [])
      .filter((r): r is { fuente: FuenteAgenda; titulo: string; dia_uy: string } =>
        r.fuente !== null && r.titulo !== null && r.dia_uy !== null,
      )
      .map((r) => ({ fuente: r.fuente, titulo: r.titulo, diaUy: r.dia_uy }));
  }

  /**
   * Fechas de los jugadores de Contenido (cumpleaños y aniversarios) entre `desdeIso` y
   * `hastaIso`, para mezclarlas con los partidos en `/partidos`. Siempre lee
   * `agenda_contenido` (roster de Contenido, que incluye a los de Match Day), sin importar
   * la vista con la que se construyó el repositorio.
   */
  async listarFechasContenido(desdeIso: string, hastaIso: string): Promise<FechaContenido[]> {
    const { data, error } = await this.supabase
      .from('agenda_contenido')
      .select('fuente, ref_id, titulo, dia_uy')
      .in('fuente', FUENTES_FECHA_FIJA)
      .gte('dia_uy', desdeIso)
      .lte('dia_uy', hastaIso)
      .returns<(FilaAgenda & { ref_id: string | null })[]>();
    if (error) throw new Error(`No se pudo leer agenda_contenido: ${error.message}`);

    return normalizarFechas(
      (data ?? [])
        .filter((r) => r.fuente !== null && r.titulo !== null && r.dia_uy !== null)
        .map((r) => ({
          fuente: r.fuente as FuenteFecha,
          refId: r.ref_id,
          titulo: r.titulo!,
          dia: r.dia_uy!,
        })),
    );
  }

  /**
   * Todos los eventos fechados (partidos, convocatorias, hitos, cumpleaños, aniversarios)
   * entre `desdeIso` y `hastaIso` (YYYY-MM-DD, en zona de Uruguay). Alimenta la grilla y la
   * franja de densidad de la vista `calendario`.
   */
  async listarEventos(desdeIso: string, hastaIso: string): Promise<EventoCalendario[]> {
    // `select('*')` (no lista de columnas) para que `dia_local_sede` (0013) entre solo, y
    // para que si la migración todavía no corrió la ausencia de esa columna no rompa la
    // consulta — simplemente se cae a `dia_uy` en el map de abajo.
    const { data, error } = await this.supabase
      .from(this.vista)
      .select('*')
      .gte('dia_uy', desdeIso)
      .lte('dia_uy', hastaIso)
      .returns<FilaAgendaCal[]>();
    if (error) throw new Error(`No se pudo leer ${this.vista}: ${error.message}`);

    return (data ?? [])
      .filter((r): r is FilaAgendaCal & { fuente: FuenteAgenda; titulo: string; dia_uy: string } =>
        r.fuente !== null && r.titulo !== null && r.dia_uy !== null,
      )
      .map((r) => ({
        fuente: r.fuente,
        refId: r.ref_id,
        titulo: r.titulo,
        diaUy: r.dia_uy,
        diaLocalSede: r.dia_local_sede ?? r.dia_uy,
        cuandoUtc: r.cuando_utc,
        competenciaCodigo: r.competencia_codigo,
        esInternacional: r.es_internacional ?? false,
        tentativo: r.tentativo ?? false,
        grupo: this.vista === 'agenda_contenido' ? ('contenido' as const) : ('matchday' as const),
      }));
  }

  /** Partidos de la selección uruguaya (`partidos_seleccion`, 0031) entre dos días (grupo Selección). */
  async listarPartidosSeleccion(desdeIso: string, hastaIso: string): Promise<EventoCalendario[]> {
    const { data, error } = await this.supabase
      .from('partidos_seleccion')
      .select('partido_id, club_nombre, rival_nombre, es_local, inicio_utc, dia_uy, dia_local_sede, competencia_codigo, tentativo')
      .gte('dia_uy', desdeIso)
      .lte('dia_uy', hastaIso)
      .returns<
        Array<{
          partido_id: string | null;
          club_nombre: string | null;
          rival_nombre: string | null;
          es_local: boolean | null;
          inicio_utc: string | null;
          dia_uy: string | null;
          dia_local_sede: string | null;
          competencia_codigo: string | null;
          tentativo: boolean | null;
        }>
      >();
    if (error) throw new Error(`No se pudo leer partidos_seleccion: ${error.message}`);
    return (data ?? [])
      .filter((r) => r.partido_id && r.dia_uy)
      .map((r) => ({
        fuente: 'partido' as const,
        refId: r.partido_id,
        // Local primero, como el resto de los partidos.
        titulo: r.es_local === false ? `${r.rival_nombre ?? '?'} vs Uruguay` : `Uruguay vs ${r.rival_nombre ?? '?'}`,
        diaUy: r.dia_uy!,
        diaLocalSede: r.dia_local_sede ?? r.dia_uy!,
        cuandoUtc: r.inicio_utc,
        competenciaCodigo: r.competencia_codigo,
        esInternacional: true,
        tentativo: r.tentativo ?? false,
        grupo: 'seleccion' as const,
      }));
  }

  /**
   * Partidos de los jugadores solo-Contenido (`proximos_partidos_contenido`, 0027) entre dos días,
   * como eventos del calendario unificado (grupo Contenido, 2026-09-30).
   */
  async listarPartidosContenido(desdeIso: string, hastaIso: string): Promise<EventoCalendario[]> {
    const { data, error } = await this.supabase
      .from('proximos_partidos_contenido')
      .select('partido_id, club_nombre, rival_nombre, inicio_utc, dia_uy, dia_local_sede, competencia_codigo, es_internacional, tentativo')
      .gte('dia_uy', desdeIso)
      .lte('dia_uy', hastaIso)
      .returns<
        Array<{
          partido_id: string | null;
          club_nombre: string | null;
          rival_nombre: string | null;
          inicio_utc: string | null;
          dia_uy: string | null;
          dia_local_sede: string | null;
          competencia_codigo: string | null;
          es_internacional: boolean | null;
          tentativo: boolean | null;
        }>
      >();
    if (error) throw new Error(`No se pudo leer proximos_partidos_contenido: ${error.message}`);
    return (data ?? [])
      .filter((r) => r.partido_id && r.dia_uy)
      .map((r) => ({
        fuente: 'partido' as const,
        refId: r.partido_id,
        titulo: `${r.club_nombre ?? '?'} vs ${r.rival_nombre ?? '?'}`,
        diaUy: r.dia_uy!,
        diaLocalSede: r.dia_local_sede ?? r.dia_uy!,
        cuandoUtc: r.inicio_utc,
        competenciaCodigo: r.competencia_codigo,
        esInternacional: r.es_internacional ?? false,
        tentativo: r.tentativo ?? false,
        grupo: 'contenido' as const,
      }));
  }
}
