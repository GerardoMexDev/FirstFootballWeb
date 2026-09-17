/**
 * Escritura en Supabase para la sincronización de SportMonks — compartida entre la Edge
 * Function `sync-partidos-sportmonks` (corrida diaria, ventana chica) y
 * `scripts/backfill-historico-sportmonks.mjs` (corrida única, ventana de la temporada
 * completa, corre local sin el límite de tiempo del Edge Function). Nada acá usa `Deno.*`
 * — solo toma un cliente de `@supabase/supabase-js` ya armado, así que Node lo importa
 * directo (mismo patrón ya probado con `_shared/sportmonks.ts` en esta sesión).
 *
 * Football First (Fase 1). Extraído de `sync-partidos-sportmonks/index.ts` 2026-09-16 para
 * evitar duplicar esta lógica en el script de backfill.
 */
import { normalizarFixture, convocadoEnLineups, extraerEstadisticaSportmonks } from './sportmonks-partido.ts';
import { zonaDePais } from './zona-pais.ts';
import type { FixtureSportmonks } from './sportmonks.ts';

export const PROVEEDOR = 'sportmonks';
const NOVENTA_DIAS_MS = 90 * 86_400_000;

/**
 * Los 6 clubes de la cartera, mapeados de su id de API-Football (como se guarda en
 * `clubes.id_externo`, la clave que arma la cartera) a lo que necesita SportMonks.
 * `ligaExternoAF` engancha `competencia_id` reusando las competencias ya catalogadas por
 * API-Football (mismos ids que `sync-fixtures-espn`, verificado en vivo 2026-09-16).
 */
export const CLUBES_SPORTMONKS: Record<string, { smTeamId: string; smLeagueId: number; ligaExternoAF: string }> = {
  '742': { smTeamId: '2709', smLeagueId: 208, ligaExternoAF: '144' }, // Genk — Pro League (Bélgica)
  '2281': { smTeamId: '967', smLeagueId: 743, ligaExternoAF: '262' }, // Toluca — Liga MX
  '2312': { smTeamId: '7023', smLeagueId: 743, ligaExternoAF: '262' }, // Atlante — Liga MX
  '794': { smTeamId: '7808', smLeagueId: 648, ligaExternoAF: '71' }, // RB Bragantino — Serie A
  '2315': { smTeamId: '7930', smLeagueId: 663, ligaExternoAF: '265' }, // Colo-Colo — Primera División
  '2933': { smTeamId: '13092', smLeagueId: 944, ligaExternoAF: '307' }, // Al-Qadsiah (Nández) — Pro League (Arabia)
};

export type JugadorDeCartera = { id: string; idSportmonks: string | null };
export type ClubDeCartera = { clubId: string; zonaHoraria: string | null; jugadores: JugadorDeCartera[] };

/**
 * Uuid interno de un club identificado por su id de equipo de SportMonks.
 *   1) Si es uno de nuestros 6 clubes de la cartera → su uuid real (evita duplicar). Ya tiene
 *      escudo (seed-escudos.mjs, vía su fila api-football), no hace falta tocarlo.
 *   2) Si ya lo creamos antes como club de SportMonks → ese; si le faltaba el escudo, se lo
 *      completa acá (`escudoUrl` sale gratis de `participants[].image_path`, sin llamada
 *      aparte) — `seed-escudos.mjs` no cubre `proveedor_externo='sportmonks'`.
 *   3) Si no → lo crea con proveedor_externo='sportmonks' y el escudo de una.
 */
export async function asegurarClubSportmonks(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  smId: string,
  carteraPorSmId: Map<string, string>,
  nombre: string,
  escudoUrl: string | null,
): Promise<string> {
  const deCartera = carteraPorSmId.get(smId);
  if (deCartera) return deCartera;

  const { data: existente, error: errBuscar } = await supabase
    .from('clubes')
    .select('id, escudo_url')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', smId)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  if (existente) {
    if (!existente.escudo_url && escudoUrl) {
      const { error: errUpd } = await supabase.from('clubes').update({ escudo_url: escudoUrl }).eq('id', existente.id);
      if (errUpd) throw errUpd;
    }
    return existente.id;
  }

  const { data: creado, error: errCrear } = await supabase
    .from('clubes')
    .insert({ nombre, origen: 'api', proveedor_externo: PROVEEDOR, id_externo: smId, escudo_url: escudoUrl })
    .select('id')
    .single();
  if (errCrear) throw errCrear;
  return creado.id;
}

export interface ContextoFixture {
  fx: FixtureSportmonks;
  cfg: { smTeamId: string; smLeagueId: number; ligaExternoAF: string };
  club: ClubDeCartera;
  carteraPorSmId: Map<string, string>;
  competenciaId: string | null;
  competenciaPais: string | null;
}

/**
 * Upsert de un fixture + el puente con el/los representado(s) (convocatoria) + estadísticas
 * del partido. Devuelve cuántas filas tocó.
 */
