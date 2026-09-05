/**
 * sync-partidos — trae los próximos fixtures de los clubes de la cartera desde API-Football
 * y los deja en Postgres (`partidos` + `partidos_jugadores`). El frontend nunca llama a la
 * API externa: siempre lee de acá (vista `proximos_partidos`).
 *
 * Disparo: `pg_cron` + `pg_net` (`http_post`, agenda en la migración) o manual (curl) para
 * pruebas. Requiere el header `x-sync-secret` con el valor de `SYNC_FUNCTIONS_SECRET` — sin
 * eso, cualquiera con la URL podría gastar la cuota diaria de la API. Se deployea con
 * `--no-verify-jwt` porque quien llama no es un usuario con sesión, es pg_cron/nosotros.
 *
 * Estrategia de fixtures (ver `_shared/api-football.ts`): el plan free de API-Football no
 * da `next`/`last` por equipo ni `season` reciente. Se pide `GET /fixtures?date=` día por
 * día para una ventana de `SYNC_DIAS_ADELANTE` días, y se filtra del lado nuestro por los
 * clubes que tienen algún representado.
 *
 * Idempotente: upsert por `(proveedor_externo, id_externo)` — igual que los scripts de
 * seed, busca y decide insert/update a mano porque esos índices son parciales.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { obtenerFixturesDeVariosDias, type FixtureApiFootball } from '../_shared/api-football.ts';
import { mapearEstado } from '../_shared/estado-partido.ts';

const PROVEEDOR = 'api-football';
const NOVENTA_DIAS_MS = 90 * 86_400_000;

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('API_FOOTBALL_KEY')!;
  // ?dias= (pruebas manuales) gana sobre el secreto SYNC_DIAS_ADELANTE (lo que usa pg_cron).
  const diasQuery = new URL(req.url).searchParams.get('dias');
  const diasAdelante = Number(diasQuery ?? Deno.env.get('SYNC_DIAS_ADELANTE') ?? '5');

  const iniciadoEn = new Date().toISOString();
  let registrosAfectados = 0;
  let errorDetalle: string | null = null;
  let diasOmitidos: string[] = [];

  try {
    // 1) Nuestros jugadores activos, con el id_externo y la zona horaria de su club actual.
    const { data: jugadores, error: errJugadores } = await supabase
      .from('jugadores')
      .select('id, club_actual_id, clubes(id, id_externo, zona_horaria)')
      .eq('activo', true)
      .not('club_actual_id', 'is', null);
    if (errJugadores) throw errJugadores;

    type ClubDeCartera = { clubId: string; zonaHoraria: string | null; jugadorIds: string[] };
    const carteraPorExterno = new Map<string, ClubDeCartera>();
    for (const j of jugadores ?? []) {
      const club = j.clubes;
      if (!club?.id_externo) continue; // club sin id_externo -> no se puede cruzar con la API
      const existente = carteraPorExterno.get(club.id_externo);
      if (existente) existente.jugadorIds.push(j.id);
      else carteraPorExterno.set(club.id_externo, { clubId: club.id, zonaHoraria: club.zona_horaria, jugadorIds: [j.id] });
    }

    if (carteraPorExterno.size === 0) {
      throw new Error('No hay jugadores activos con club_actual_id + id_externo — nada que sincronizar.');
    }

    // 2) Competencias ya catalogadas (scripts/seed-competencias.mjs), por id_externo.
    const { data: competencias, error: errCompetencias } = await supabase
      .from('competencias')
      .select('id, id_externo');
    if (errCompetencias) throw errCompetencias;
    const competenciaIdPorExterno = new Map((competencias ?? []).map((c) => [c.id_externo, c.id]));

    // 3) Fixtures del mundo para la ventana de días, filtrados a los que tocan a la cartera.
    const resultadoFixtures = await obtenerFixturesDeVariosDias(apiKey, diasAdelante);
    const { fixtures } = resultadoFixtures;
    diasOmitidos = resultadoFixtures.diasOmitidos;
    const relevantes = fixtures.filter((fx) => {
      const home = String(fx.teams.home.id);
      const away = String(fx.teams.away.id);
      return carteraPorExterno.has(home) || carteraPorExterno.has(away);
    });

    for (const fx of relevantes) {
      registrosAfectados += await sincronizarFixture(supabase, fx, carteraPorExterno, competenciaIdPorExterno);
    }

    if (diasOmitidos.length) {
      console.log(`Días fuera de la ventana del plan (se saltearon, no es un error): ${diasOmitidos.join(', ')}`);
    }
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : String(e);
  }

  const estado = errorDetalle ? (registrosAfectados > 0 ? 'parcial' : 'error') : 'ok';

  // Bitácora — pase lo que pase, queda registro (contexto.md §7: nunca deja de responder 200
  // ni deja de loguear, y si algo falla no toca los datos ya escritos).
  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'partidos',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado,
    registros_afectados: registrosAfectados,
    error_detalle: errorDetalle,
    parametros: { dias_adelante: diasAdelante, dias_omitidos: diasOmitidos },
  });

  return new Response(JSON.stringify({ estado, registrosAfectados, errorDetalle, diasOmitidos }), {
    headers: { 'content-type': 'application/json' },
    status: 200, // el llamador (pg_net) no reintenta con reintento propio -> siempre 200
  });
});

/** Upsert de un club por (proveedor_externo, id_externo). Devuelve el uuid interno. */
async function asegurarClub(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  idExterno: string,
  nombre: string,
): Promise<{ id: string; zonaHoraria: string | null }> {
  const { data: existente, error: errBuscar } = await supabase
    .from('clubes')
    .select('id, zona_horaria')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', idExterno)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (existente) return { id: existente.id, zonaHoraria: existente.zona_horaria };

  const { data: creado, error: errCrear } = await supabase
    .from('clubes')
    .insert({ nombre, origen: 'api', proveedor_externo: PROVEEDOR, id_externo: idExterno })
    .select('id, zona_horaria')
    .single();
  if (errCrear) throw errCrear;
  return { id: creado.id, zonaHoraria: creado.zona_horaria };
}

