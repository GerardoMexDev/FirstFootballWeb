/**
 * Qué puede hacer cada cargo con un ticket — ESPEJO de las reglas de la base (0025,
 * `ticket__mover`). La base es la que manda: esto solo decide qué botones mostrar. Puro.
 *
 * Football First. Creado 2026-09-28.
 */
import type { Accion, EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

const CREADORES = ['Administrador', 'Community Manager'];
const COMENTAN = ['Administrador', 'Community Manager', 'Diseñador'];

export function puedeCrear(cargo: string): boolean {
  return CREADORES.includes(cargo);
}

export function accionesPermitidas(p: { cargo: string; esCreador: boolean; estado: EstadoTicket }): Accion[] {
  const acciones: Accion[] = [];
  const esRevisor = p.cargo === 'Administrador' || (p.cargo === 'Community Manager' && p.esCreador);
  if (p.cargo === 'Diseñador') {
    if (p.estado === 'pendiente') acciones.push('entregar');
    if (p.estado === 'aprobado') acciones.push('publicar');
  }
  if (esRevisor) {
    if (p.estado === 'en_revision') acciones.push('aprobar', 'devolver');
    if (p.estado === 'pendiente') acciones.push('cancelar');
  }
  if (COMENTAN.includes(p.cargo)) acciones.push('comentar');
  return acciones;
}

/** Lo que "le toca" a cada cargo (contador de la barra), por fecha límite; sin fecha al final. */
export function pendientesDe(cargo: string, usuarioId: string, tickets: ResumenTicket[]): ResumenTicket[] {
  const filtro: (t: ResumenTicket) => boolean =
    cargo === 'Diseñador'
      ? (t) => t.estado === 'pendiente' || t.estado === 'aprobado'
      : cargo === 'Community Manager'
        ? (t) => t.estado === 'en_revision' && t.creadoPor === usuarioId
        : cargo === 'Administrador'
          ? (t) => t.estado === 'en_revision'
          : () => false;
  return tickets
    .filter(filtro)
    .sort(
      (a, b) =>
        (a.fechaLimite ?? '9999-12-31').localeCompare(b.fechaLimite ?? '9999-12-31') ||
        a.titulo.localeCompare(b.titulo, 'es'),
    );
}
