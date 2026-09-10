/**
 * Carga el roster del servicio "Contenido" (Calendario General):
 *   · 4 clubes nuevos (Tigres UANL, SC Internacional, CA Peñarol, Club Nacional) con
 *     fecha_fundacion y país.
 *   · 7 jugadores nuevos (origen='manual', activo=true, servicio_match_day=false,
 *     servicio_contenido=true) con nacimiento / debut / debut_seleccion normalizados de
 *     la pestaña "Nuevos" del Excel.
 *   · servicio_contenido=true en los 5 representados que YA existen y también están en
 *     "Nuevos" — sin tocarles ningún otro campo (son Match Day).
 *
 * Idempotente: matchea por (proveedor_externo, id_externo) y hace UPDATE; INSERT la 1ª vez.
 * Interino de un importador del .xlsx: los valores van fijos porque ya están confirmados.
 *
 * Uso: npm run seed:jugadores-contenido
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
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

// --- Clubes nuevos. id_externo = id de equipo de API-Football (Step 1). ---
const CLUBES = [
  { ref: 'Tigres UANL',      proveedor: 'api-football', id_externo: '2279', pais: 'México',  fecha_fundacion: '1960-03-07' },
  { ref: 'SC Internacional', proveedor: 'api-football', id_externo: '119',  pais: 'Brasil',  fecha_fundacion: '1909-04-04' },
  { ref: 'CA Peñarol',       proveedor: 'api-football', id_externo: '2348', pais: 'Uruguay', fecha_fundacion: '1891-09-28' },
  { ref: 'Club Nacional',    proveedor: 'api-football', id_externo: '2356', pais: 'Uruguay', fecha_fundacion: '1899-05-14' },
];

// --- Jugadores nuevos (insert). id_externo = id de jugador de API-Football (Step 1). ---
const JUGADORES_NUEVOS = [
  { ref: 'Rodrigo Aguirre',     proveedor: 'api-football', id_externo: '16482',  club: 'Tigres UANL',      fecha_nacimiento: '1994-10-01', debut: '2011-09-04', debut_seleccion: '2024-11-15' },
  { ref: 'Sergio Rochet',       proveedor: 'api-football', id_externo: '50077',  club: 'SC Internacional', fecha_nacimiento: '1993-03-23', debut: '2014-08-30', debut_seleccion: '2022-01-27' },
  { ref: 'Abel Hernández',      proveedor: 'api-football', id_externo: '844',     club: 'CA Peñarol',       fecha_nacimiento: '1990-08-08', debut: '2007-04-22', debut_seleccion: '2010-08-11' },
  { ref: 'Gastón Martirena',    proveedor: 'api-football', id_externo: '197520', club: 'Club Nacional',    fecha_nacimiento: '2000-01-05', debut: null,         debut_seleccion: null },
  { ref: 'Luis Mejía',          proveedor: 'api-football', id_externo: '2967',   club: 'Club Nacional',    fecha_nacimiento: '1991-03-16', debut: '2010-08-21', debut_seleccion: '2009-06-07' },
  { ref: 'Maximiliano Silvera', proveedor: 'api-football', id_externo: '52058',  club: 'Club Nacional',    fecha_nacimiento: '1997-09-05', debut: '2015-03-21', debut_seleccion: null },
  { ref: 'Franco Romero',       proveedor: 'api-football', id_externo: '51542',  club: 'CA Peñarol',       fecha_nacimiento: '1995-02-11', debut: '2015-03-22', debut_seleccion: null },
];

// --- Existentes: SOLO prender servicio_contenido. ---
const EXISTENTES_CONTENIDO = ['67884', '310307', '6122', '377326', '51549'];

/** UPSERT por (proveedor_externo, id_externo): update si existe, insert si no. Devuelve el id. */
async function upsert(tabla, proveedor, id_externo, campos, ref) {
  const { data: fila, error: errBuscar } = await admin
    .from(tabla)
    .select('id')
    .eq('proveedor_externo', proveedor)
    .eq('id_externo', id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  if (fila) {
    const { error } = await admin.from(tabla).update(campos).eq('id', fila.id);
    if (error) throw error;
    console.log(`= ${ref.padEnd(20)} update`);
    return fila.id;
  }
  const { data: nueva, error } = await admin
    .from(tabla)
    .insert({ proveedor_externo: proveedor, id_externo, origen: 'manual', ...campos })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`+ ${ref.padEnd(20)} insert`);
  return nueva.id;
}

console.log('Clubes nuevos:');
const clubIdPorRef = {};
for (const c of CLUBES) {
  clubIdPorRef[c.ref] = await upsert(
    'clubes', c.proveedor, c.id_externo,
    { nombre: c.ref, pais: c.pais, fecha_fundacion: c.fecha_fundacion },
    c.ref,
  );
}

console.log('\nJugadores nuevos (servicio_contenido, NO match_day):');
for (const j of JUGADORES_NUEVOS) {
  await upsert(
    'jugadores', j.proveedor, j.id_externo,
    {
      nombre: j.ref,
      fecha_nacimiento: j.fecha_nacimiento,
      debut: j.debut,
      debut_seleccion: j.debut_seleccion,
      club_actual_id: clubIdPorRef[j.club] ?? null,
      activo: true,
      servicio_match_day: false,
      servicio_contenido: true,
    },
    j.ref,
  );
}

console.log('\nExistentes → servicio_contenido = true (nada más):');
for (const id_externo of EXISTENTES_CONTENIDO) {
  const { data, error } = await admin
    .from('jugadores')
    .update({ servicio_contenido: true })
    .eq('proveedor_externo', 'api-football')
    .eq('id_externo', id_externo)
    .select('nombre')
    .maybeSingle();
  if (error) throw error;
  console.log(data ? `= ${data.nombre}` : `⚠ id_externo ${id_externo} no encontrado`);
}

console.log(`\n✅ ${CLUBES.length} clubes, ${JUGADORES_NUEVOS.length} jugadores nuevos, ${EXISTENTES_CONTENIDO.length} existentes marcados.`);
