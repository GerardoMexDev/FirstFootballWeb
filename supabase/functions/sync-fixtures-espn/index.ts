/**
 * sync-fixtures-espn — trae el CALENDARIO COMPLETO de la temporada (liga doméstica) de cada
 * club de la cartera desde el *core* API no oficial de ESPN y lo deja en `partidos`.
 *
 * Por qué existe: el plan FREE de API-Football solo deja ver `GET /fixtures?date=` en una
 * ventana de ~3 días alrededor de hoy (avances.md §10), así que "próximos partidos" no puede
 * mostrar nada más allá de esa semana. ESPN, gratis, sí da la temporada entera. Esto es un
 * PUENTE hasta que entre API-Football Pro (sin límite de ventana); cuando eso pase, se apaga
 * el cron de esta función y listo — todo lo que agrega es aditivo (avances.md §5).
 *
 * Alcance v1: SOLO ligas domésticas (los pósters semanales de la agencia). Copas,
 * continentales y selección siguen con API-Football en su ventana corta.
 *
 * De-duplicación: un mismo partido de esta semana lo van a traer las DOS fuentes. No se
 * puede cruzar por club (cada fuente le pone su propio id a los rivales), así que la vista
 * `proximos_partidos` (migración 0011) colapsa por (jugador, día en Uruguay, con_selección)
 * y prefiere la fila de API-Football (tiene el `fixture_id` que usa `sync-estadisticas`).
 * Consecuencia conocida: quedan filas de clubes rivales duplicadas en `clubes` (una por
 * fuente) — no se ve en la UI; se limpia con un script cuando entre el plan pago.
 *
 * Disparo: `pg_cron` + `pg_net` (migración 0012, 03:30 UTC — después de sync-partidos) o
 * manual con el header `x-sync-secret`. Se deploya con `--no-verify-jwt`.
 *
 * Idempotente: upsert de `partidos` por (proveedor_externo='espn', id_externo=<eventId>) —
 * busca y decide insert/update a mano porque el índice único es parcial.
 *
 * Football First (Fase 1). Creado 2026-09-07 (spike ESPN — avances.md §4).
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
import { zonaDePais } from '../_shared/zona-pais.ts';

const PROVEEDOR = 'espn';
const NOVENTA_DIAS_MS = 90 * 86_400_000;
const TRES_DIAS_MS = 3 * 86_400_000;
const SIETE_DIAS_MS = 7 * 86_400_000;
const CATORCE_DIAS_MS = 14 * 86_400_000;
/** Ventana que se le pide a ESPN: desde hace 3 días (para pasar a 'finalizado' lo recién
 *  jugado) hasta 300 días adelante. ESPN rechaza rangos `dates=` de más de ~1 año, y una
 *  temporada de liga entra de sobra en 300 días. */
const VENTANA_ATRAS_DIAS = 3;
const VENTANA_ADELANTE_DIAS = 300;

/** `Date` → `"YYYYMMDD"` en UTC, como espera el filtro `dates=` de ESPN. */
function aAAAAMMDD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Los 6 clubes de la cartera, mapeados de su id de API-Football (como se guarda en
 * `clubes.id_externo`) a lo que necesita ESPN. `ligaExternoAF` es el id de la liga en
 * API-Football (`competencias.id_externo`) para enganchar la `competencia_id` correcta.
 * IDs verificados en vivo 2026-09-07 (avances.md §4).
 */
const CLUBES_ESPN: Record<string, { espnTeamId: string; ligaSlug: string; ligaExternoAF: string }> = {
  '742': { espnTeamId: '938', ligaSlug: 'bel.1', ligaExternoAF: '144' }, // Genk — Jupiler Pro League
  '2281': { espnTeamId: '223', ligaSlug: 'mex.1', ligaExternoAF: '262' }, // Toluca — Liga MX
  '2312': { espnTeamId: '226', ligaSlug: 'mex.1', ligaExternoAF: '262' }, // Atlante — Liga MX
  '794': { espnTeamId: '6079', ligaSlug: 'bra.1', ligaExternoAF: '71' }, // RB Bragantino — Serie A
  '2315': { espnTeamId: '2688', ligaSlug: 'chi.1', ligaExternoAF: '265' }, // Colo-Colo — Primera División
  '2933': { espnTeamId: '22022', ligaSlug: 'ksa.1', ligaExternoAF: '307' }, // Al-Qadisiyah — Pro League
};

