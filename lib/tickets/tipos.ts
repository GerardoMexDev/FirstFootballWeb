/**
 * Tipos del front para los tickets de diseño (ver planeacion/specs/2026-09-28-tickets-diseno.md).
 * Espejo de `tickets_vista` / `tickets_historial_vista` (migración 0025), en camelCase.
 *
 * Football First. Creado 2026-09-28.
 */

export type EstadoTicket = 'pendiente' | 'en_revision' | 'aprobado' | 'publicado' | 'cancelado';

export type TipoEventoTicket =
  | 'creado' | 'comentario' | 'entrega' | 'aprobado' | 'devuelto' | 'publicado' | 'cancelado' | 'sistema';

/** Valores de `perfiles.cargo`. */
export type Cargo = 'Administrador' | 'Community Manager' | 'Diseñador' | 'Prueba';

export type Accion = 'entregar' | 'aprobar' | 'devolver' | 'publicar' | 'cancelar' | 'comentar';

/** Lo que necesitan el calendario, el contador y la pastilla del panel del partido. */
export interface ResumenTicket {
  id: string;
  partidoId: string | null;
  jugadorId: string;
  jugadorNombre: string;
  titulo: string;
  estado: EstadoTicket;
  creadoPor: string;
  creadoPorNombre: string | null;
  /** ISO UTC del partido (o la última fecha conocida si el partido desapareció). */
  inicioUtc: string | null;
  /** YYYY-MM-DD (hora de Uruguay). */
  fechaLimite: string | null;
  partidoEliminado: boolean;
}

/** La tarjeta del ticket. */
export interface DetalleTicket extends ResumenTicket {
  nota: string;
  linkEntrega: string | null;
  estadoPartido: string | null;
}

export interface EventoHistorial {
  id: number;
  tipo: TipoEventoTicket;
  autorNombre: string | null;
  texto: string | null;
  link: string | null;
  estadoDesde: EstadoTicket | null;
  estadoHasta: EstadoTicket | null;
  /** ISO UTC. */
  creadoEn: string;
}
