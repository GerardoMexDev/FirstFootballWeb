/**
 * Carga `jugadores.fichaje` para los 5 representados de solo-Contenido que quedaron sin esa
 * fecha al sembrarlos (Sesión 6, `seed-jugadores-contenido.mjs` nunca incluyó `fichaje`).
 * Gerardo cargó las fechas reales en la hoja "Nuevos" del Excel (Sesión 9, 2026-09-16) — este
 * script solo las transcribe a la base, no lee el .xlsx (evita depender de una librería nueva
 * para 5 valores puntuales; el importador completo del Excel sigue pendiente y aparte).
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
const FICHAJES = [
  { nombre: 'Rodrigo Aguirre', fichaje: '2026-02-06' },
  { nombre: 'Abel Hernández', fichaje: '2026-01-01' },
  { nombre: 'Gastón Martirena', fichaje: '2026-08-26' },
  { nombre: 'Maximiliano Silvera', fichaje: '2026-01-02' },
  { nombre: 'Franco Romero', fichaje: '2026-07-08' },
];

for (const f of FICHAJES) {
  const { data: fila, error: errBuscar } = await admin
    .from('jugadores')
    .select('id, apodo, nombre, fichaje')
    .eq('nombre', f.nombre)
    .eq('servicio_contenido', true)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (!fila) {
    console.error(`❌ ${f.nombre}: no se encontró en jugadores (servicio_contenido=true)`);
    process.exitCode = 1;
    continue;
  }

  const { error: errUpdate } = await admin.from('jugadores').update({ fichaje: f.fichaje }).eq('id', fila.id);
  if (errUpdate) throw errUpdate;
  console.log(`${fila.fichaje === f.fichaje ? '·' : '='} ${(fila.apodo ?? fila.nombre).padEnd(20)} fichaje = ${f.fichaje}`);
}

console.log(`\n✅ ${FICHAJES.length} fichajes cargados.`);
