/**
 * Config y lógica pura de `sync-espn-uruguay` (puntos 4 y 9 de la agencia, 2026-09-30):
 * partidos de Peñarol y Nacional (jugadores solo-Contenido uruguayos) y de la selección
 * uruguaya, desde ESPN (gratis), y las copas de los 6 clubes de Match Day (2026-09-30, lista de
 * torneos de Gerardo: llegan meses antes que por API-Football → el ticket nace a tiempo).
 * Sin dependencias de Deno — testeable con `node --test`.
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
  clave: string;
  espnTeamId: string;
  /** `clubes.id_externo` (API-Football) de nuestro club; `null` para la selección. */
  clubAfId: string | null;
  esSeleccion: boolean;
  /** A quién se vincula: jugadores solo-Contenido (Uruguay) o de Match Day (copas). */
  servicio: 'contenido' | 'matchday';
  ligas: Array<{ slug: string; competencia: RefCompetencia }>;
}

export const URUGUAY_ESPN_ID = '212';

const LIGAS_CLUB: EquipoUruguay['ligas'] = [
  { slug: 'uru.1', competencia: { proveedor: 'espn', idExterno: 'uru.1' } },
  { slug: 'conmebol.libertadores', competencia: { proveedor: 'api-football', idExterno: '13' } },
  { slug: 'conmebol.sudamericana', competencia: { proveedor: 'api-football', idExterno: '11' } },
];

export const EQUIPOS_URUGUAY: EquipoUruguay[] = [
  { clave: 'penarol', espnTeamId: '2683', clubAfId: '2348', esSeleccion: false, servicio: 'contenido', ligas: LIGAS_CLUB },
  { clave: 'nacional', espnTeamId: '2684', clubAfId: '2356', esSeleccion: false, servicio: 'contenido', ligas: LIGAS_CLUB },
  {
    clave: 'uruguay',
    espnTeamId: URUGUAY_ESPN_ID,
    clubAfId: null,
    esSeleccion: true,
    servicio: 'contenido', // la selección no se vincula a nadie (convocatoria a mano, 0032)
    ligas: [
      { slug: 'fifa.friendly', competencia: { proveedor: 'espn', idExterno: 'fifa.friendly' } },
      { slug: 'fifa.worldq.conmebol', competencia: { proveedor: 'api-football', idExterno: '34' } },
      { slug: 'conmebol.america', competencia: { proveedor: 'espn', idExterno: 'conmebol.america' } },
      { slug: 'fifa.world', competencia: { proveedor: 'espn', idExterno: 'fifa.world' } },
    ],
  },
];

const af = (idExterno: string): RefCompetencia => ({ proveedor: 'api-football', idExterno });
const espn = (slug: string): RefCompetencia => ({ proveedor: 'espn', idExterno: slug });
const GLOBALES: EquipoUruguay['ligas'] = [
  { slug: 'fifa.cwc', competencia: espn('fifa.cwc') },
  { slug: 'fifa.intercontinental_cup', competencia: espn('fifa.intercontinental_cup') },
  // Amistosos de clubes (2026-10-05): ESPN a veces los publica antes que API-Football (ventana de 2 días).
  { slug: 'club.friendly', competencia: espn('club.friendly') },
];
const COPAS_MEXICO: EquipoUruguay['ligas'] = [
  { slug: 'mex.campeon', competencia: espn('mex.campeon') },
  { slug: 'concacaf.champions', competencia: af('16') },
  { slug: 'concacaf.leagues.cup', competencia: af('772') },
  { slug: 'campeones.cup', competencia: espn('campeones.cup') },
  ...GLOBALES,
];
const CONMEBOL: EquipoUruguay['ligas'] = [
  { slug: 'conmebol.libertadores', competencia: af('13') },
  { slug: 'conmebol.sudamericana', competencia: af('11') },
  { slug: 'conmebol.recopa', competencia: espn('conmebol.recopa') },
];

/**
 * Copas de los 6 clubes de Match Day (lista de torneos de Gerardo, 2026-09-30) — SOLO copas: las
 * ligas vienen de SportMonks. Ids de ESPN y de API-Football (`clubAfId`) los mismos que usaba
 * `sync-fixtures-espn`.
 */