/** Sincroniza un fixture: upsert de clubes + partido + partidos_jugadores. Devuelve cuántas filas tocó. */
async function sincronizarFixture(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  fx: FixtureApiFootball,
  carteraPorExterno: Map<string, { clubId: string; zonaHoraria: string | null; jugadorIds: string[] }>,
  competenciaIdPorExterno: Map<string, string>,
): Promise<number> {
  const homeExterno = String(fx.teams.home.id);
  const awayExterno = String(fx.teams.away.id);

  const clubLocal = await asegurarClub(supabase, homeExterno, fx.teams.home.name);
  const clubVisitante = await asegurarClub(supabase, awayExterno, fx.teams.away.name);

  // Hora de la sede: la del club local si la conocemos (nuestros 6 clubes la tienen desde el
  // seed; un rival recién descubierto no la trae de la API -> queda NULL, nunca inventada).
  const zonaHorariaEvento = clubLocal.zonaHoraria;

  const inicioUtc = fx.fixture.date;
  const tentativo = new Date(inicioUtc).getTime() - Date.now() > NOVENTA_DIAS_MS;
  const competenciaId = competenciaIdPorExterno.get(String(fx.league.id)) ?? null;

  const filaPartido = {
    competencia_id: competenciaId,
    club_local_id: clubLocal.id,
    club_visitante_id: clubVisitante.id,
    inicio_utc: inicioUtc,
    zona_horaria_evento: zonaHorariaEvento,
    estado: mapearEstado(fx.fixture.status.short),
    ronda: fx.league.round,
    estadio: fx.fixture.venue.name,
    ciudad: fx.fixture.venue.city,
    marcador_local: fx.goals.home,
    marcador_visitante: fx.goals.away,
    tentativo,
    origen: 'api',
    proveedor_externo: PROVEEDOR,
    id_externo: String(fx.fixture.id),
    payload_crudo: fx,
    sincronizado_en: new Date().toISOString(),
  };

  const { data: partidoExistente, error: errBuscarPartido } = await supabase
    .from('partidos')
    .select('id')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', filaPartido.id_externo)
    .maybeSingle();
  if (errBuscarPartido) throw errBuscarPartido;

  const { data: partido, error: errPartido } = partidoExistente
    ? await supabase.from('partidos').update(filaPartido).eq('id', partidoExistente.id).select('id').single()
    : await supabase.from('partidos').insert(filaPartido).select('id').single();
  if (errPartido) throw errPartido;

  // Puente partidos_jugadores: un representado por cada lado que sea "nuestro" (puede haber
  // 2, ej. Toluca vs Atlante). `ignoreDuplicates`: si la fila ya existe NO se pisa —
  // `sync-estadisticas` escribe `convocado` ahí y este job corre todos los días; sin esto
  // le borraría el dato en cada corrida.
  const cartera = [
    ...(carteraPorExterno.get(homeExterno)?.jugadorIds ?? []),
    ...(carteraPorExterno.get(awayExterno)?.jugadorIds ?? []),
  ];
  for (const jugadorId of cartera) {
    const { error: errPuente } = await supabase
      .from('partidos_jugadores')
      .upsert(
        { partido_id: partido.id, jugador_id: jugadorId, convocado: null, con_seleccion: false },
        { onConflict: 'partido_id,jugador_id', ignoreDuplicates: true },
      );
    if (errPuente) throw errPuente;
  }

  return 1;
}
