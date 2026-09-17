/**
 * sync-partidos-sportmonks — reemplaza a `sync-fixtures-espn` para las 5 ligas domésticas del
 * plan Starter de SportMonks (Arabia, Liga MX, Brasileirão, Chile, Bélgica — avances.md,
 * sección "Evaluación SportMonks"). Trae el calendario de cada uno de los 6 clubes de la
 * cartera Y, de yapa, la CONVOCATORIA real (`partidos_jugadores.convocado`) desde `lineups` —
 * el gap que ni API-Football free ni ESPN podían cerrar. También llena `estadisticas_partido`
 * (minutos/rating desde `lineups.details`, goles/asistencias/tarjetas desde `events`) —
 * `sync-estadisticas` (API-Football) nunca pudo procesar estas 5 ligas (solo entiende ids de
 * API-Football, y esas 5 ligas ya no generan partidos de esa fuente), así que sin esto
 * `temporada_actual`/`totales_jugador` quedaban vacíos para siempre en estas ligas (hallazgo
 * de Gerardo 2026-09-16 probando en vivo, Nacho Sosa/Bragantino).
 *
 * Copas/continentales de estos mismos 6 clubes (Leagues Cup, Concachampions, Libertadores,
 * etc.) NO se piden acá — el plan Starter no las cubre (solo 5 ligas domésticas) y siguen
 * viniendo de `sync-partidos` (API-Football), que fue ajustado para saltear estas 5 ligas y no
 * duplicar (ver `LIGAS_DOMESTICAS_SPORTMONKS` en `sync-partidos/index.ts`).
 *
 * Ventana CHICA a propósito (14 días atrás, 300 adelante): re-fetchear la temporada entera en
 * cada corrida diaria hace que los 6 clubes juntos superen el límite de ejecución del Edge
 * Function (150s, "IDLE_TIMEOUT" — verificado en vivo 2026-09-16 con una ventana de 300 días
 * atrás). El backfill histórico completo de la temporada es cosa de
 * `scripts/backfill-historico-sportmonks.mjs` (corre local, una sola vez, sin ese límite) — la
 * lógica de escritura (`_shared/sportmonks-sync-db.ts`) es la MISMA que usa esta función.
 *
 * Idempotente: upsert de `partidos` por (proveedor_externo='sportmonks', id_externo=<fixtureId>).
 *
 * Disparo: `pg_cron` + `pg_net` (migración pendiente, se agenda recién cuando esto esté
 * desplegado y probado — ver avances.md) o manual con el header `x-sync-secret`. Deploy con
 * `--no-verify-jwt`, igual que el resto de los sync.
 *
 * Football First (Fase 1). Creado 2026-09-16 (migración a SportMonks).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { esperarEntreLlamadasSportmonks, obtenerFixturesDeEquipo } from '../_shared/sportmonks.ts';
import {
  PROVEEDOR,
  CLUBES_SPORTMONKS,
  sincronizarFixture,
  type ClubDeCartera,
  type JugadorDeCartera,
} from '../_shared/sportmonks-sync-db.ts';

const VENTANA_ATRAS_DIAS = 14;
const VENTANA_ADELANTE_DIAS = 300; // una temporada de liga entra de sobra (mismo margen que sync-fixtures-espn)

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