export const EQUIPOS_COPAS_MD: EquipoUruguay[] = [
  { clave: 'toluca', espnTeamId: '223', clubAfId: '2281', esSeleccion: false, servicio: 'matchday', ligas: COPAS_MEXICO },
  { clave: 'atlante', espnTeamId: '226', clubAfId: '2312', esSeleccion: false, servicio: 'matchday', ligas: COPAS_MEXICO },
  {
    clave: 'bragantino', espnTeamId: '6079', clubAfId: '794', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'bra.copa_do_brazil', competencia: af('73') },
      { slug: 'bra.supercopa_do_brazil', competencia: espn('bra.supercopa_do_brazil') },
      { slug: 'bra.camp.paulista', competencia: espn('bra.camp.paulista') },
      ...CONMEBOL,
      ...GLOBALES,
    ],
  },
  {
    clave: 'colo-colo', espnTeamId: '2688', clubAfId: '2315', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'chi.copa_chi', competencia: af('267') },
      { slug: 'chi.super_cup', competencia: espn('chi.super_cup') },
      ...CONMEBOL,
      ...GLOBALES,
    ],
  },
  {
    clave: 'genk', espnTeamId: '938', clubAfId: '742', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'uefa.champions', competencia: espn('uefa.champions') },
      { slug: 'uefa.champions_qual', competencia: espn('uefa.champions') },
      { slug: 'uefa.europa', competencia: af('3') },
      { slug: 'uefa.europa_qual', competencia: af('3') },
      { slug: 'uefa.europa.conf', competencia: espn('uefa.europa.conf') },
      { slug: 'uefa.europa.conf_qual', competencia: espn('uefa.europa.conf') },
      ...GLOBALES,
    ],
  },
  {
    clave: 'al-qadisiyah', espnTeamId: '22022', clubAfId: '2933', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'ksa.kings.cup', competencia: af('504') },
      { slug: 'afc.champions', competencia: af('17') },
      { slug: 'afc.cup', competencia: af('18') },
      ...GLOBALES,
    ],
  },
];

/**
 * Todo lo que sincroniza la función. Primero las copas de Match Day (generan tickets): si la corrida
 * se queda sin tiempo, lo que se corta es Uruguay (informativo), no los tickets.
 */
export const EQUIPOS_ESPN: EquipoUruguay[] = [...EQUIPOS_COPAS_MD, ...EQUIPOS_URUGUAY];

/** Una tarea por equipo × liga, en el orden de la config. */
export function tareasDeSync(equipos: EquipoUruguay[] = EQUIPOS_ESPN) {
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
 * Jugadores a vincular por club, según el servicio del club: Contenido → activos solo-Contenido
 * (los de Match Day los trae SportMonks); Match Day → activos de Match Day (sus copas). Se
 * recalcula en cada corrida: si uno cambia de club, deja de vincularse.
 */
export function jugadoresPorClub(jugadores: JugadorSync[], servicioPorClub: Map<string, 'contenido' | 'matchday'>): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const j of jugadores) {
    if (!j.activo || !j.club_actual_id) continue;
    const servicio = servicioPorClub.get(j.club_actual_id);
    if (!servicio) continue;
    const va = servicio === 'matchday' ? j.servicio_match_day : j.servicio_contenido && !j.servicio_match_day;
    if (!va) continue;
    const lista = m.get(j.club_actual_id) ?? [];
    lista.push(j.id);
    m.set(j.club_actual_id, lista);
  }
  return m;
}

/** id de equipo de ESPN → uuid de nuestro club (Peñarol/Nacional). En un clásico, el rival
 *  se resuelve con esto y no se crea un club "ESPN 2684" duplicado. */
export function mapaCarteraEspn(clubIdPorAf: Map<string, string>, equipos: EquipoUruguay[] = EQUIPOS_ESPN): Map<string, string> {
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

/** Presupuesto de la corrida: las Edge Functions cortan a ~150 s; se para prolijo a los 120 s. */
export const PRESUPUESTO_MS = 120_000;

export function quedaTiempo(inicioMs: number, ahoraMs: number, presupuestoMs = PRESUPUESTO_MS): boolean {
  return ahoraMs - inicioMs < presupuestoMs;
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