type ClubDeCartera = { clubId: string; zonaHoraria: string | null; jugadorIds: string[] };

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const iniciadoEn = new Date().toISOString();
  let registrosAfectados = 0;
  let errorDetalle: string | null = null;
  const clubesProcesados: string[] = [];
  const eventosConError: string[] = []; // un evento raro no tira abajo toda la corrida

  try {
    // 1) Cartera: jugadores activos + su club actual (id_externo de API-Football + zona).
    //    Misma consulta que sync-partidos.
    const { data: jugadores, error: errJugadores } = await supabase
      .from('jugadores')
      .select('id, clubes(id, id_externo, zona_horaria)')
      .eq('activo', true)
      .not('club_actual_id', 'is', null);
    if (errJugadores) throw errJugadores;

    const carteraPorExterno = new Map<string, ClubDeCartera>();
    for (const j of jugadores ?? []) {
      const club = j.clubes;
      if (!club?.id_externo) continue;
      const existente = carteraPorExterno.get(club.id_externo);
      if (existente) existente.jugadorIds.push(j.id);
      else carteraPorExterno.set(club.id_externo, { clubId: club.id, zonaHoraria: club.zona_horaria, jugadorIds: [j.id] });
    }
    if (carteraPorExterno.size === 0) {
      throw new Error('No hay jugadores activos con club + id_externo — nada que sincronizar.');
    }

    // Mapa inverso: id de equipo de ESPN → uuid del club de la cartera (para no crear un
    // club rival duplicado cuando dos representados juegan el mismo partido, ej. Toluca vs
    // Atlante).
    const carteraPorEspnId = new Map<string, string>();
    for (const [afId, cfg] of Object.entries(CLUBES_ESPN)) {
      const club = carteraPorExterno.get(afId);
      if (club) carteraPorEspnId.set(cfg.espnTeamId, club.clubId);
    }

    // 2) Competencias catalogadas, por id_externo de API-Football.
    const { data: competencias, error: errCompetencias } = await supabase
      .from('competencias')
      .select('id, id_externo');
    if (errCompetencias) throw errCompetencias;
    const competenciaIdPorExterno = new Map((competencias ?? []).map((c) => [c.id_externo, c.id]));

    // 3) Partidos que ya trajimos de ESPN antes — para decidir qué eventos re-consultar y
    //    para no pisar con NULL un estadio/ciudad/zona que ya teníamos.
    const { data: partidosEspn, error: errPartidos } = await supabase
      .from('partidos')
      .select('id, id_externo, inicio_utc, estadio, ciudad, zona_horaria_evento')
      .eq('proveedor_externo', PROVEEDOR);
    if (errPartidos) throw errPartidos;
    const existentePorEvento = new Map((partidosEspn ?? []).map((p) => [p.id_externo, p]));

    const ahora = Date.now();
    const rangoFechas = `${aAAAAMMDD(new Date(ahora - VENTANA_ATRAS_DIAS * 86_400_000))}-${
      aAAAAMMDD(new Date(ahora + VENTANA_ADELANTE_DIAS * 86_400_000))
    }`;

    // Temporada vigente por slug — se cachea porque Toluca y Atlante comparten mex.1.
    const temporadaPorSlug = new Map<string, number>();

    // 4) Por cada club de la cartera que tenemos mapeado a ESPN.
    for (const [afId, cfg] of Object.entries(CLUBES_ESPN)) {
      const club = carteraPorExterno.get(afId);
      if (!club) continue; // ese club no está en la cartera activa

      let year = temporadaPorSlug.get(cfg.ligaSlug);
      if (year === undefined) {
        year = await obtenerTemporadaVigente(cfg.ligaSlug);
        temporadaPorSlug.set(cfg.ligaSlug, year);
        await esperarEntreLlamadasEspn();
      }
      const refs = await listarEventosDeTemporada(cfg.ligaSlug, year, cfg.espnTeamId, rangoFechas);
      await esperarEntreLlamadasEspn();

      for (const ref of refs) {
        const eventoId = ref.split('/events/')[1]?.split('?')[0];
        if (!eventoId) continue;

        // ¿Hace falta pedir el detalle? Sí si es nuevo. Si ya lo tenemos, solo si está en la
        // ventana [-7d, +14d] (reprogramaciones, cambios de sede, y varios intentos de pasar
        // a 'finalizado' si alguna corrida no pudo resolver el estado).
        const yaGuardado = existentePorEvento.get(eventoId);
        if (yaGuardado) {
          const inicio = yaGuardado.inicio_utc ? new Date(yaGuardado.inicio_utc).getTime() : null;
          const enVentana = inicio !== null && inicio > ahora - SIETE_DIAS_MS && inicio < ahora + CATORCE_DIAS_MS;
          if (!enVentana) continue;
        }

        try {
          await esperarEntreLlamadasEspn();
          const eventoCrudo = (await obtenerEvento(ref)) as unknown as EventoEspnCrudo;
          const p = normalizarEvento(eventoCrudo, cfg.espnTeamId);

          // Evento viejo que nunca guardamos: fuera de alcance (API-Football ya cubrió lo
          // reciente; el historial no es de esta función). Los que ya teníamos sí se refrescan.
          const inicioMs = p.inicioUtc ? new Date(p.inicioUtc).getTime() : null;
          if (!yaGuardado && inicioMs !== null && inicioMs < ahora - TRES_DIAS_MS) continue;

          // Estado: si todavía no empezó, es 'programado' sin gastar otra llamada. Si ya
          // arrancó (o no tiene fecha), se resuelve el $ref.
          let estado: ReturnType<typeof mapearEstadoEspn> = 'programado';
          if (inicioMs === null || inicioMs <= ahora) {
            if (p.statusRef) {
              await esperarEntreLlamadasEspn();
              estado = mapearEstadoEspn(await obtenerEstadoEvento(p.statusRef));
            } else {
              estado = 'sin_datos';
            }
          }

          registrosAfectados += await guardarPartido(supabase, {
            p,
            club,
            carteraPorEspnId,
            competenciaId: competenciaIdPorExterno.get(cfg.ligaExternoAF) ?? null,
            estado,
            eventoCrudo,
          });
        } catch (e) {
          // Un evento que falla (JSON raro de ESPN, error puntual de la base) se anota y se
          // sigue: el resto del calendario igual entra. La bitácora queda 'parcial'.
          eventosConError.push(`${cfg.ligaSlug}/${eventoId}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
          console.error(`Evento ${cfg.ligaSlug}/${eventoId} falló:`, e);
        }
      }

      clubesProcesados.push(cfg.ligaSlug);
    }
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(errorDetalle);
  }

  // Falla dura (el catch de arriba) o eventos sueltos que fallaron → 'parcial' si igual se
  // guardó algo, 'error' si no se guardó nada.
  const huboFalla = errorDetalle !== null || eventosConError.length > 0;
  const estadoSync = huboFalla ? (registrosAfectados > 0 ? 'parcial' : 'error') : 'ok';
  if (!errorDetalle && eventosConError.length) {
    errorDetalle = `${eventosConError.length} evento(s) con error: ${eventosConError.slice(0, 5).join(' | ')}`;
  }

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'partidos',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado: estadoSync,
    registros_afectados: registrosAfectados,
    error_detalle: errorDetalle,
    parametros: { alcance: 'ligas_domesticas', clubes: clubesProcesados, eventos_con_error: eventosConError },
  });

  return new Response(JSON.stringify({ estado: estadoSync, registrosAfectados, errorDetalle }), {
    headers: { 'content-type': 'application/json' },
    status: 200, // el llamador (pg_net) no reintenta — siempre 200, el detalle va en la bitácora
  });
});

/**
 * Devuelve el uuid interno de un club identificado por su id de equipo de ESPN.
 *   1) Si es uno de nuestros 6 clubes de la cartera → su uuid real (evita duplicar).
 *   2) Si ya lo creamos antes como club de ESPN → ese.
 *   3) Si no → lo crea con proveedor_externo='espn'.
 */
async function asegurarClubEspn(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  espnId: string,
  carteraPorEspnId: Map<string, string>,
  nombre: string,
): Promise<string> {
  const deCartera = carteraPorEspnId.get(espnId);
  if (deCartera) return deCartera;

  const { data: existente, error: errBuscar } = await supabase
    .from('clubes')
    .select('id')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', espnId)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (existente) return existente.id;

  const { data: creado, error: errCrear } = await supabase
    .from('clubes')
    .insert({ nombre, origen: 'api', proveedor_externo: PROVEEDOR, id_externo: espnId })
    .select('id')
    .single();
  if (errCrear) throw errCrear;
  return creado.id;
}

interface ContextoGuardado {
  p: ReturnType<typeof normalizarEvento>;
  club: ClubDeCartera;
  carteraPorEspnId: Map<string, string>;
  competenciaId: string | null;
  estado: ReturnType<typeof mapearEstadoEspn>;
  eventoCrudo: EventoEspnCrudo;
}

/** Upsert de un partido de ESPN + el puente con el/los representado(s). Devuelve 1. */
async function guardarPartido(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ctx: ContextoGuardado,
): Promise<number> {
  const { p, club, carteraPorEspnId, competenciaId, estado, eventoCrudo } = ctx;

  // Búsqueda por la clave natural real (índice único PARCIAL, no lo infiere el upsert de
  // PostgREST). Se hace acá y no con el mapa precargado a propósito: si en esta misma
  // corrida ya se insertó este evento desde el otro club de un derby (Toluca vs Atlante),
  // el mapa no lo tendría y se intentaría un segundo INSERT → violación del índice.
  const { data: existente, error: errBuscar } = await supabase
    .from('partidos')
    .select('id, estadio, ciudad, zona_horaria_evento')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', p.eventoId)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  const rivalNombre = p.rivalNombre ?? `ESPN ${p.rivalEspnId}`;
  const rivalClubId = await asegurarClubEspn(supabase, p.rivalEspnId, carteraPorEspnId, rivalNombre);
  const nuestroClubId = club.clubId;

  const clubLocalId = p.nuestroLado === 'local' ? nuestroClubId : rivalClubId;
  const clubVisitanteId = p.nuestroLado === 'local' ? rivalClubId : nuestroClubId;

  // Liga doméstica: la sede está en el país de la liga, así que la zona del país (o, si ESPN
  // no trajo el país, la zona de nuestro club, que juega en ese mismo país) es correcta.
  // Nunca se inventa: si nada resuelve, queda NULL y la UI no muestra "hora local".
  const zona = zonaDePais(p.sedePais) ?? club.zonaHoraria ?? null;

  const inicioMs = p.inicioUtc ? new Date(p.inicioUtc).getTime() : null;
  const tentativo = inicioMs !== null && inicioMs - Date.now() > NOVENTA_DIAS_MS;

  const fila = {
    competencia_id: competenciaId,
    club_local_id: clubLocalId,
    club_visitante_id: clubVisitanteId,
    inicio_utc: p.inicioUtc,
    // estadio/ciudad/zona solo MEJORAN: no se pisan con NULL si ya los teníamos (de un sync
    // de API-Football con mejor dato o de carga manual). Igual criterio que sync-partidos.
    zona_horaria_evento: zona ?? existente?.zona_horaria_evento ?? null,
    estado,
    estadio: p.sedeNombre ?? existente?.estadio ?? null,
    ciudad: p.sedeCiudad ?? existente?.ciudad ?? null,
    tentativo,
    origen: 'api',
    proveedor_externo: PROVEEDOR,
    id_externo: p.eventoId,
    payload_crudo: eventoCrudo,
    sincronizado_en: new Date().toISOString(),
  };

  const { data: partido, error: errPartido } = existente
    ? await supabase.from('partidos').update(fila).eq('id', existente.id).select('id').single()
    : await supabase.from('partidos').insert(fila).select('id').single();
  if (errPartido) throw errPartido;

  // Puente con el/los representado(s) de NUESTRO club en este partido. `ignoreDuplicates`:
  // si la fila ya existe no se pisa (sync-estadisticas escribe `convocado` ahí).
  for (const jugadorId of club.jugadorIds) {
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
