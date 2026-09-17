/**
 * sync-partidos-sportmonks — reemplaza a `sync-fixtures-espn` para las 5 ligas domésticas del
 * plan Starter de SportMonks (Arabia, Liga MX, Brasileirão, Chile, Bélgica — avances.md,
 * sección "Evaluación SportMonks"). Trae el calendario completo de la temporada de cada uno
 * de los 6 clubes de la cartera Y, de yapa, la CONVOCATORIA real (`partidos_jugadores.convocado`)
 * desde `lineups` — el gap que ni API-Football free ni ESPN podían cerrar. También llena
 * `estadisticas_partido` (minutos/rating desde `lineups.details`, goles/asistencias/tarjetas
 * desde `events`) — `sync-estadisticas` (API-Football) nunca pudo procesar estas 5 ligas
 * (solo entiende ids de API-Football, y esas 5 ligas ya no generan partidos de esa fuente),
 * así que sin esto `temporada_actual`/`totales_jugador` quedaban vacíos para siempre en estas
 * ligas (hallazgo de Gerardo 2026-09-16 probando en vivo, Nacho Sosa/Bragantino).
 *
 * Copas/continentales de estos mismos 6 clubes (Leagues Cup, Concachampions, Libertadores,
 * etc.) NO se piden acá — el plan Starter no las cubre (solo 5 ligas domésticas) y siguen
 * viniendo de `sync-partidos` (API-Football), que fue ajustado para saltear estas 5 ligas y no
 * duplicar (ver `LIGAS_DOMESTICAS_SPORTMONKS` en `sync-partidos/index.ts`).
 *
 * A diferencia de ESPN (un fetch por evento), acá un solo endpoint por club
 * (`/fixtures/between/{desde}/{hasta}/{teamId}` con includes) trae TODO de una: equipos,
 * estado, sede y alineaciones — no hace falta el patrón "¿ya lo teníamos? ¿está en la ventana
 * corta?" de `sync-fixtures-espn`. Se refresca la temporada completa en cada corrida.
 *
 * Idempotente: upsert de `partidos` por (proveedor_externo='sportmonks', id_externo=<fixtureId>).
 * `partidos_jugadores.convocado` SÍ se pisa (a diferencia de `sync-partidos`/`sync-fixtures-espn`,
 * que lo dejan en null porque `sync-estadisticas` lo resuelve después): acá lo sabemos de
 * entrada y se actualiza a medida que SportMonks publica la convocatoria (~1h antes del
 * partido) — nunca se vuelve a poner en null un valor ya conocido.
 *
 * Disparo: `pg_cron` + `pg_net` (migración pendiente, se agenda recién cuando esto esté
 * desplegado y probado — ver avances.md) o manual con el header `x-sync-secret`. Deploy con
 * `--no-verify-jwt`, igual que el resto de los sync.
 *
 * Football First (Fase 1). Creado 2026-09-16 (migración a SportMonks).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { esperarEntreLlamadasSportmonks, obtenerFixturesDeEquipo, type FixtureSportmonks } from '../_shared/sportmonks.ts';
import { normalizarFixture, convocadoEnLineups, extraerEstadisticaSportmonks } from '../_shared/sportmonks-partido.ts';
import { zonaDePais } from '../_shared/zona-pais.ts';

const PROVEEDOR = 'sportmonks';
const NOVENTA_DIAS_MS = 90 * 86_400_000;
const VENTANA_ATRAS_DIAS = 3;
const VENTANA_ADELANTE_DIAS = 300; // una temporada de liga entra de sobra (mismo margen que sync-fixtures-espn)

/**
 * Los 6 clubes de la cartera, mapeados de su id de API-Football (como se guarda en
 * `clubes.id_externo`, la clave que arma la cartera) a lo que necesita SportMonks.
 * `ligaExternoAF` engancha `competencia_id` reusando las competencias ya catalogadas por
 * API-Football (mismos ids que `sync-fixtures-espn`, verificado en vivo 2026-09-16).
 */
const CLUBES_SPORTMONKS: Record<string, { smTeamId: string; smLeagueId: number; ligaExternoAF: string }> = {
  '742': { smTeamId: '2709', smLeagueId: 208, ligaExternoAF: '144' }, // Genk — Pro League (Bélgica)
  '2281': { smTeamId: '967', smLeagueId: 743, ligaExternoAF: '262' }, // Toluca — Liga MX
  '2312': { smTeamId: '7023', smLeagueId: 743, ligaExternoAF: '262' }, // Atlante — Liga MX
  '794': { smTeamId: '7808', smLeagueId: 648, ligaExternoAF: '71' }, // RB Bragantino — Serie A
  '2315': { smTeamId: '7930', smLeagueId: 663, ligaExternoAF: '265' }, // Colo-Colo — Primera División
  '2933': { smTeamId: '13092', smLeagueId: 944, ligaExternoAF: '307' }, // Al-Qadsiah (Nández) — Pro League (Arabia)
};

