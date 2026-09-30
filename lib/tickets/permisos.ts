/**
 * Qué puede hacer cada cargo con un ticket — ESPEJO de las reglas de la base (0025/0030,
 * `ticket__mover`). La base es la que manda: esto solo decide qué botones mostrar. Puro.
 *
 * Desde 2026-09-30 (0030) el recorrido es simple: pendiente → completado (el estado 'publicado').
 * El Diseñador completa y reabre; quien creó el ticket o el Administrador lo cancelan.
 * "Lo que te toca" (globito, lucecita) = solo lo vencido o por vencer: `esUrgente` lo decide el
 * llamador (`esUrgenteHoy` de pantalla.ts) para no importar otro módulo desde acá.
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
  if (p.cargo === 'Diseñador' && p.estado === 'pendiente') acciones.push('completar');
  if (p.cargo === 'Diseñador' && p.estado === 'publicado') acciones.push('reabrir');
  if (esRevisor && p.estado === 'pendiente') acciones.push('cancelar');
  if (COMENTAN.includes(p.cargo)) acciones.push('comentar');
  return acciones;
}

/**
 * ¿Este ticket le toca a este usuario? Pendiente y urgente (vencido o por vencer). El CM ve sus
 * manuales y todos los automáticos de Match Day; Admin y Diseñador, todos; Prueba, nada.
 */
export function debeActuar(
  cargo: string,
  usuarioId: string,
  t: ResumenTicket,
  esUrgente: (t: ResumenTicket) => boolean,
): boolean {
  if (!COMENTAN.includes(cargo)) return false;
  if (t.estado !== 'pendiente' || !esUrgente(t)) return false;
  if (cargo === 'Community Manager') return !!t.automatico || t.creadoPor === usuarioId;
  return true;
}

/** Lo que "le toca" a cada cargo (globito de la barra), por fecha límite; sin fecha al final. */
export function pendientesDe(
  cargo: string,
  usuarioId: string,
  tickets: ResumenTicket[],
  esUrgente: (t: ResumenTicket) => boolean,
): ResumenTicket[] {
  return tickets
    .filter((t) => debeActuar(cargo, usuarioId, t, esUrgente))
    .sort(
      (a, b) =>
        (a.fechaLimite ?? '9999-12-31').localeCompare(b.fechaLimite ?? '9999-12-31') ||
        a.titulo.localeCompare(b.titulo, 'es'),
    );
}
