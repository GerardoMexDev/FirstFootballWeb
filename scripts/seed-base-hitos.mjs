/**
 * Carga los números BASE del motor de hitos en jugadores.*_base (migración 0003):
 * partidos / goles / asistencias de CARRERA y partidos / goles de SELECCIÓN, más la
 * fecha de corte (base_actualizada_en) a la que corresponden esos totales.
 *
 * Por qué es un script puntual y no la API: la sync solo trae partidos hacia ADELANTE;
 * el historial completo de la carrera no se puede reconstruir desde API-Football (menos
 * con el plan free). La agencia da estos totales una vez; de ahí en más el total corriente
 * = esta base + lo que sume estadisticas_partido para partidos con fecha > base_actualizada_en
 * (ver la vista totales_jugador en 0003 y el futuro sync-estadisticas).
 *
 * Fuente de los números: https://www.transfermarkt.es/ — planilla "Datos de jugadores y
 * clubes.xlsx", hoja "Hitos", corte al 2026-08-29 (próxima actualización prevista: 2026-09-05).
 * También carga jugadores.debut_seleccion (fecha del primer partido con la mayor), que sale
 * de la misma hoja — solo la tienen los que ya debutaron.
 *
 * Criterio de valores (contexto.md §10, "cero invenciones"):
 *   - Los 0 de selección de Fede/Nacho/Javi/Martín son un dato real de Transfermarkt
 *     (0 partidos con la mayor), NO un relleno por defecto: se cargan como 0.
 *   - Nacho Sosa no tiene rojas de carrera en la planilla (celda vacía). Esa métrica no
 *     entra en ninguna escala de hito y 0003 no tiene columna para ella, así que acá no
 *     se toca — quedaría "Sin datos" si algún día se agrega.
 *
 * Idempotente: matchea por (proveedor_externo, id_externo) — misma clave natural que
 * seed-clubes-jugadores.mjs — y siempre hace UPDATE (las filas de jugadores ya existen).
 *
 * Uso: node scripts/seed-base-hitos.mjs   (o: npm run seed:base-hitos)
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .secretos/.env');
  process.exit(1);
}

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROVEEDOR = 'api-football';
const CORTE = '2026-08-29'; // fecha a la que corresponden los totales de Transfermarkt

// id_externo = ID de API-Football del jugador (el mismo que cargó seed-clubes-jugadores.mjs).
// carrera/selección = totales hasta CORTE, no de la temporada en curso.
// debutSeleccion = fecha del primer partido con la mayor (solo Nahitan y Kevin Amaro; resto null).
const BASE = [
  // nombre en jugadores  | id_externo | carrera pj/g/a          | selección pj/g | debut selección
  { ref: 'Nahitan Nández',    id_externo: '2614',   carrera: [388, 28, 53], seleccion: [71, 0], debutSeleccion: '2015-09-18' },
  { ref: 'Federico Pereira',  id_externo: '67884',  carrera: [223, 20, 12], seleccion: [0, 0],  debutSeleccion: null },
  { ref: 'Ignacio Sosa',      id_externo: '310307', carrera: [152, 4, 10],  seleccion: [0, 0],  debutSeleccion: null },
  { ref: 'Javier Méndez',     id_externo: '6122',   carrera: [304, 14, 8],  seleccion: [0, 0],  debutSeleccion: null },
  { ref: 'Kevin Amaro',       id_externo: '377326', carrera: [104, 2, 9],   seleccion: [3, 0],  debutSeleccion: '2025-09-09' },
  { ref: 'Martín Fernández',  id_externo: '51549',  carrera: [175, 2, 3],   seleccion: [0, 0],  debutSeleccion: null },
];

const COLS = [
  'carrera_partidos_base',
  'carrera_goles_base',
  'carrera_asistencias_base',
  'seleccion_partidos_base',
  'seleccion_goles_base',
  'debut_seleccion',
  'base_actualizada_en',
];

for (const j of BASE) {
  const fila = {
    carrera_partidos_base: j.carrera[0],
    carrera_goles_base: j.carrera[1],
    carrera_asistencias_base: j.carrera[2],
    seleccion_partidos_base: j.seleccion[0],
    seleccion_goles_base: j.seleccion[1],
    debut_seleccion: j.debutSeleccion, // null si no debutó — no se fuerza una fecha
    base_actualizada_en: CORTE,
  };

  const { data: antes, error: errBuscar } = await admin
    .from('jugadores')
    .select(`id, nombre, ${COLS.join(', ')}`)
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', j.id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (!antes) {
    console.error(`❌ ${j.ref}: no existe jugador con id_externo ${j.id_externo} — corré antes: npm run seed:roster`);
    process.exitCode = 1;
    continue;
  }

  const { data: despues, error: errUpdate } = await admin
    .from('jugadores')
    .update(fila)
    .eq('id', antes.id)
    .select(`nombre, ${COLS.join(', ')}`)
    .single();
  if (errUpdate) throw errUpdate;

  const cambio = COLS.some((c) => String(antes[c] ?? '∅') !== String(despues[c] ?? '∅'));
  console.log(
    `${cambio ? '=' : '·'} ${despues.nombre.padEnd(20)} ` +
      `carrera pj/g/a = ${j.carrera.join('/')}  ·  selección pj/g = ${j.seleccion.join('/')}  ·  ` +
      `debut selección = ${j.debutSeleccion ?? '—'}  ·  corte ${CORTE}`,
  );
}

// Verificación: cómo queda el total corriente (base + estadisticas_partido, hoy vacía).
const { data: totales, error: errTotales } = await admin
  .from('totales_jugador')
  .select('*')
  .returns();
if (errTotales) throw errTotales;

console.log('\nVista totales_jugador (base + sync, con sync-estadisticas todavía vacía):');
for (const t of totales) {
  console.log(
    `  ${t.jugador_id.slice(0, 8)}…  ` +
      `carrera pj/g/a = ${t.carrera_partidos}/${t.carrera_goles}/${t.carrera_asistencias}  ` +
      `· selección pj/g = ${t.seleccion_partidos}/${t.seleccion_goles}`,
  );
}

console.log(`\n✅ Base de hitos cargada para ${BASE.length} jugadores (corte ${CORTE}).`);
