/**
 * Carga los 6 clubes y los 6 jugadores representados de Fase 1, con sus IDs reales de
 * API-Football (confirmados contra GET /teams + GET /players/squads — ver
 * scripts/consultar-clubes-jugadores.mjs). Idempotente: busca por
 * (proveedor_externo, id_externo) — la clave natural real de la migración 0001 — y
 * decide insert vs update a mano (el índice único es parcial, igual que en
 * seed-competencias.mjs; PostgREST no lo infiere con onConflict).
 *
 * `fecha_nacimiento`/`fecha_fundacion` quedan NULL a propósito: son datos `origen='manual'`
 * que vienen del Excel (todavía no llegó), no de la API.
 *
 * Uso: node scripts/seed-clubes-jugadores.mjs   (o: npm run seed:roster)
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

const CLUBES = [
  { nombre: 'Al-Qadisiyah FC', pais: 'Arabia Saudita', zona_horaria: 'Asia/Riyadh', id_externo: '2933' },
  { nombre: 'Toluca', pais: 'México', zona_horaria: 'America/Mexico_City', id_externo: '2281' },
  { nombre: 'Atlante FC', pais: 'México', zona_horaria: 'America/Mexico_City', id_externo: '2312' },
  { nombre: 'RB Bragantino', pais: 'Brasil', zona_horaria: 'America/Sao_Paulo', id_externo: '794' },
  { nombre: 'Colo-Colo', pais: 'Chile', zona_horaria: 'America/Santiago', id_externo: '2315' },
  { nombre: 'Genk', pais: 'Bélgica', zona_horaria: 'Europe/Brussels', id_externo: '742' },
];

// clubIdExterno enlaza con CLUBES arriba (se resuelve al uuid real después de cargar clubes).
const JUGADORES = [
  { nombre: 'Nahitan Nández', apodo: 'Nahitan', posicion: 'Mediocampista', dorsal: 8, nacionalidad: 'Uruguay', seleccion: 'Uruguay', clubIdExterno: '2933', id_externo: '2614' },
  { nombre: 'Federico Pereira', apodo: 'Fede', posicion: 'Defensa', dorsal: 6, nacionalidad: 'Uruguay', seleccion: null, clubIdExterno: '2281', id_externo: '67884' },
  { nombre: 'Martín Fernández', apodo: null, posicion: 'Mediocampista', dorsal: 25, nacionalidad: 'Uruguay', seleccion: null, clubIdExterno: '2312', id_externo: '51549' },
  { nombre: 'Ignacio Sosa', apodo: 'Nacho', posicion: 'Mediocampista', dorsal: 15, nacionalidad: 'Uruguay', seleccion: null, clubIdExterno: '794', id_externo: '310307' },
  { nombre: 'Javier Méndez', apodo: 'Javi', posicion: 'Mediocampista', dorsal: 20, nacionalidad: 'Uruguay', seleccion: null, clubIdExterno: '2315', id_externo: '6122' },
  { nombre: 'Kevin Amaro', apodo: null, posicion: 'Defensa', dorsal: 20, nacionalidad: 'Uruguay', seleccion: null, clubIdExterno: '742', id_externo: '377326' },
];

/** Busca por la clave natural real (proveedor_externo, id_externo) y hace insert o update. */
async function upsertPorClaveNatural(tabla, fila, seleccionar) {
  const { data: existente, error: errBuscar } = await admin
    .from(tabla)
    .select('id')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', fila.id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  const { data, error } = existente
    ? await admin.from(tabla).update(fila).eq('id', existente.id).select(seleccionar).single()
    : await admin.from(tabla).insert(fila).select(seleccionar).single();
  if (error) throw error;
  return { ...data, accion: existente ? 'actualizado' : 'creado' };
}

const clubesCreados = [];
for (const c of CLUBES) {
  const fila = { ...c, origen: 'api', proveedor_externo: PROVEEDOR };
  const resultado = await upsertPorClaveNatural('clubes', fila, 'id, nombre, id_externo');
  clubesCreados.push(resultado);
  console.log(`${resultado.accion === 'creado' ? '+' : '='} club ${resultado.nombre} (${resultado.accion})`);
}
const clubIdPorExterno = new Map(clubesCreados.map((c) => [c.id_externo, c.id]));

const jugadoresCreados = [];
for (const j of JUGADORES) {
  const clubActualId = clubIdPorExterno.get(j.clubIdExterno);
  if (!clubActualId) {
    console.error(`❌ ${j.nombre}: no se encontró el club con id_externo ${j.clubIdExterno}`);
    process.exitCode = 1;
    continue;
  }
  const { clubIdExterno, ...resto } = j;
  const fila = { ...resto, club_actual_id: clubActualId, origen: 'api', proveedor_externo: PROVEEDOR };
  const resultado = await upsertPorClaveNatural('jugadores', fila, 'id, nombre, id_externo');
  jugadoresCreados.push(resultado);
  console.log(`${resultado.accion === 'creado' ? '+' : '='} jugador ${resultado.nombre} (${resultado.accion})`);
}

console.log(`\n✅ ${clubesCreados.length} clubes y ${jugadoresCreados.length} jugadores cargados/actualizados.`);
