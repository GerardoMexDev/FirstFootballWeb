/**
 * Lecturas de tickets (vistas `tickets_vista` y `tickets_historial_vista`, 0025). Las
 * escrituras NO están acá: van por `lib/tickets/acciones.ts` (funciones de la base).
 * RLS: solo usuarios activos leen.
 *
 * Football First. Creado 2026-09-28.
 */
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { DetalleTicket, EstadoTicket, EventoHistorial, ResumenTicket, TipoEventoTicket } from '@/lib/tickets/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

type FilaResumen = Omit<FilaTicket, 'nota' | 'link_entrega' | 'estado_partido'>;

interface FilaTicket {
  id: string;
  partido_id: string | null;
  jugador_id: string;
  jugador_nombre: string;
  titulo: string;
  nota: string;
  estado: EstadoTicket;
  link_entrega: string | null;
  creado_por: string;
  creado_por_nombre: string | null;
  inicio_utc: string | null;
  estado_partido: string | null;
  partido_eliminado: boolean;
  fecha_limite: string | null;
  creado_en: string;
}

interface FilaHistorial {
  id: number;
  tipo: TipoEventoTicket;
  autor_nombre: string | null;
  texto: string | null;
  link: string | null;
  estado_desde: EstadoTicket | null;
  estado_hasta: EstadoTicket | null;
  creado_en: string;
}

// Listas: sin `nota` (solo el detalle la necesita).
const CAMPOS_RESUMEN =
  'id, partido_id, jugador_id, jugador_nombre, titulo, estado, creado_por, creado_por_nombre, inicio_utc, fecha_limite, partido_eliminado, creado_en';
const CAMPOS =
  'id, partido_id, jugador_id, jugador_nombre, titulo, nota, estado, link_entrega, creado_por, creado_por_nombre, inicio_utc, estado_partido, partido_eliminado, fecha_limite, creado_en';

function aResumen(f: FilaResumen): ResumenTicket {
  return {
    id: f.id,
    partidoId: f.partido_id,
    jugadorId: f.jugador_id,
    jugadorNombre: f.jugador_nombre,
    titulo: f.titulo,
    estado: f.estado,
    creadoPor: f.creado_por,
    creadoPorNombre: f.creado_por_nombre,
    inicioUtc: f.inicio_utc,
    fechaLimite: f.fecha_limite,
    partidoEliminado: f.partido_eliminado,
    creadoEn: f.creado_en,
  };
}

export class RepositorioTicketsSupabase {
  constructor(private readonly supabase: ClienteSupabase) {}

  /** Tickets que todavía "le tocan" a alguien (contador de la barra): pendiente, en revisión, aprobado. */
  async listarPendientes(): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .in('estado', ['pendiente', 'en_revision', 'aprobado'])
      .order('creado_en', { ascending: true })
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer tickets pendientes: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  /** Tickets no cancelados con partido desde `desdeIso` (yyyy-mm-dd, inicio de la ventana del calendario). */
  async listarParaCalendario(desdeIso: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .neq('estado', 'cancelado')
      .gte('inicio_utc', desdeIso)
      .order('inicio_utc', { ascending: true })
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer tickets del calendario: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  /** Tickets no cancelados de un partido (pastillas del panel del partido). */
  async listarPorPartido(partidoId: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .eq('partido_id', partidoId)
      .neq('estado', 'cancelado')
      .order('creado_en', { ascending: true })
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer tickets del partido: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  /**
   * Pantalla Tickets (2026-09-29): abiertos de cualquier fecha + cerrados (publicado,
   * cancelado) creados desde `desdeIso` (yyyy-mm-dd). Del más nuevo al más viejo, tope 300.
   */
  async listarParaPantalla(desdeIso: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .or(`estado.in.(pendiente,en_revision,aprobado),creado_en.gte.${desdeIso}`)
      .order('creado_en', { ascending: false })
      .limit(300)
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer la lista de tickets: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  async obtenerDetalle(id: string): Promise<{ ticket: DetalleTicket; historial: EventoHistorial[] } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [{ data: fila, error: e1 }, { data: filas, error: e2 }] = await Promise.all([
      this.supabase.from('tickets_vista').select(CAMPOS).eq('id', id).maybeSingle<FilaTicket>(),
      this.supabase
        .from('tickets_historial_vista')
        .select('id, tipo, autor_nombre, texto, link, estado_desde, estado_hasta, creado_en')
        .eq('ticket_id', id)
        .order('id', { ascending: true })
        .returns<FilaHistorial[]>(),
    ]);
    if (e1) throw new Error(`No se pudo leer el ticket: ${e1.message}`);
    if (e2) throw new Error(`No se pudo leer el historial: ${e2.message}`);
    if (!fila) return null;
    return {
      ticket: { ...aResumen(fila), nota: fila.nota, linkEntrega: fila.link_entrega, estadoPartido: fila.estado_partido },
      historial: (filas ?? []).map((h) => ({
        id: h.id,
        tipo: h.tipo,
        autorNombre: h.autor_nombre,
        texto: h.texto,
        link: h.link,
        estadoDesde: h.estado_desde,
        estadoHasta: h.estado_hasta,
        creadoEn: h.creado_en,
      })),
    };
  }
}
