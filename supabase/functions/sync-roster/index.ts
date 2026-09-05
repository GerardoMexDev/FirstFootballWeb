/**
 * sync-roster — detecta cuándo un representado cambió de club y lo refleja solo:
 *   1. upsert del club nuevo en `clubes`
 *   2. `jugadores.club_actual_id` -> club nuevo  (NUNCA se pone en NULL)
 *   3. un `hito` tipo 'traspaso' (origen 'derivado'), fechado y tipado con `/transfers`
 * Como `proximos_partidos` resuelve el club desde el jugador, los fixtures lo siguen sin
 * tocar nada más.
 *
 * Va aparte de `sync-partidos` (no dentro) porque los traspasos no necesitan revisarse a
 * diario (cron semanal, migración 0005) y así el run de partidos no se alarga.
 *
 * Fuente: SOLO `GET /transfers?player=` (plan free, verificado en scripts/consultar-traspasos.mjs).
 * `/players/squads` se descartó: en ventanas de partidos de estrellas devuelve equipos
 * representativos como si fueran el club. La decisión (y las guardas: destino representativo,
 * traspaso viejo) vive en `_shared/roster.ts`. Lo que no se puede confirmar se registra en
 * `parametros.sospechas` para que una persona lo mire — no se toca el dato.
 *
 * Disparo: `pg_cron` + `pg_net` o curl manual con el header `x-sync-secret`
 * (= SYNC_FUNCTIONS_SECRET), igual que sync-partidos. Deploy con `--no-verify-jwt`.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { esperarEntreLlamadas, obtenerUltimoTraspaso } from '../_shared/api-football.ts';
import { detectarCambioDeClub, tituloTraspaso, type ClubRef, type Traspaso } from '../_shared/roster.ts';

const PROVEEDOR = 'api-football';

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('API_FOOTBALL_KEY')!;
  const hoyIso = new Date().toISOString().slice(0, 10);

  const iniciadoEn = new Date().toISOString();
  let registrosAfectados = 0;
  let errorDetalle: string | null = null;
  const cambios: string[] = [];
  const sospechas: string[] = [];

  try {
    const { data: jugadores, error: errJugadores } = await supabase
      .from('jugadores')
      .select('id, nombre, apodo, id_externo, club_actual_id, clubes(id_externo)')
      .eq('activo', true)
      .not('id_externo', 'is', null);
    if (errJugadores) throw errJugadores;

    for (let i = 0; i < (jugadores ?? []).length; i++) {
      const j = jugadores![i];
      if (i > 0) await esperarEntreLlamadas(); // 10 req/min del plan free

      const ultimo = await obtenerUltimoTraspaso(apiKey, j.id_externo!);
      const traspaso: Traspaso | null = ultimo
        ? { fecha: ultimo.fecha, tipo: ultimo.tipo, desde: ultimo.desde, hasta: ultimo.hasta }
        : null;
      const clubGuardado = (j.clubes as { id_externo: string | null } | null)?.id_externo ?? null;

      const resultado = detectarCambioDeClub(clubGuardado, traspaso, hoyIso);
      const quien = j.apodo ?? j.nombre;

      if (resultado.revisar) {
        sospechas.push(`${quien}: ${resultado.revisar.motivo}`);
        continue;
      }
      if (!resultado.aplicar) continue;

      registrosAfectados += await aplicarCambioDeClub(
        supabase,
        j,
        resultado.aplicar.nuevoClub,
        resultado.aplicar.traspaso,
      );
      cambios.push(`${quien} → ${resultado.aplicar.nuevoClub.nombre} (${resultado.aplicar.traspaso.fecha})`);
    }
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : String(e);
  }

  const estado = errorDetalle ? (registrosAfectados > 0 ? 'parcial' : 'error') : 'ok';

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'roster',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado,
    registros_afectados: registrosAfectados,
    error_detalle: errorDetalle,
    parametros: { cambios, sospechas },
  });

  return new Response(JSON.stringify({ estado, registrosAfectados, cambios, sospechas, errorDetalle }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});

/** Upsert de un club por (proveedor_externo, id_externo). Devuelve el uuid interno. */
async function asegurarClub(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  idExterno: string,
  nombre: string,
): Promise<string> {
  const { data: existente, error: errBuscar } = await supabase
    .from('clubes')
    .select('id')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', idExterno)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (existente) return existente.id;

  const { data: creado, error: errCrear } = await supabase
    .from('clubes')
    .insert({ nombre, origen: 'api', proveedor_externo: PROVEEDOR, id_externo: idExterno })
    .select('id')
    .single();
  if (errCrear) throw errCrear;
  return creado.id;
}

/**
 * Aplica el cambio: club nuevo + FK del jugador + hito de traspaso. Devuelve cuántas filas tocó.
 * El hito es idempotente por (jugador_id, tipo, proveedor_externo, id_externo): si la función
 * corre dos veces con el mismo traspaso, no se duplica.
 */
async function aplicarCambioDeClub(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  jugador: any,
  nuevoClub: ClubRef,
  traspaso: Traspaso,
): Promise<number> {
  const clubId = await asegurarClub(supabase, nuevoClub.idExterno, nuevoClub.nombre);

  const { error: errJugador } = await supabase
    .from('jugadores')
    .update({ club_actual_id: clubId })
    .eq('id', jugador.id);
  if (errJugador) throw errJugador;

  // id_externo del hito: estable para el mismo traspaso, así el upsert no duplica.
  const idExternoHito = `traspaso:${jugador.id_externo}:${traspaso.fecha}:${nuevoClub.idExterno}`;

  const { error: errHito } = await supabase.from('hitos').upsert(
    {
      jugador_id: jugador.id,
      club_id: clubId,
      tipo: 'traspaso',
      titulo: tituloTraspaso(nuevoClub, traspaso),
      descripcion: `Movimiento: ${traspaso.tipo || 'N/A'}`,
      fecha: traspaso.fecha || null,
      origen: 'derivado',
      verificado: false,
      destacado: false,
      proveedor_externo: PROVEEDOR,
      id_externo: idExternoHito,
      metadatos: traspaso,
    },
    { onConflict: 'jugador_id,tipo,proveedor_externo,id_externo' },
  );
  if (errHito) throw errHito;

  return 2; // jugador + hito
}
