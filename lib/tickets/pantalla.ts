/**
 * Lógica de la pantalla Tickets (spec 2026-09-29-pantalla-tickets.md): quién ve qué, urgencia
 * (vencido / por vencer / al día), conteos para los contadores, filtros y textos de creación.
 * Puro: solo luxon y tipos (los tests corren con node --test, donde `@/` no resuelve).
 *
 * Football First. Creado 2026-09-29.
 */
import { DateTime } from 'luxon';
import type { EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

export type Urgencia = 'vencido' | 'por_vencer' | 'al_dia';
export type FiltroEstado = 'abiertos' | 'cerrados' | 'todos';

/** "Por vencer" = vence hoy, mañana o pasado mañana (decisión de Gerardo 2026-09-29). */
export const DIAS_POR_VENCER = 2;

const ZONA = 'America/Montevideo';
const ABIERTOS: EstadoTicket[] = ['pendiente', 'en_revision', 'aprobado'];

export function esAbierto(estado: EstadoTicket): boolean {
  return ABIERTOS.includes(estado);
}

/**
 * Admin y Diseñador ven todos; el CM, los que creó; el resto, ninguno. Es foco de pantalla,
 * no seguridad: la RLS (0025) ya deja leer tickets a todo usuario activo.
 */
export function visiblesPara(cargo: string, usuarioId: string, tickets: ResumenTicket[]): ResumenTicket[] {
  if (cargo === 'Administrador' || cargo === 'Diseñador') return tickets;
  if (cargo === 'Community Manager') return tickets.filter((t) => t.creadoPor === usuarioId);
  return [];
}

/** Días civiles de `hoyUy` a `dia` (ambos yyyy-mm-dd); negativo si ya pasó. */
function diasHasta(dia: string, hoyUy: string): number {
  return Math.round(DateTime.fromISO(dia, { zone: 'utc' }).diff(DateTime.fromISO(hoyUy, { zone: 'utc' }), 'days').days);
}

/**
 * `null` para cerrados (no cuentan). Aprobado o sin fecha límite → al día (ya se entregó, o
 * no hay contra qué vencer). Pendiente / en revisión según la fecha límite.
 */
export function urgencia(t: ResumenTicket, hoyUy: string): Urgencia | null {
  if (!esAbierto(t.estado)) return null;
  if (t.estado === 'aprobado' || !t.fechaLimite) return 'al_dia';
  const dias = diasHasta(t.fechaLimite, hoyUy);
  if (dias < 0) return 'vencido';
  if (dias <= DIAS_POR_VENCER) return 'por_vencer';
  return 'al_dia';
}

export function contarUrgencias(tickets: ResumenTicket[], hoyUy: string): Record<Urgencia, number> {
  const cuenta: Record<Urgencia, number> = { vencido: 0, por_vencer: 0, al_dia: 0 };
  for (const t of tickets) {
    const u = urgencia(t, hoyUy);
    if (u) cuenta[u] += 1;
  }
  return cuenta;
}

/**
 * Con urgencia elegida manda la urgencia (que ya deja afuera a los cerrados); si no, el
 * filtro de estado. Respeta el orden recibido (del más nuevo al más viejo).
 */
export function filtrarPantalla(
  tickets: ResumenTicket[],
  f: { estado: FiltroEstado; urgencia: Urgencia | null },
  hoyUy: string,
): ResumenTicket[] {
  return tickets.filter((t) => {
    if (f.urgencia) return urgencia(t, hoyUy) === f.urgencia;
    if (f.estado === 'abiertos') return esAbierto(t.estado);
    if (f.estado === 'cerrados') return !esAbierto(t.estado);
    return true;
  });
}

/** "hoy" / "ayer" / "hace 3 días" / "hace 2 semanas" / "hace 2 meses", por día de Uruguay. */
export function haceCuanto(iso: string, ahoraIso: string): string {
  const dia = DateTime.fromISO(iso, { zone: 'utc' }).setZone(ZONA).startOf('day');
  const hoy = DateTime.fromISO(ahoraIso, { zone: 'utc' }).setZone(ZONA).startOf('day');
  const dias = Math.round(hoy.diff(dia, 'days').days);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  return `hace ${Math.floor(dias / 30)} meses`;
}

export function textoCreado(t: ResumenTicket, ahoraIso: string): string {
  return `Creado por ${t.creadoPorNombre ?? 'alguien del equipo'} · ${haceCuanto(t.creadoEn, ahoraIso)}`;
}
