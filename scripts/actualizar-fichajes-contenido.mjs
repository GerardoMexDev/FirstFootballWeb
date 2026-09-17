/**
 * Carga `jugadores.fichaje`/`debut` para los representados de solo-Contenido que quedaron sin
 * esos datos al sembrarlos (Sesión 6, `seed-jugadores-contenido.mjs` nunca incluyó `fichaje`,
 * y a Gastón Martirena tampoco le cargó `debut`). Gerardo cargó las fechas reales en la hoja
 * "Nuevos" del Excel (Sesión 9, 2026-09-16) — este script solo las transcribe a la base, no
 * lee el .xlsx (evita depender de una librería nueva para unos pocos valores puntuales; el
 * importador completo del Excel sigue pendiente y aparte).
 *
 * Idempotente: matchea por nombre + `servicio_contenido=true`, siempre hace UPDATE.
 *
 * Uso: node scripts/actualizar-fichajes-contenido.mjs
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

// Fechas de la hoja "Nuevos" del Excel (columna "Fichaje"), cargadas por Gerardo 2026-09-16.
// `debut` de Martirena: la hoja tenía solo "Mayo de 2022" (sin día); Gerardo lo corrigió al
// día exacto en el Excel y lo confirmó por chat (24 de marzo de 2021) — no es el mismo dato
// que el mes/año que había antes, prevalece el valor confirmado.
const DATOS = [
  { nombre: 'Rodrigo Aguirre', fichaje: '2026-02-06' },
  { nombre: 'Abel Hernández', fichaje: '2026-01-01' },
  { nombre: 'Gastón Martirena', fichaje: '2026-08-26', debut: '2021-03-24' },
  { nombre: 'Maximiliano Silvera', fichaje: '2026-01-02' },
  { nombre: 'Franco Romero', fichaje: '2026-07-08' },
];

for (const f of DATOS) {
  const { data: fila, error: errBuscar } = await admin
    .from('jugadores')
    .select('id, apodo, nombre, fichaje, debut')
    .eq('nombre', f.nombre)
    .eq('servicio_contenido', true)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (!fila) {
    console.error(`❌ ${f.nombre}: no se encontró en jugadores (servicio_contenido=true)`);
    process.exitCode = 1;
    continue;
  }

  const cambios = { fichaje: f.fichaje, ...(f.debut ? { debut: f.debut } : {}) };
  const { error: errUpdate } = await admin.from('jugadores').update(cambios).eq('id', fila.id);
  if (errUpdate) throw errUpdate;
  console.log(`${(fila.apodo ?? fila.nombre).padEnd(20)} fichaje = ${f.fichaje}${f.debut ? `, debut = ${f.debut}` : ''}`);
}

console.log(`\n✅ ${DATOS.length} jugadores actualizados.`);