export async function sincronizarFixture(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ctx: ContextoFixture,
): Promise<number> {
  const { fx, cfg, club, carteraPorSmId, competenciaId, competenciaPais } = ctx;
  const p = normalizarFixture(fx, cfg.smTeamId);

  const rivalNombre = p.rivalNombre ?? `SportMonks ${p.rivalId}`;
  const rivalClubId = await asegurarClubSportmonks(supabase, p.rivalId, carteraPorSmId, rivalNombre, p.rivalEscudoUrl);
  const nuestroClubId = club.clubId;

  const clubLocalId = p.nuestroLado === 'local' ? nuestroClubId : rivalClubId;
  const clubVisitanteId = p.nuestroLado === 'local' ? rivalClubId : nuestroClubId;

  // Liga doméstica: la sede está siempre en el país de la liga → la zona de NUESTRO club
  // (que juega en ese país) es la fuente más confiable; zona-por-país queda de respaldo.
  const zona = club.zonaHoraria ?? zonaDePais(competenciaPais) ?? null;

  const inicioMs = p.inicioUtc ? new Date(p.inicioUtc).getTime() : null;
  const tentativo = inicioMs !== null && inicioMs - Date.now() > NOVENTA_DIAS_MS;

  const { data: existente, error: errBuscar } = await supabase
    .from('partidos')
    .select('id, estadio, ciudad, zona_horaria_evento')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', p.fixtureId)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  const fila = {
    competencia_id: competenciaId,
    club_local_id: clubLocalId,
    club_visitante_id: clubVisitanteId,
    inicio_utc: p.inicioUtc,
    // estadio/ciudad/zona solo MEJORAN: no se pisan con NULL si ya los teníamos (mismo
    // criterio que sync-partidos y sync-fixtures-espn).
    zona_horaria_evento: zona ?? existente?.zona_horaria_evento ?? null,
    estado: p.estado,
    estadio: p.sedeNombre ?? existente?.estadio ?? null,
    ciudad: p.sedeCiudad ?? existente?.ciudad ?? null,
    tentativo,
    origen: 'api',
    proveedor_externo: PROVEEDOR,
    id_externo: p.fixtureId,
    payload_crudo: fx,
    sincronizado_en: new Date().toISOString(),
  };

  const { data: partido, error: errPartido } = existente
    ? await supabase.from('partidos').update(fila).eq('id', existente.id).select('id').single()
    : await supabase.from('partidos').insert(fila).select('id').single();
  if (errPartido) throw errPartido;

  let filasTocadas = 1;
  for (const jugador of club.jugadores) {
    const smId = jugador.idSportmonks;
    const convocado = convocadoEnLineups(fx.lineups, smId ?? '');
    filasTocadas += await actualizarPuente(supabase, partido.id, jugador.id, convocado);

    // Estadísticas del partido (goles/asistencias/tarjetas/minutos/rating): cierra el hueco
    // que dejaba sync-estadisticas (solo entiende ids de API-Football) para estas 5 ligas
    // (avances.md, hallazgo de Gerardo 2026-09-16 con Nacho Sosa/Bragantino).
    if (smId) {
      const lineupDelJugador = (fx.lineups ?? []).find((l) => l.player_id === Number(smId));
      if (lineupDelJugador) {
        const estadistica = extraerEstadisticaSportmonks(lineupDelJugador, fx.events, smId);
        if (estadistica) {
          const { error: errStat } = await supabase.from('estadisticas_partido').upsert(
            {
              partido_id: partido.id,
              jugador_id: jugador.id,
              ...estadistica,
              origen: 'api',
              proveedor_externo: PROVEEDOR,
              payload_crudo: { lineup: lineupDelJugador },
              sincronizado_en: new Date().toISOString(),
            },
            { onConflict: 'partido_id,jugador_id' },
          );
          if (errStat) throw errStat;
          filasTocadas += 1;
        }
      }
    }
  }

  return filasTocadas;
}

/**
 * Upsert manual del puente jugador-partido. A diferencia de `sync-partidos`/`sync-fixtures-espn`
 * (que insertan `convocado: null` y nunca lo tocan de nuevo — `sync-estadisticas` lo resuelve
 * después), acá SÍ sabemos la convocatoria de entrada y se actualiza en corridas sucesivas a
 * medida que SportMonks la publica. Nunca se pisa un valor ya conocido con `null` (todavía sin
 * publicar en esta corrida puntual no significa "se borró").
 */
export async function actualizarPuente(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  partidoId: string,
  jugadorId: string,
  convocado: boolean | null,
): Promise<number> {
  const { data: existente, error: errBuscar } = await supabase
    .from('partidos_jugadores')
    .select('convocado')
    .eq('partido_id', partidoId)
    .eq('jugador_id', jugadorId)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  if (!existente) {
    const { error } = await supabase
      .from('partidos_jugadores')
      .insert({ partido_id: partidoId, jugador_id: jugadorId, convocado, con_seleccion: false });
    if (error) throw error;
    return 1;
  }

  if (convocado !== null && existente.convocado !== convocado) {
    const { error } = await supabase
      .from('partidos_jugadores')
      .update({ convocado })
      .eq('partido_id', partidoId)
      .eq('jugador_id', jugadorId);
    if (error) throw error;
    return 1;
  }

  return 0;
}
