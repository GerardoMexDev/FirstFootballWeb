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

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

const FUENTES_FECHA_FIJA: FuenteAgenda[] = [
  'cumpleanos',
  'aniversario_club',
  'aniversario_seleccion',
  'aniversario_debut',
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
    if (error) throw new Error(`No se pudo leer agenda_anual: ${error.message}`);

    return (data ?? [])
      .filter((r): r is { fuente: FuenteAgenda; titulo: string; dia_uy: string } =>
        r.fuente !== null && r.titulo !== null && r.dia_uy !== null,
      )
      .map((r) => ({ fuente: r.fuente, titulo: r.titulo, diaUy: r.dia_uy }));
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
    if (error) throw new Error(`No se pudo leer agenda_anual: ${error.message}`);

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
      }));
  }
}
