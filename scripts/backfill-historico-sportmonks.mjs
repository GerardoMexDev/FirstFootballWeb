/**
 * Backfill histórico UNA SOLA VEZ de la temporada completa de SportMonks para los 6 clubes de
 * la cartera — partidos ya jugados, convocatoria y estadísticas (goles/asistencias/tarjetas/
 * minutos/rating). Reusa la MISMA lógica de escritura que `sync-partidos-sportmonks`
 * (`supabase/functions/_shared/sportmonks-sync-db.ts`), corriendo local para no toparse con el
 * límite de ejecución del Edge Function (150s — con ±300 días la corrida de los 6 clubes lo
 * supera, verificado en vivo 2026-09-16).
 *
 * Después de este backfill, la Edge Function `sync-partidos-sportmonks` (ventana chica, 14
 * días atrás) mantiene todo al día sin volver a necesitar esto — es un backfill de una vez,
 * no un cron.
 *
 * Uso: node scripts/backfill-historico-sportmonks.mjs   (o: npm run backfill:sportmonks)
 */
import { createClient } from '@supabase/supabase-js';
import { obtenerFixturesDeEquipo, esperarEntreLlamadasSportmonks } from '../supabase/functions/_shared/sportmonks.ts';
import { CLUBES_SPORTMONKS, sincronizarFixture } from '../supabase/functions/_shared/sportmonks-sync-db.ts';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPORTMONKS_APIKEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY || !SPORTMONKS_APIKEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY o SPORTMONKS_APIKEY en .secretos/.env');
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const VENTANA_ATRAS_DIAS = 400; // cubre de sobra la temporada actual de cualquiera de las 5 ligas
const VENTANA_ADELANTE_DIAS = 300;

// 1) Cartera: misma consulta que sync-partidos-sportmonks/index.ts.
const { data: jugadores, error: errJugadores } = await supabase
  .from('jugadores')
  .select('id, id_externo_sportmonks, clubes(id, id_externo, zona_horaria)')
  .eq('activo', true)
  .eq('servicio_match_day', true)
  .not('club_actual_id', 'is', null);
if (errJugadores) throw errJugadores;

const carteraPorExterno = new Map();
for (const j of jugadores ?? []) {
  const club = j.clubes;
  if (!club?.id_externo) continue;
  const jugador = { id: j.id, idSportmonks: j.id_externo_sportmonks };
  const existente = carteraPorExterno.get(club.id_externo);
  if (existente) existente.jugadores.push(jugador);
  else carteraPorExterno.set(club.id_externo, { clubId: club.id, zonaHoraria: club.zona_horaria, jugadores: [jugador] });
}
if (carteraPorExterno.size === 0) throw new Error('No hay jugadores activos con club + id_externo.');

const carteraPorSmId = new Map();
for (const [afId, cfg] of Object.entries(CLUBES_SPORTMONKS)) {
  const club = carteraPorExterno.get(afId);
  if (club) carteraPorSmId.set(cfg.smTeamId, club.clubId);
}

// 2) Competencias catalogadas, por id_externo de API-Football.
const { data: competencias, error: errCompetencias } = await supabase
  .from('competencias')
  .select('id, id_externo, pais');
if (errCompetencias) throw errCompetencias;
const competenciaIdPorExterno = new Map((competencias ?? []).map((c) => [c.id_externo, c.id]));
const competenciaPaisPorExterno = new Map((competencias ?? []).map((c) => [c.id_externo, c.pais]));

const ahora = new Date();
const desdeIso = new Date(ahora.getTime() - VENTANA_ATRAS_DIAS * 86_400_000).toISOString().slice(0, 10);
const hastaIso = new Date(ahora.getTime() + VENTANA_ADELANTE_DIAS * 86_400_000).toISOString().slice(0, 10);
console.log(`Ventana: ${desdeIso} .. ${hastaIso}\n`);

let registrosAfectados = 0;
const resumen = [];

for (const [afId, cfg] of Object.entries(CLUBES_SPORTMONKS)) {
  const club = carteraPorExterno.get(afId);
  if (!club) {
    console.log(`· club ${afId}: no está en la cartera activa, se saltea`);
    continue;
  }

  const fixtures = await obtenerFixturesDeEquipo(SPORTMONKS_APIKEY, cfg.smTeamId, desdeIso, hastaIso);
  const propias = fixtures.filter((fx) => fx.league_id === cfg.smLeagueId);
  console.log(`${cfg.smTeamId} (club ${afId}): ${propias.length} fixtures en la ventana`);

  let afectadosDelClub = 0;
  for (const fx of propias) {
    afectadosDelClub += await sincronizarFixture(supabase, {
      fx,
      cfg,
      club,
      carteraPorSmId,
      competenciaId: competenciaIdPorExterno.get(cfg.ligaExternoAF) ?? null,
      competenciaPais: competenciaPaisPorExterno.get(cfg.ligaExternoAF) ?? null,
    });
  }
  registrosAfectados += afectadosDelClub;
  resumen.push(`${cfg.smTeamId}: ${propias.length} fixtures, ${afectadosDelClub} filas`);
  await esperarEntreLlamadasSportmonks();
}

await supabase.from('sincronizaciones').insert({
  proveedor: 'sportmonks',
  recurso: 'partidos',
  iniciado_en: ahora.toISOString(),
  finalizado_en: new Date().toISOString(),
  estado: 'ok',
  registros_afectados: registrosAfectados,
  error_detalle: null,
  parametros: { tipo: 'backfill_historico', ventana_dias: [VENTANA_ATRAS_DIAS, VENTANA_ADELANTE_DIAS], resumen },
});

console.log(`\n✅ Backfill completo: ${registrosAfectados} filas afectadas en total.\n${resumen.join('\n')}`);