type JugadorDeCartera = { id: string; idSportmonks: string | null };
type ClubDeCartera = { clubId: string; zonaHoraria: string | null; jugadores: JugadorDeCartera[] };

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('SPORTMONKS_APIKEY')!;

  const iniciadoEn = new Date().toISOString();
  let registrosAfectados = 0;
  let errorDetalle: string | null = null;
  const clubesProcesados: string[] = [];
  const clubesConError: string[] = []; // un club que falla no tira abajo el resto de la cartera

  try {
    // 1) Cartera: jugadores de Match Day + su club actual (id_externo de API-Football, zona,
    //    y el id_externo_sportmonks de CADA JUGADOR para poder leer su convocatoria).
    const { data: jugadores, error: errJugadores } = await supabase
      .from('jugadores')
      .select('id, id_externo_sportmonks, clubes(id, id_externo, zona_horaria)')
      .eq('activo', true)
      .eq('servicio_match_day', true)
      .not('club_actual_id', 'is', null);
    if (errJugadores) throw errJugadores;

    const carteraPorExterno = new Map<string, ClubDeCartera>();
    for (const j of jugadores ?? []) {
      const club = j.clubes;
      if (!club?.id_externo) continue;
      const jugador: JugadorDeCartera = { id: j.id, idSportmonks: j.id_externo_sportmonks };
      const existente = carteraPorExterno.get(club.id_externo);
      if (existente) existente.jugadores.push(jugador);
      else carteraPorExterno.set(club.id_externo, { clubId: club.id, zonaHoraria: club.zona_horaria, jugadores: [jugador] });
    }
    if (carteraPorExterno.size === 0) {
      throw new Error('No hay jugadores activos con club + id_externo — nada que sincronizar.');
    }

    // Mapa inverso: id de equipo de SportMonks → uuid del club de la cartera (para no crear un
    // club rival duplicado cuando dos representados juegan entre sí, ej. Toluca vs Atlante).
    const carteraPorSmId = new Map<string, string>();
    for (const [afId, cfg] of Object.entries(CLUBES_SPORTMONKS)) {
      const club = carteraPorExterno.get(afId);
      if (club) carteraPorSmId.set(cfg.smTeamId, club.clubId);
    }

    // 2) Competencias catalogadas, por id_externo de API-Football (mismas que usa sync-partidos/sync-fixtures-espn).
    const { data: competencias, error: errCompetencias } = await supabase
      .from('competencias')
      .select('id, id_externo, pais');
    if (errCompetencias) throw errCompetencias;
    const competenciaIdPorExterno = new Map((competencias ?? []).map((c) => [c.id_externo, c.id]));
    const competenciaPaisPorExterno = new Map((competencias ?? []).map((c) => [c.id_externo, c.pais]));

    const ahora = new Date();
    const desdeIso = new Date(ahora.getTime() - VENTANA_ATRAS_DIAS * 86_400_000).toISOString().slice(0, 10);
    const hastaIso = new Date(ahora.getTime() + VENTANA_ADELANTE_DIAS * 86_400_000).toISOString().slice(0, 10);

    // 3) Por cada club de la cartera que tenemos mapeado a SportMonks.
    for (const [afId, cfg] of Object.entries(CLUBES_SPORTMONKS)) {
      const club = carteraPorExterno.get(afId);
      if (!club) continue; // ese club no está en la cartera activa

      try {
        const fixtures = await obtenerFixturesDeEquipo(apiKey, cfg.smTeamId, desdeIso, hastaIso);
        // Defensivo: el plan Starter debería traer solo la liga suscrita, pero si algún día
        // se cuela otra competencia del mismo equipo, se descarta acá — esas quedan a cargo
        // de API-Football/ESPN, no de acá.
        const propias = fixtures.filter((fx) => fx.league_id === cfg.smLeagueId);

        for (const fx of propias) {
          registrosAfectados += await sincronizarFixture(supabase, {
            fx,
            cfg,
            club,
            carteraPorSmId,
            competenciaId: competenciaIdPorExterno.get(cfg.ligaExternoAF) ?? null,
            competenciaPais: competenciaPaisPorExterno.get(cfg.ligaExternoAF) ?? null,
          });
        }
        clubesProcesados.push(cfg.smTeamId);
      } catch (e) {
        clubesConError.push(`${afId}/${cfg.smTeamId}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        console.error(`Club ${afId} (SportMonks ${cfg.smTeamId}) falló:`, e);
      }
      await esperarEntreLlamadasSportmonks();
    }
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(errorDetalle);
  }

  const huboFalla = errorDetalle !== null || clubesConError.length > 0;
  const estado = huboFalla ? (registrosAfectados > 0 ? 'parcial' : 'error') : 'ok';
  if (!errorDetalle && clubesConError.length) {
    errorDetalle = `${clubesConError.length} club(es) con error: ${clubesConError.join(' | ')}`;
  }

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'partidos',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado,
    registros_afectados: registrosAfectados,
    error_detalle: errorDetalle,
    parametros: { clubes_procesados: clubesProcesados, clubes_con_error: clubesConError },
  });

  return new Response(JSON.stringify({ estado, registrosAfectados, errorDetalle }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});

/**
 * Uuid interno de un club identificado por su id de equipo de SportMonks.
 *   1) Si es uno de nuestros 6 clubes de la cartera → su uuid real (evita duplicar). Ya tiene
 *      escudo (seed-escudos.mjs, vía su fila api-football), no hace falta tocarlo.
 *   2) Si ya lo creamos antes como club de SportMonks → ese; si le faltaba el escudo, se lo
 *      completa acá (`escudoUrl` sale gratis de `participants[].image_path`, sin llamada
 *      aparte) — `seed-escudos.mjs` no cubre `proveedor_externo='sportmonks'`.
 *   3) Si no → lo crea con proveedor_externo='sportmonks' y el escudo de una.
 */
async function asegurarClubSportmonks(
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

interface ContextoFixture {
  fx: FixtureSportmonks;
  cfg: { smTeamId: string; smLeagueId: number; ligaExternoAF: string };
  club: ClubDeCartera;
  carteraPorSmId: Map<string, string>;
  competenciaId: string | null;
  competenciaPais: string | null;
}

/** Upsert de un fixture + el puente con el/los representado(s), incluida la convocatoria. */
async function sincronizarFixture(
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
async function actualizarPuente(
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
