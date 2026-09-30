/**
 * Detección de cambio de club con SportMonks (reemplaza a API-Football `/transfers`, que para
 * 8 de 11 jugadores tenía el "último traspaso" viejo — hallazgo 2026-09-30). Lógica pura: no
 * hace fetch ni conoce Supabase; se testea con `node --test`.
 *
 * Fuente: `GET /players/{id}?include=teams.team` → los contratos del jugador. El club actual es
 * el de tipo `domestic` vigente hoy (inicio ≤ hoy ≤ fin, o sin fin); con dos vigentes (cesión)
 * gana el de inicio más reciente. La selección (`national`) no cuenta.
 *
 * Decisión de Gerardo (2026-09-30, opción 1): un cambio detectado NO se aplica solo — se avisa
 * (cartel del Administrador) y Mazdesign lo aplica, porque un club nuevo casi siempre necesita
 * cargar sus códigos para que sigan llegando los partidos.
 *
 * Football First. Creado 2026-09-30.
 */

/** Un contrato de `players/{id}?include=teams.team` (lo que se usa). */
export interface EquipoDeJugadorSM {
  team_id: number;
  start: string | null;
  end: string | null;
  team?: { name?: string | null; type?: string | null } | null;
}

export interface ClubActualSM {
  smId: string;
  nombre: string;
  /** Inicio del contrato vigente (≈ fecha del traspaso). */
  desde: string | null;
}

export type DeteccionSM =
  | { estado: 'igual' }
  | { estado: 'cambio'; hacia: string; haciaSmId: string; desde: string | null }
  | { estado: 'sin_dato' }
  | { estado: 'sin_codigo'; actual: string };

/** Club doméstico vigente hoy según SportMonks, o `null` si no hay ninguno. */
export function clubActualSportmonks(equipos: EquipoDeJugadorSM[] | null | undefined, hoyIso: string): ClubActualSM | null {
  const vigentes = (equipos ?? []).filter(
    (e) =>
      e.team?.type === 'domestic' &&
      (!e.start || e.start.slice(0, 10) <= hoyIso) &&
      (!e.end || e.end.slice(0, 10) >= hoyIso),
  );
  if (!vigentes.length) return null;
  vigentes.sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
  const e = vigentes[0];
  return { smId: String(e.team_id), nombre: e.team?.name ?? `SportMonks ${e.team_id}`, desde: e.start?.slice(0, 10) ?? null };
}

/**
 * Compara el club que tenemos guardado (su código de SportMonks) con el actual de SportMonks.
 * `sin_codigo`: nuestro club no tiene código de SportMonks → no se puede comparar (se avisa).
 */
export function detectarCambioSportmonks(clubGuardadoSmId: string | null, actual: ClubActualSM | null): DeteccionSM {
  if (!actual) return { estado: 'sin_dato' };
  if (!clubGuardadoSmId) return { estado: 'sin_codigo', actual: actual.nombre };
  if (clubGuardadoSmId === actual.smId) return { estado: 'igual' };
  return { estado: 'cambio', hacia: actual.nombre, haciaSmId: actual.smId, desde: actual.desde };
}
