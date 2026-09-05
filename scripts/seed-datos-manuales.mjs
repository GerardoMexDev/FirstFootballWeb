/**
 * Carga los datos MANUALES del Excel "Datos de jugadores y clubes.xlsx" (hoja 1):
 *   - jugadores.fecha_nacimiento (cumpleaños)
 *   - clubes.fecha_fundacion     (aniversario de club)
 *
 * Son `origen='manual'`: no vienen de la API, los da la agencia. Alimentan la vista
 * `agenda_anual` (bloques cumpleaños y aniversario_club) y, con eso, las "Fechas señaladas"
 * que avisan con 7-10 días de anticipación en calendario y partidos.
 *
 * Versión interina de `scripts/importar-datos-manuales` (que leería el .xlsx directo y
 * mostraría diff): acá los 12 valores van fijos porque ya están confirmados en
 * planeacion/contexto.md §9 y no cambian seguido. Si cambian, se editan acá o se hace el
 * importador del xlsx.
 *
 * Idempotente: matchea por (proveedor_externo, id_externo) y siempre hace UPDATE.
 *
 * Uso: node scripts/seed-datos-manuales.mjs   (o: npm run seed:datos-manuales)
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

// id_externo = ID de API-Football (el que cargó seed-clubes-jugadores.mjs).
const CUMPLEANOS = [
  { ref: 'Nahitan Nández', id_externo: '2614', fecha: '1995-12-28' },
  { ref: 'Federico Pereira', id_externo: '67884', fecha: '2000-02-24' },
  { ref: 'Ignacio Sosa', id_externo: '310307', fecha: '2003-08-31' },
  { ref: 'Javier Méndez', id_externo: '6122', fecha: '1994-12-05' },
  { ref: 'Kevin Amaro', id_externo: '377326', fecha: '2004-03-03' },
  { ref: 'Martín Fernández', id_externo: '51549', fecha: '2001-05-08' },
];

const FUNDACIONES = [
  { ref: 'Al-Qadisiyah', id_externo: '2933', fecha: '1967-12-01' },
  { ref: 'Toluca', id_externo: '2281', fecha: '1917-02-12' },
  { ref: 'Atlante', id_externo: '2312', fecha: '1916-04-18' },
  { ref: 'RB Bragantino', id_externo: '794', fecha: '2020-01-01' },
  { ref: 'Colo-Colo', id_externo: '2315', fecha: '1925-04-19' },
  { ref: 'Genk', id_externo: '742', fecha: '1988-07-01' },
];

/** UPDATE de una columna de fecha en una fila ubicada por (proveedor_externo, id_externo). */
async function fijarFecha(tabla, columna, id_externo, valor, ref) {
  const { data: fila, error: errBuscar } = await admin
    .from(tabla)
    .select(`id, ${columna}`)
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (!fila) {
    console.error(`❌ ${ref}: no existe en ${tabla} con id_externo ${id_externo} — corré antes: npm run seed:roster`);
    process.exitCode = 1;
    return;
  }
  const antes = fila[columna];
  const { error: errUpdate } = await admin.from(tabla).update({ [columna]: valor }).eq('id', fila.id);
  if (errUpdate) throw errUpdate;
  console.log(`${antes === valor ? '·' : '='} ${ref.padEnd(18)} ${columna} = ${valor}${antes && antes !== valor ? ` (antes ${antes})` : ''}`);
}

console.log('Cumpleaños (jugadores.fecha_nacimiento):');
for (const c of CUMPLEANOS) await fijarFecha('jugadores', 'fecha_nacimiento', c.id_externo, c.fecha, c.ref);

console.log('\nFundación de club (clubes.fecha_fundacion):');
for (const f of FUNDACIONES) await fijarFecha('clubes', 'fecha_fundacion', f.id_externo, f.fecha, f.ref);

console.log(`\n✅ ${CUMPLEANOS.length} cumpleaños y ${FUNDACIONES.length} fundaciones cargados.`);
