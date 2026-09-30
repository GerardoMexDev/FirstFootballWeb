/**
 * sync-espn-uruguay — próximos partidos de Peñarol y Nacional (liga uruguaya + Libertadores
 * + Sudamericana) para los jugadores solo-Contenido uruguayos, y de la selección uruguaya
 * (amistosos, Eliminatorias, Copa América, Mundial), desde el core API de ESPN (gratis).
 * Puntos 4 y 9 de la agencia (spec planeacion/specs/2026-09-30-espn-uruguay.md).
 *
 * Desde 2026-09-30 también las COPAS de los 6 clubes de Match Day (lista de torneos de Gerardo;
 * spec planeacion/specs/2026-09-30-copas-espn-y-estadios.md): llegan meses antes que por
 * API-Football, así el ticket automático nace a tiempo. Se vinculan a los jugadores de Match Day
 * del club (`servicio` de cada equipo en la config). El nombre de la función quedó por el deploy
 * y el cron ya hechos.
 *
 * Mismo esquema que `sync-fixtures-espn` (apagada desde 0016): upsert por
 * (proveedor_externo='espn', id_externo=<eventId>), ventana −3/+300 días, un evento o una liga
 * que falla se anota y se sigue. Los partidos de la selección van sin `partidos_jugadores`
 * (se ven por la vista `partidos_seleccion`, 0031).
 *
 * Disparo: pg_cron 07:00 UTC (0031) o manual con `x-sync-secret`. Deploy con --no-verify-jwt.
 * Football First. Creado 2026-09-30.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  esperarEntreLlamadasEspn,
  listarEventosDeTemporada,
  obtenerEstadoEvento,
  obtenerEvento,
  obtenerTemporadaVigente,
} from '../_shared/espn-api.ts';
import { mapearEstadoEspn, normalizarEvento, type EventoEspnCrudo } from '../_shared/espn-partido.ts';
import {
  EQUIPOS_ESPN,
  URUGUAY_ESPN_ID,
  claveCompetencia,
  jugadoresPorClub,
  mapaCarteraEspn,
  tareasDeSync,
  vinculosSobrantes,
  quedaTiempo,
  estadoDeCorrida,
  zonaDeSede,
  type JugadorSync,
} from '../_shared/espn-uruguay.ts';

const PROVEEDOR = 'espn';
const DIA_MS = 86_400_000;
const NOVENTA_DIAS_MS = 90 * DIA_MS;
const TRES_DIAS_MS = 3 * DIA_MS;

function aAAAAMMDD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).replaceAll('-', '');
}

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const iniciadoEn = new Date().toISOString();
  const inicioMs = Date.now();
  let registros = 0;
  let errorDetalle: string | null = null;
  const errores: string[] = [];
  const ligasOk: string[] = [];
  let ligasFallidas = 0;
  let desvinculados = 0;

  try {
    // 1) Nuestros clubes (Peñarol, Nacional) por id de API-Football, y el "club" Uruguay.
    const afIds = EQUIPOS_ESPN.map((e) => e.clubAfId).filter((x): x is string => x !== null);
    const { data: clubes, error: errClubes } = await supabase
      .from('clubes').select('id, id_externo').eq('proveedor_externo', 'api-football').in('id_externo', afIds);
    if (errClubes) throw errClubes;
    const clubIdPorAf = new Map((clubes ?? []).map((c) => [c.id_externo as string, c.id as string]));
    const { data: uy, error: errUy } = await supabase
      .from('clubes').select('id').eq('proveedor_externo', PROVEEDOR).eq('id_externo', URUGUAY_ESPN_ID).single();
    if (errUy) throw new Error(`Falta el club Uruguay (¿se aplicó 0031?): ${errUy.message}`);
    const carteraPorEspnId = mapaCarteraEspn(clubIdPorAf);
    carteraPorEspnId.set(URUGUAY_ESPN_ID, uy.id);

    // 2) Jugadores a vincular por club (solo-Contenido, activos).
    const { data: jugadores, error: errJug } = await supabase
      .from('jugadores').select('id, club_actual_id, activo, servicio_match_day, servicio_contenido');
    if (errJug) throw errJug;
    // Servicio de cada club nuestro: Peñarol/Nacional → Contenido; los 6 de Match Day → Match Day.
    const servicioPorClub = new Map<string, 'contenido' | 'matchday'>();
    for (const e of EQUIPOS_ESPN) {
      const uuid = e.clubAfId ? clubIdPorAf.get(e.clubAfId) : undefined;
      if (uuid) servicioPorClub.set(uuid, e.servicio);
    }
    const vinculos = jugadoresPorClub((jugadores ?? []) as JugadorSync[], servicioPorClub);

    // 3) Competencias por (proveedor, id_externo).
    const { data: comps, error: errComps } = await supabase.from('competencias').select('id, proveedor_externo, id_externo');
    if (errComps) throw errComps;
    const competenciaId = new Map(
      (comps ?? []).map((c) => [`${c.proveedor_externo}:${c.id_externo}`, c.id as string]),
    );

    const ahora = Date.now();
    const rango = `${aAAAAMMDD(new Date(ahora - TRES_DIAS_MS))}-${aAAAAMMDD(new Date(ahora + 300 * DIA_MS))}`;
    const temporada = new Map<string, number>();

    // 4) Por cada equipo × liga. Una liga que falla no corta las demás.
    for (const { equipo, slug, competencia } of tareasDeSync()) {
      // Sin tiempo: se corta prolijo (queda 'parcial' con lo salteado) antes del límite de la función.
      if (!quedaTiempo(inicioMs, Date.now())) {
        errores.push(`${equipo.clave}/${slug}: salteado (sin tiempo)`);
        ligasFallidas++;
        continue;
      }
      const nuestroClubId = carteraPorEspnId.get(equipo.espnTeamId);
      if (!nuestroClubId) {
        errores.push(`${equipo.clave}: club sin uuid (id_externo ${equipo.clubAfId})`);
        ligasFallidas++;
        continue;
      }
      try {
        let year = temporada.get(slug);
        if (year === undefined) {
          year = await obtenerTemporadaVigente(slug);
          temporada.set(slug, year);
          await esperarEntreLlamadasEspn();
        }
        const refs = await listarEventosDeTemporada(slug, year, equipo.espnTeamId, rango);
        await esperarEntreLlamadasEspn();
        for (const refEvento of refs) {
          try {
            await esperarEntreLlamadasEspn();
            const crudo = (await obtenerEvento(refEvento)) as unknown as EventoEspnCrudo;
            const p = normalizarEvento(crudo, equipo.espnTeamId);
            const inicioMs = p.inicioUtc ? new Date(p.inicioUtc).getTime() : null;
            if (inicioMs !== null && inicioMs < ahora - TRES_DIAS_MS) continue;

            let estado: ReturnType<typeof mapearEstadoEspn> = 'programado';
            if (inicioMs === null || inicioMs <= ahora) {
              if (p.statusRef) {
                await esperarEntreLlamadasEspn();
                estado = mapearEstadoEspn(await obtenerEstadoEvento(p.statusRef));
              } else {
                estado = 'sin_datos';
              }
            }

            const rivalClubId = await asegurarClubEspn(supabase, p.rivalEspnId, carteraPorEspnId, p.rivalNombre ?? `ESPN ${p.rivalEspnId}`);
            const { data: existente, error: errBuscar } = await supabase
              .from('partidos').select('id, estadio, ciudad, zona_horaria_evento')
              .eq('proveedor_externo', PROVEEDOR).eq('id_externo', p.eventoId).maybeSingle();
            if (errBuscar) throw errBuscar;

            const fila = {
              competencia_id: competenciaId.get(claveCompetencia(competencia)) ?? null,
              club_local_id: p.nuestroLado === 'local' ? nuestroClubId : rivalClubId,
              club_visitante_id: p.nuestroLado === 'local' ? rivalClubId : nuestroClubId,
              inicio_utc: p.inicioUtc,
              zona_horaria_evento: zonaDeSede(p.sedePais, slug) ?? existente?.zona_horaria_evento ?? null,
              estado,
              estadio: p.sedeNombre ?? existente?.estadio ?? null,
              ciudad: p.sedeCiudad ?? existente?.ciudad ?? null,
              tentativo: inicioMs !== null && inicioMs - ahora > NOVENTA_DIAS_MS,
              origen: 'api',
              proveedor_externo: PROVEEDOR,
              id_externo: p.eventoId,
              payload_crudo: crudo,
              sincronizado_en: new Date().toISOString(),
            };
            const { data: partido, error: errPartido } = existente
              ? await supabase.from('partidos').update(fila).eq('id', existente.id).select('id').single()
              : await supabase.from('partidos').insert(fila).select('id').single();
            if (errPartido) throw errPartido;

            // Puente con los uruguayos del club (la selección no lleva puente).
            if (!equipo.esSeleccion) {
              for (const jugadorId of vinculos.get(nuestroClubId) ?? []) {
                const { error: errPuente } = await supabase.from('partidos_jugadores').upsert(
                  { partido_id: partido.id, jugador_id: jugadorId, convocado: null, con_seleccion: false },
                  { onConflict: 'partido_id,jugador_id', ignoreDuplicates: true },
                );
                if (errPuente) throw errPuente;
              }
            }
            registros++;
          } catch (e) {
            errores.push(`${slug}/${refEvento.split('/events/')[1]?.split('?')[0]}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
          }
        }
        ligasOk.push(`${equipo.clave}/${slug}`);
      } catch (e) {
        errores.push(`${equipo.clave}/${slug}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        ligasFallidas++;
      }
    }

    // 5) Traspasos: se desvincula a quien ya no es del club de ninguno de los dos lados de un
    //    partido futuro de Peñarol/Nacional (si no, se vería "Boca vs Peñarol").
    const clubIds = [...clubIdPorAf.values()];
    if (clubIds.length) {
      const lista = clubIds.join(',');
      const { data: links, error: errLinks } = await supabase
        .from('partidos_jugadores')
        .select('partido_id, jugador_id, partidos!inner(proveedor_externo, inicio_utc, club_local_id, club_visitante_id)')
        .eq('con_seleccion', false)
        .eq('partidos.proveedor_externo', PROVEEDOR)
        .gt('partidos.inicio_utc', new Date().toISOString())
        .or(`club_local_id.in.(${lista}),club_visitante_id.in.(${lista})`, { referencedTable: 'partidos' });
      if (errLinks) throw errLinks;
      // deno-lint-ignore no-explicit-any
      const filas = (links ?? []).map((l: any) => ({
        partido_id: l.partido_id,
        jugador_id: l.jugador_id,
        club_local_id: l.partidos.club_local_id,
        club_visitante_id: l.partidos.club_visitante_id,
      }));
      for (const v of vinculosSobrantes(filas, vinculos)) {
        const { error: errDel } = await supabase
          .from('partidos_jugadores').delete().eq('partido_id', v.partido_id).eq('jugador_id', v.jugador_id).eq('con_seleccion', false);
        if (errDel) errores.push(`desvincular ${v.jugador_id}: ${errDel.message}`);
        else desvinculados++;
      }
    }
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(errorDetalle);
  }

  // Un evento suelto que falla no degrada la corrida (queda en parametros.errores); una liga sí.
  const estadoSync = estadoDeCorrida({ falloGeneral: errorDetalle !== null, ligasFallidas, guardados: registros });
  if (!errorDetalle && errores.length) errorDetalle = `${errores.length} error(es): ${errores.slice(0, 5).join(' | ')}`;

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'partidos',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado: estadoSync,
    registros_afectados: registros,
    error_detalle: errorDetalle,
    parametros: { alcance: 'uruguay', ligas: ligasOk, errores, desvinculados },
  });

  return new Response(JSON.stringify({ estado: estadoSync, registros, errorDetalle }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});

/** uuid de un club por su id de ESPN: nuestro (cartera/Uruguay), ya creado como espn, o lo crea. */
async function asegurarClubEspn(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  espnId: string,
  cartera: Map<string, string>,
  nombre: string,
): Promise<string> {
  const nuestro = cartera.get(espnId);
  if (nuestro) return nuestro;
  const { data: existente, error: errBuscar } = await supabase
    .from('clubes').select('id').eq('proveedor_externo', PROVEEDOR).eq('id_externo', espnId).maybeSingle();
  if (errBuscar) throw errBuscar;
  if (existente) return existente.id;
  const { data: creado, error: errCrear } = await supabase
    .from('clubes').insert({ nombre, origen: 'api', proveedor_externo: PROVEEDOR, id_externo: espnId }).select('id').single();
  if (errCrear) throw errCrear;
  return creado.id;
}
