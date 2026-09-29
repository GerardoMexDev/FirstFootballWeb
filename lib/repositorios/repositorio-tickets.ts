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

const CAMPOS =
  'id, partido_id, jugador_id, jugador_nombre, titulo, nota, estado, link_entrega, creado_por, creado_por_nombre, inicio_utc, estado_partido, partido_eliminado, fecha_limite';

function aResumen(f: FilaTicket): ResumenTicket {
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
  };
}

export class RepositorioTicketsSupabase {
  constructor(private readonly supabase: ClienteSupabase) {}

  /** Todos los tickets no cancelados (tabla chica: 3 usuarios). */
  async listarResumen(): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS)
      .neq('estado', 'cancelado')
      .order('creado_en', { ascending: true })
      .returns<FilaTicket[]>();
    if (error) throw new Error(`No se pudo leer tickets: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  /** Tickets no cancelados de un partido (pastillas del panel del partido). */
  async listarPorPartido(partidoId: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS)
      .eq('partido_id', partidoId)
      .neq('estado', 'cancelado')
      .order('creado_en', { ascending: true })
      .returns<FilaTicket[]>();
    if (error) throw new Error(`No se pudo leer tickets del partido: ${error.message}`);
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
