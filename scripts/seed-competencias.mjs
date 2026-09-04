/**
 * Carga en `competencias` el catálogo de ligas/copas/continentales de la cartera Fase 1,
 * con los IDs reales confirmados contra `GET /leagues` de API-Football (Sesión 2, cont.).
 * Idempotente: upsert por `id_externo` (índice único parcial de la migración 0001).
 *
 * `cobertura` acá refleja específicamente si la API da ESTADÍSTICA POR JUGADOR para esa
 * competencia (fixtures casi siempre vienen; lo que no siempre viene son las stats) — es lo
 * que dice el comentario de la columna: "la UI no debe prometer estadística".
 *
 * Quedaron afuera a propósito (ver avances.md §4):
 * - Copa MX / Copa por México: discontinuadas (última temporada 2019 y 2022).
 * - Copa de Bélgica ("Beker van België", id 147): cero cobertura en la API (ni fixtures).
 *
 * Uso: node scripts/seed-competencias.mjs   (o: npm run seed:competencias)
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

const COMPETENCIAS = [
  // --- Ligas domésticas ---
  { nombre: 'Pro League', pais: 'Arabia Saudita', tipo: 'liga', codigo: 'SPL', id_externo: '307', cobertura: true },
  { nombre: 'Liga MX', pais: 'México', tipo: 'liga', codigo: 'MX', id_externo: '262', cobertura: true },
  // Liga de Expansión MX: la API confirma que NO da estadística por jugador — igual que
  // ya adelantaba la demo ("cobertura sin verificar → sin datos, nunca ceros").
  { nombre: 'Liga de Expansión MX', pais: 'México', tipo: 'liga', codigo: 'EXP', id_externo: '263', cobertura: false },
  { nombre: 'Serie A', pais: 'Brasil', tipo: 'liga', codigo: 'BSA', id_externo: '71', cobertura: true },
  { nombre: 'Primera División', pais: 'Chile', tipo: 'liga', codigo: 'CHI', id_externo: '265', cobertura: true },
  { nombre: 'Jupiler Pro League', pais: 'Bélgica', tipo: 'liga', codigo: 'JPL', id_externo: '144', cobertura: true },

  // --- Copas domésticas ---
  // King's Cup: hay fixtures pero no estadística por jugador.
  { nombre: "King's Cup", pais: 'Arabia Saudita', tipo: 'copa', codigo: 'KSA-C', id_externo: '504', cobertura: false },
  { nombre: 'Copa do Brasil', pais: 'Brasil', tipo: 'copa', codigo: 'CDB', id_externo: '73', cobertura: true },
  { nombre: 'Copa Chile', pais: 'Chile', tipo: 'copa', codigo: 'CCH', id_externo: '267', cobertura: true },

  // --- Continentales (para cuando algún club clasifique) ---
  { nombre: 'CONMEBOL Libertadores', pais: 'Sudamérica', tipo: 'continental', codigo: 'LIB', id_externo: '13', cobertura: true },
  { nombre: 'CONMEBOL Sudamericana', pais: 'Sudamérica', tipo: 'continental', codigo: 'SUD', id_externo: '11', cobertura: true },
  { nombre: 'UEFA Europa League', pais: 'Europa', tipo: 'continental', codigo: 'UEL', id_externo: '3', cobertura: true },
  // Dos niveles de AFC Champions League desde la reforma 2024 — se cargan los dos; el que
  // no aplique al club de turno simplemente no va a tener partidos.
  { nombre: 'AFC Champions League Elite', pais: 'Asia', tipo: 'continental', codigo: 'ACLE', id_externo: '17', cobertura: true },
  { nombre: 'AFC Champions League Two', pais: 'Asia', tipo: 'continental', codigo: 'ACL2', id_externo: '18', cobertura: true },

  // --- Selección ---
  { nombre: 'World Cup - Qualification South America', pais: 'Sudamérica', tipo: 'seleccion', codigo: 'ELIM', id_externo: '34', cobertura: true },
];

// `competencias_externo_uidx` es un índice único PARCIAL (where id_externo is not null), no
// una constraint — el upsert con onConflict de PostgREST no lo infiere. Se hace a mano:
// buscar por id_externo y decidir insert vs update, mismo patrón que seed-usuarios.mjs.
const resultado = [];
let huboError = false;

for (const c of COMPETENCIAS) {
  const fila = { ...c, origen: 'api', proveedor_externo: PROVEEDOR };
  const { data: existente, error: errBuscar } = await admin
    .from('competencias')
    .select('id')
    .eq('id_externo', c.id_externo)
    .maybeSingle();

  if (errBuscar) {
    console.error(`❌ ${c.nombre}: ${errBuscar.message}`);
    huboError = true;
    continue;
  }

  const { data, error } = existente
    ? await admin.from('competencias').update(fila).eq('id', existente.id).select('nombre, id_externo, cobertura').single()
    : await admin.from('competencias').insert(fila).select('nombre, id_externo, cobertura').single();

  if (error) {
    console.error(`❌ ${c.nombre}: ${error.message}`);
    huboError = true;
    continue;
  }
  resultado.push({ ...data, accion: existente ? 'actualizada' : 'creada' });
}

if (huboError) {
  console.error('\n⚠️  Terminó con errores — revisar arriba.');
  process.exit(1);
}

console.log(`✅ ${resultado.length} competencias cargadas/actualizadas:`);
console.table(resultado);
