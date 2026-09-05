/**
 * sync-estadisticas — después de que un partido de la cartera termina, trae la línea de
 * estadísticas de cada representado (`GET /fixtures/players`) y la deja en
 * `estadisticas_partido`. Eso alimenta la vista `totales_jugador` (base manual + lo
 * sincronizado) y con eso el motor de hitos se actualiza solo, sin tocar el Excel.
 *
 * También marca `partidos_jugadores.convocado` (apareció en la planilla => estuvo al menos
 * en el banco; no apareció => no figuró) y, de paso, corrige `partidos.estado` y el marcador
 * si `sync-partidos` ya no los estaba viendo (su ventana de fechas es corta en el plan free).
 *
 * `convocado IS NULL` = todavía sin procesar para ese (partido, jugador). Al procesarlo queda
 * `true` o `false`, así deja de ser candidato. Por eso `sync-partidos` fue ajustado para NO
 * pisar `convocado` en sus corridas diarias (upsert con `ignoreDuplicates`).
 *
 * Alcance Fase 1: solo suma a CARRERA. Los fixtures de club tienen `con_seleccion=false`;
 * los partidos de selección todavía no se sincronizan, así que esas stats siguen viniendo
 * de la base (`jugadores.seleccion_*_base`).
 *
 * Endpoints usados, todos OK en el plan free (verificado):
 *   GET /fixtures?id=            -> estado + marcador de un fixture puntual
 *   GET /fixtures/players?fixture= -> planilla de stats por jugador
 *
 * Disparo: `pg_cron` (migración 0006) o curl con `x-sync-secret`. `?max=` limita cuántos
 * partidos procesa (pruebas). Deploy con `--no-verify-jwt`.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  esperarEntreLlamadas,
  obtenerFixturePorId,
  obtenerJugadoresDeFixture,
} from '../_shared/api-football.ts';
import { mapearEstado } from '../_shared/estado-partido.ts';
import { extraerLineaJugador } from '../_shared/estadisticas.ts';

const PROVEEDOR = 'api-football';
const DIAS_VENTANA = 15; // no se re-intenta un partido más viejo que esto
const MAX_PARTIDOS_POR_CORRIDA = 8; // ~2 llamadas c/u; el resto espera a la próxima corrida
const FINALIZADOS = new Set(['FT', 'AET', 'PEN']);

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('API_FOOTBALL_KEY')!;
  const maxQuery = new URL(req.url).searchParams.get('max');
  const maxPartidos = Math.max(1, Number(maxQuery ?? MAX_PARTIDOS_POR_CORRIDA));

  const iniciadoEn = new Date().toISOString();
  let registrosAfectados = 0;
  let errorDetalle: string | null = null;
  const resumen: string[] = [];
  const sinPlanilla: string[] = [];

  try {
    const desde = new Date(Date.now() - DIAS_VENTANA * 86_400_000).toISOString();
    const ahora = new Date().toISOString();

    // Puentes pendientes: partido ya empezado, dentro de la ventana, jugador con id_externo
    // y convocado sin resolver.
    // partidos_jugadores tiene PK compuesta (partido_id, jugador_id), sin columna `id`.
    const { data: puentes, error: errPuentes } = await supabase
      .from('partidos_jugadores')
      .select('convocado, jugador_id, jugadores(id_externo), partidos!inner(id, id_externo, estado, inicio_utc, marcador_local, marcador_visitante)')
      .is('convocado', null)
      .gte('partidos.inicio_utc', desde)
      .lt('partidos.inicio_utc', ahora);
    if (errPuentes) throw errPuentes;

    // Agrupar por partido.
    type Puente = { jugadorId: string; jugadorIdExterno: string | null };
    const porPartido = new Map<string, { partido: Record<string, unknown>; puentes: Puente[] }>();
    for (const p of puentes ?? []) {
      // deno-lint-ignore no-explicit-any
      const partido = (p as any).partidos;
      // deno-lint-ignore no-explicit-any
      const jugadorIdExterno = (p as any).jugadores?.id_externo ?? null;
      if (!partido?.id_externo) continue; // sin fixture id no se puede consultar la API
      const entrada = porPartido.get(partido.id) ?? { partido, puentes: [] };
      entrada.puentes.push({ jugadorId: p.jugador_id, jugadorIdExterno });
      porPartido.set(partido.id, entrada);
    }

    const partidosAProcesar = [...porPartido.values()].slice(0, maxPartidos);

    for (let i = 0; i < partidosAProcesar.length; i++) {
      const { partido, puentes: puentesDelPartido } = partidosAProcesar[i];
      if (i > 0) await esperarEntreLlamadas();
      const fixtureId = String(partido.id_externo);

      // 1) Estado real. Si ya lo teníamos como finalizado, evitamos la llamada.
      let estadoCorto = 'FT';
      if (partido.estado !== 'finalizado') {
        const fx = await obtenerFixturePorId(apiKey, fixtureId);
        if (!fx) {
          resumen.push(`fixture ${fixtureId}: la API no lo devolvió`);
          continue;
        }
        estadoCorto = fx.estadoCorto;
        const estadoNuevo = mapearEstado(estadoCorto);
        const cambios: Record<string, unknown> = {};
        if (estadoNuevo !== partido.estado) cambios.estado = estadoNuevo;
        if (fx.marcadorLocal !== partido.marcador_local) cambios.marcador_local = fx.marcadorLocal;
        if (fx.marcadorVisitante !== partido.marcador_visitante) cambios.marcador_visitante = fx.marcadorVisitante;
        if (Object.keys(cambios).length) {
          cambios.sincronizado_en = new Date().toISOString();
          await supabase.from('partidos').update(cambios).eq('id', partido.id);
          registrosAfectados += 1;
        }
        if (!FINALIZADOS.has(estadoCorto)) {
          resumen.push(`fixture ${fixtureId}: aún ${estadoCorto} — se reintenta`);
          continue;
        }
        await esperarEntreLlamadas();
      }

      // 2) Planilla de jugadores.
      const planilla = await obtenerJugadoresDeFixture(apiKey, fixtureId);
      if (!planilla.length) {
        sinPlanilla.push(fixtureId); // el plan no cubre stats por jugador de esa competencia
        continue;
      }

      for (const pj of puentesDelPartido) {
        if (!pj.jugadorIdExterno) continue;
        const linea = extraerLineaJugador(planilla, pj.jugadorIdExterno);

        const filtroPuente = { partido_id: partido.id as string, jugador_id: pj.jugadorId };

        if (linea === null) {
          await supabase.from('partidos_jugadores').update({ convocado: false })
            .eq('partido_id', filtroPuente.partido_id).eq('jugador_id', filtroPuente.jugador_id);
          registrosAfectados += 1;
          continue;
        }

        await supabase.from('partidos_jugadores').update({ convocado: true })
          .eq('partido_id', filtroPuente.partido_id).eq('jugador_id', filtroPuente.jugador_id);
        registrosAfectados += 1;

        if (linea.jugo && linea.estadistica) {
          const e = linea.estadistica;
          const { error: errStat } = await supabase.from('estadisticas_partido').upsert(
            {
              partido_id: partido.id,
              jugador_id: pj.jugadorId,
              minutos: e.minutos,
              goles: e.goles,
              asistencias: e.asistencias,
              amarillas: e.amarillas,
              rojas: e.rojas,
              titular: e.titular,
              valoracion: e.valoracion,
              origen: 'api',
              proveedor_externo: PROVEEDOR,
              payload_crudo: linea,
              sincronizado_en: new Date().toISOString(),
            },
            { onConflict: 'partido_id,jugador_id' },
          );
          if (errStat) throw errStat;
          registrosAfectados += 1;
          resumen.push(`${pj.jugadorIdExterno} en ${fixtureId}: ${e.minutos}' ${e.goles}g ${e.asistencias}a`);
        }
      }
    }

    if (sinPlanilla.length) {
      console.log(`Fixtures sin stats por jugador en el plan (se reintentan hasta salir de la ventana): ${sinPlanilla.join(', ')}`);
    }
  } catch (e) {
    console.error('sync-estadisticas error:', e);
    errorDetalle =
      e instanceof Error ? e.message : e && typeof e === 'object' ? JSON.stringify(e) : String(e);
  }

  const estado = errorDetalle ? (registrosAfectados > 0 ? 'parcial' : 'error') : 'ok';

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'estadisticas',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado,
    registros_afectados: registrosAfectados,
    error_detalle: errorDetalle,
    parametros: { resumen, sin_planilla: sinPlanilla, max_partidos: maxPartidos },
  });

  return new Response(JSON.stringify({ estado, registrosAfectados, resumen, sinPlanilla, errorDetalle }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});
