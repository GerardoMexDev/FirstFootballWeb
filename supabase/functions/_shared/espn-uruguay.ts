/**
 * Config y lógica pura de `sync-espn-uruguay` (puntos 4 y 9 de la agencia, 2026-09-30):
 * partidos de Peñarol y Nacional (jugadores solo-Contenido uruguayos) y de la selección
 * uruguaya, desde ESPN (gratis). Sin dependencias de Deno — testeable con `node --test`.
 *
 * Ids de ESPN verificados en vivo 2026-09-30: Peñarol 2683, Nacional 2684, Uruguay 212.
 * `clubAfId` es el `clubes.id_externo` (API-Football) de nuestro club, clave estable para
 * encontrar su uuid. Las competencias que ya existían se referencian por su id de
 * API-Football; las nuevas las siembra la migración 0031 con `proveedor_externo='espn'`.
 *
 * Football First. Creado 2026-09-30.
 */
import { zonaDePais } from './zona-pais.ts';

export type RefCompetencia = { proveedor: 'api-football' | 'espn'; idExterno: string };

export interface EquipoUruguay {
  clave: 'penarol' | 'nacional' | 'uruguay';
  espnTeamId: string;
  /** `clubes.id_externo` (API-Football) de nuestro club; `null` para la selección. */
  clubAfId: string | null;
  esSeleccion: boolean;
  ligas: Array<{ slug: string; competencia: RefCompetencia }>;
}

export const URUGUAY_ESPN_ID = '212';

const LIGAS_CLUB: EquipoUruguay['ligas'] = [
  { slug: 'uru.1', competencia: { proveedor: 'espn', idExterno: 'uru.1' } },
  { slug: 'conmebol.libertadores', competencia: { proveedor: 'api-football', idExterno: '13' } },
  { slug: 'conmebol.sudamericana', competencia: { proveedor: 'api-football', idExterno: '11' } },
];

export const EQUIPOS_URUGUAY: EquipoUruguay[] = [
  { clave: 'penarol', espnTeamId: '2683', clubAfId: '2348', esSeleccion: false, ligas: LIGAS_CLUB },
  { clave: 'nacional', espnTeamId: '2684', clubAfId: '2356', esSeleccion: false, ligas: LIGAS_CLUB },
  {
    clave: 'uruguay',
    espnTeamId: URUGUAY_ESPN_ID,
    clubAfId: null,
    esSeleccion: true,
    ligas: [
      { slug: 'fifa.friendly', competencia: { proveedor: 'espn', idExterno: 'fifa.friendly' } },
      { slug: 'fifa.worldq.conmebol', competencia: { proveedor: 'api-football', idExterno: '34' } },
      { slug: 'conmebol.america', competencia: { proveedor: 'espn', idExterno: 'conmebol.america' } },
      { slug: 'fifa.world', competencia: { proveedor: 'espn', idExterno: 'fifa.world' } },
    ],
  },
];

/** Una tarea por equipo × liga, en el orden de la config. */
export function tareasDeSync(equipos: EquipoUruguay[] = EQUIPOS_URUGUAY) {
  return equipos.flatMap((equipo) => equipo.ligas.map(({ slug, competencia }) => ({ equipo, slug, competencia })));
}

export function claveCompetencia(ref: RefCompetencia): string {
  return `${ref.proveedor}:${ref.idExterno}`;
}

export type JugadorSync = {
  id: string;
  club_actual_id: string | null;
  activo: boolean;
  servicio_match_day: boolean;
  servicio_contenido: boolean;
};

/**
 * Jugadores a vincular por club: activos, de Contenido y NO de Match Day (los de Match Day ya
 * los trae SportMonks). Se recalcula en cada corrida: si uno cambia de club, deja de vincularse.
 */
export function jugadoresPorClub(jugadores: JugadorSync[], clubIds: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const j of jugadores) {
    if (!j.activo || j.servicio_match_day || !j.servicio_contenido || !j.club_actual_id) continue;
    if (!clubIds.includes(j.club_actual_id)) continue;
    const lista = m.get(j.club_actual_id) ?? [];
    lista.push(j.id);
    m.set(j.club_actual_id, lista);
  }
  return m;
}

/** id de equipo de ESPN → uuid de nuestro club (Peñarol/Nacional). En un clásico, el rival
 *  se resuelve con esto y no se crea un club "ESPN 2684" duplicado. */
export function mapaCarteraEspn(clubIdPorAf: Map<string, string>, equipos: EquipoUruguay[] = EQUIPOS_URUGUAY): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of equipos) {
    const uuid = e.clubAfId ? clubIdPorAf.get(e.clubAfId) : undefined;
    if (uuid) m.set(e.espnTeamId, uuid);
  }
  return m;
}

/** Zona de la sede: por país; `uru.1` se juega en Uruguay; si no se sabe, `null` (nunca se inventa). */
export function zonaDeSede(sedePais: string | null, slug: string): string | null {
  return zonaDePais(sedePais) ?? (slug === 'uru.1' ? 'America/Montevideo' : null);
}

/**
 * Vínculos jugador↔partido que sobran: el jugador ya no es del club (traspaso) de NINGUNO de los
 * dos lados del partido. En un clásico cada uno sigue vinculado por su club. Sin esto, tras un
 * traspaso sus partidos viejos se verían con el club nuevo ("Boca vs Peñarol").
 */
export function vinculosSobrantes(
  filas: Array<{ partido_id: string; jugador_id: string; club_local_id: string | null; club_visitante_id: string | null }>,
  vigentes: Map<string, string[]>,
): Array<{ partido_id: string; jugador_id: string }> {
  return filas
    .filter((f) => {
      const deLocal = f.club_local_id ? (vigentes.get(f.club_local_id) ?? []) : [];
      const deVisita = f.club_visitante_id ? (vigentes.get(f.club_visitante_id) ?? []) : [];
      return !deLocal.includes(f.jugador_id) && !deVisita.includes(f.jugador_id);
    })
    .map(({ partido_id, jugador_id }) => ({ partido_id, jugador_id }));
}

/**
 * Estado de la corrida para la bitácora (y el cartel del Administrador, que avisa si no es 'ok'):
 * un evento suelto que falla NO la degrada (queda anotado en `parametros.errores`); una liga que
 * no respondió o un fallo general sí.
 */
export function estadoDeCorrida(r: { falloGeneral: boolean; ligasFallidas: number; guardados: number }): 'ok' | 'parcial' | 'error' {
  if (!r.falloGeneral && r.ligasFallidas === 0) return 'ok';
  return r.guardados > 0 ? 'parcial' : 'error';
}
