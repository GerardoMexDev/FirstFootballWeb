/**
 * sync-roster — revisa todas las semanas si algún representado cambió de club y AVISA.
 *
 * Desde 2026-09-30 la fuente es SportMonks (`GET /players/{id}?include=teams.team`): API-Football
 * `/transfers` tenía el "último traspaso" viejo para 8 de 11 jugadores. Revisa a TODOS los
 * jugadores activos con código de SportMonks (Match Day y Contenido) y compara su club vigente
 * con el que tenemos (`clubes.id_externo_sportmonks`). La lógica pura vive en
 * `_shared/roster-sportmonks.ts`.
 *
 * NO cambia datos (decisión de Gerardo, opción 1): un club nuevo casi siempre necesita cargar sus
 * códigos para que sigan llegando los partidos, así que el cambio lo aplica Mazdesign. Lo
 * detectado queda en `sincronizaciones.parametros.detectados` y la función `avisos_sistema()`
 * (migración 0029) lo muestra en el cartel del Administrador.
 *
 * Disparo: `pg_cron` + `pg_net` (lunes 04:00 UTC, migración 0005) o manual con el header
 * `x-sync-secret` (= SYNC_FUNCTIONS_SECRET). Deploy con `--no-verify-jwt`.
 *
 * Football First (Fase 1). Creado 2026-09-05; fuente SportMonks 2026-09-30.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { esperarEntreLlamadasSportmonks, obtenerEquiposDeJugador, obtenerPlantel } from '../_shared/sportmonks.ts';
import { clubActualSportmonks, detectarCambioSportmonks } from '../_shared/roster-sportmonks.ts';

const PROVEEDOR = 'sportmonks';

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiKey = Deno.env.get('SPORTMONKS_APIKEY')!;
  const hoyIso = new Date().toISOString().slice(0, 10);
  const iniciadoEn = new Date().toISOString();

  /** Cambios de club detectados, para el cartel: "Nacho: RB Bragantino → Flamengo (01/08/2026)". */
  const detectados: Array<{ jugador: string; desde: string | null; hacia: string; haciaSmId: string; fecha: string | null }> = [];
  const sinCodigo: string[] = [];
  const sinDato: string[] = [];
  const errores: string[] = [];
  let revisados = 0;
  let errorDetalle: string | null = null;

  try {
    const { data: jugadores, error } = await supabase
      .from('jugadores')
      .select('id, nombre, apodo, id_externo_sportmonks, clubes(nombre, id_externo_sportmonks)')
      .eq('activo', true)
      .not('id_externo_sportmonks', 'is', null);
    if (error) throw error;

    for (let i = 0; i < (jugadores ?? []).length; i++) {
      const j = jugadores![i];
      if (i > 0) await esperarEntreLlamadasSportmonks();
      const quien = j.apodo ?? j.nombre;
      const club = j.clubes as { nombre: string | null; id_externo_sportmonks: string | null } | null;
      try {
        const actual = clubActualSportmonks(await obtenerEquiposDeJugador(apiKey, j.id_externo_sportmonks!), hoyIso);
        let r = detectarCambioSportmonks(club?.id_externo_sportmonks ?? null, actual);
        // Respaldo: sin contratos visibles (límite del plan), si sigue en el plantel de su club, está igual.
        if (r.estado === 'sin_dato' && club?.id_externo_sportmonks) {
          await esperarEntreLlamadasSportmonks();
          const plantel = await obtenerPlantel(apiKey, club.id_externo_sportmonks);
          if (plantel.has(j.id_externo_sportmonks!)) r = { estado: 'igual' };
        }
        revisados += 1;
        if (r.estado === 'cambio') {
          detectados.push({ jugador: quien, desde: club?.nombre ?? null, hacia: r.hacia, haciaSmId: r.haciaSmId, fecha: r.desde });
        } else if (r.estado === 'sin_codigo') {
          sinCodigo.push(`${quien}: su club (${club?.nombre ?? '?'}) no tiene código de SportMonks; SportMonks dice ${r.actual}`);
        } else if (r.estado === 'sin_dato') {
          sinDato.push(`${quien}: SportMonks no muestra su contrato y ya no figura en el plantel de ${club?.nombre ?? 'su club'} — revisar`);
        }
      } catch (e) {
        // Un jugador que falla no tira abajo al resto.
        errores.push(`${quien}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (errores.length && !revisados) errorDetalle = errores.join(' | ');
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : String(e);
  }

  const estado = errorDetalle ? 'error' : errores.length ? 'parcial' : 'ok';

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'roster',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado,
    registros_afectados: 0, // solo avisa, no cambia datos
    error_detalle: errorDetalle ?? (errores.length ? errores.join(' | ') : null),
    parametros: { revisados, detectados, sin_codigo: sinCodigo, sin_dato: sinDato },
  });

  return new Response(JSON.stringify({ estado, revisados, detectados, sinCodigo, sinDato, errores }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});
