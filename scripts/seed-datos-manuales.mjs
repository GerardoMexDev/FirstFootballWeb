/**
 * Carga los datos MANUALES del Excel "Datos de jugadores y clubes.xlsx" (hoja 1):
 *   jugadores:  fecha_nacimiento · debut (profesional) · fichaje (al club actual) · instagram ·
 *               dropbox_fotografias_url · dropbox_matchday_url
 *   clubes:     fecha_fundacion
 *
 * Son `origen='manual'`: no vienen de la API, los da la agencia. Alimentan:
 *   - `agenda_anual` (bloques cumpleaños y aniversario_club) → "Fechas señaladas".
 *   - la ficha de jugador: "Años en el club" (fichaje), "Años de carrera" (debut),
 *     Instagram y el cumpleaños en "Datos para contenido", y los botones "Fotografías"/
 *     "Match Day" (dropbox_*_url, 0023 — pestañas "Dropbox Fotografias"/"Dropbox MatchDay").
 *
 * Versión interina de `scripts/importar-datos-manuales` (que leería el .xlsx directo y
 * mostraría diff): acá los valores van fijos porque ya están confirmados y no cambian
 * seguido. Si cambian, se editan acá o se hace el importador del xlsx.
 *
 * Idempotente: matchea por (proveedor_externo, id_externo) y siempre hace UPDATE.
 *
 * Uso: node scripts/seed-datos-manuales.mjs   (o: npm run seed:datos-manuales)
 *
 * Football First (Fase 1). Creado 2026-09-05. Ampliado 2026-09-06 (debut/fichaje/instagram),
 * 2026-09-17 (links de Dropbox).
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
// Fechas en ISO (el Excel las trae en d/m/aaaa). instagram = handle con '@'.
// dropbox_*: pestañas "Dropbox Fotografias"/"Dropbox MatchDay" del mismo Excel (0023, 2026-09-17).
const JUGADORES = [
  {
    ref: 'Nahitan Nández', id_externo: '2614',
    fecha_nacimiento: '1995-12-28', debut: '2014-03-01', fichaje: '2024-07-18',
    instagram: '@nahitannandez25',
    dropbox_fotografias_url: 'https://www.dropbox.com/scl/fo/24htnmyccn6358pzqk6ot/ABcIIJVnbaUowr0UVjE_J4M/nahitan?rlkey=zvc2qjc5p314lyuj6yn14iahs&subfolder_nav_tracking=1&st=lunmpr0s&dl=0',
    dropbox_matchday_url: 'https://www.dropbox.com/scl/fo/01tr2bfkoguk9p6t7qezd/AGvnwCvB6jDFEwyHeUpVS5M/nahitan%20nandez?rlkey=dk54wyl13p7uwfovlv0yftjrl&subfolder_nav_tracking=1&st=7e4mx6gq&dl=0',
  },
  {
    ref: 'Federico Pereira', id_externo: '67884',
    fecha_nacimiento: '2000-02-24', debut: '2019-06-04', fichaje: '2024-01-01',
    instagram: '@fede_pereira6',
    dropbox_fotografias_url: 'https://www.dropbox.com/scl/fo/24htnmyccn6358pzqk6ot/AOvnqLMRT761mpJmJo4coso/fede%20pereira?rlkey=zvc2qjc5p314lyuj6yn14iahs&subfolder_nav_tracking=1&st=bw4mxycn&dl=0',
    dropbox_matchday_url: 'https://www.dropbox.com/scl/fo/01tr2bfkoguk9p6t7qezd/AMdqWnbWZwkr2Wvv1B6ibcs/fede%20pereira?rlkey=dk54wyl13p7uwfovlv0yftjrl&subfolder_nav_tracking=1&st=1xuyozry&dl=0',
  },
  {
    ref: 'Ignacio Sosa', id_externo: '310307',
    fecha_nacimiento: '2003-08-31', debut: '2021-07-03', fichaje: '2026-01-01',
    instagram: '@nachososa5',
    dropbox_fotografias_url: 'https://www.dropbox.com/scl/fo/24htnmyccn6358pzqk6ot/APre9NeBFBx_MOW2pXNoIHE/nacho%20sosa?rlkey=zvc2qjc5p314lyuj6yn14iahs&subfolder_nav_tracking=1&st=44fc69pu&dl=0',
    dropbox_matchday_url: 'https://www.dropbox.com/scl/fo/01tr2bfkoguk9p6t7qezd/AFclsMwi4xnN1oqXBcNKXQA/nacho%20sosa?rlkey=dk54wyl13p7uwfovlv0yftjrl&subfolder_nav_tracking=1&st=9q1uiwnk&dl=0',
  },
  {
    ref: 'Javier Méndez', id_externo: '6122',
    fecha_nacimiento: '1994-12-05', debut: '2013-11-02', fichaje: '2026-01-09',
    instagram: '@javi_mendez21',
    dropbox_fotografias_url: 'https://www.dropbox.com/scl/fo/24htnmyccn6358pzqk6ot/AICgb3qpmWZrQRgPqlO-ur0/javi%20m%C3%A9ndez?rlkey=zvc2qjc5p314lyuj6yn14iahs&subfolder_nav_tracking=1&st=1io4154x&dl=0',
    dropbox_matchday_url: 'https://www.dropbox.com/scl/fo/01tr2bfkoguk9p6t7qezd/AApNNptGwysX-xxyI-7LEiQ/javier%20mendez?rlkey=dk54wyl13p7uwfovlv0yftjrl&subfolder_nav_tracking=1&st=22cu2662&dl=0',
  },
  {
    ref: 'Kevin Amaro', id_externo: '377326',
    fecha_nacimiento: '2004-03-03', debut: '2022-08-31', fichaje: '2026-08-18',
    instagram: '@kevin_amaro24',
    dropbox_fotografias_url: 'https://www.dropbox.com/scl/fo/24htnmyccn6358pzqk6ot/ALlqRj4HuoABp04YORt-5W0/kevin%20amaro?rlkey=zvc2qjc5p314lyuj6yn14iahs&subfolder_nav_tracking=1&st=hocntfkv&dl=0',
    dropbox_matchday_url: 'https://www.dropbox.com/scl/fo/01tr2bfkoguk9p6t7qezd/AF_JjtzPAp_EPNcb2gKSHVc/kevin%20amaro?rlkey=dk54wyl13p7uwfovlv0yftjrl&subfolder_nav_tracking=1&st=vygtw943&dl=0',
  },
  {
    ref: 'Martín Fernández', id_externo: '51549',
    fecha_nacimiento: '2001-05-08', debut: '2019-05-04', fichaje: '2026-07-14',
    instagram: '@nanomf8',
    dropbox_fotografias_url: 'https://www.dropbox.com/scl/fo/24htnmyccn6358pzqk6ot/ABB_QjdEoPNqBgQmWVlItRk/martin%20fernandez?rlkey=zvc2qjc5p314lyuj6yn14iahs&subfolder_nav_tracking=1&st=b2sb5ne3&dl=0',
    dropbox_matchday_url: 'https://www.dropbox.com/scl/fo/01tr2bfkoguk9p6t7qezd/AK90zxdjQPDvYt6WPBQdsnw/mart%C3%ADn%20fernandez?rlkey=dk54wyl13p7uwfovlv0yftjrl&subfolder_nav_tracking=1&st=27mpjm7s&dl=0',
  },
];

const FUNDACIONES = [
  { ref: 'Al-Qadisiyah', id_externo: '2933', fecha: '1967-12-01' },
  { ref: 'Toluca', id_externo: '2281', fecha: '1917-02-12' },
  { ref: 'Atlante', id_externo: '2312', fecha: '1916-04-18' },
  { ref: 'RB Bragantino', id_externo: '794', fecha: '2020-01-01' },
  { ref: 'Colo-Colo', id_externo: '2315', fecha: '1925-04-19' },
  { ref: 'Genk', id_externo: '742', fecha: '1988-07-01' },
];

/** UPDATE de varias columnas en una fila ubicada por (proveedor_externo, id_externo). */
async function fijarCampos(tabla, id_externo, campos, ref) {
  const columnas = Object.keys(campos);
  const { data: fila, error: errBuscar } = await admin
    .from(tabla)
    .select(['id', ...columnas].join(', '))
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (!fila) {
    console.error(`❌ ${ref}: no existe en ${tabla} con id_externo ${id_externo} — corré antes: npm run seed:roster`);
    process.exitCode = 1;
    return;
  }
  const { error: errUpdate } = await admin.from(tabla).update(campos).eq('id', fila.id);
  if (errUpdate) throw errUpdate;

  const cambios = columnas
    .filter((c) => fila[c] !== campos[c])
    .map((c) => `${c}=${campos[c]}${fila[c] ? ` (antes ${fila[c]})` : ''}`);
  console.log(`${cambios.length ? '=' : '·'} ${ref.padEnd(18)} ${cambios.join(' · ') || 'sin cambios'}`);
}

console.log('Jugadores (fecha_nacimiento · debut · fichaje · instagram):');
for (const j of JUGADORES) {
  const { ref, id_externo, ...campos } = j;
  await fijarCampos('jugadores', id_externo, campos, ref);
}

console.log('\nFundación de club (clubes.fecha_fundacion):');
for (const f of FUNDACIONES) {
  await fijarCampos('clubes', f.id_externo, { fecha_fundacion: f.fecha }, f.ref);
}

console.log(`\n✅ ${JUGADORES.length} jugadores y ${FUNDACIONES.length} clubes actualizados.`);
