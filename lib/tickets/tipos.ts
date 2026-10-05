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

/** Acciones del flujo simple (0030): el Diseñador completa/reabre; creador o Admin cancelan. */
export type Accion = 'completar' | 'reabrir' | 'cancelar' | 'comentar';

/** Semáforo (0030): rojo pendiente, verde completado, amarillo vencido; gris cancelado (0040). */
export type EstadoVisual = 'pendiente' | 'completado' | 'vencido' | 'cancelado';

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
  /** ISO UTC de creación: ordena la pantalla Tickets y arma "hace 2 días" (2026-09-29). */
  creadoEn: string;
  /** Tickets de fecha (0028): yyyy-mm-dd del evento y qué se celebra. `null` en los de partido. */
  fechaEvento: string | null;
  motivo: string | null;
  /** Ticket automático de Match Day (0030): id 'md:<partido>:<jugador>'; se abre el partido, no un ticket. */
  automatico?: boolean;
  /** Automático cancelado (0040): el motivo que escribió quien lo canceló. */
  motivoCancelacion?: string | null;
  /** Automático de un partido que apareció después de su fecha límite normal (0040): vence el día del partido. */
  ultimoMomento?: boolean;
}

/** La tarjeta del ticket. */
export interface DetalleTicket extends ResumenTicket {
  nota: string;
  linkEntrega: string | null;
  estadoPartido: string | null;
  /** Para "Ver jugador": abre la ficha de Contenido si el jugador no es de Match Day. */
  jugadorSoloContenido: boolean;
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
